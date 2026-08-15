export const runtime = "nodejs";
export const maxDuration = 60;

import Groq from "groq-sdk";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { generateEmbedding } from "@/lib/embeddings";

// ============================================================
// RAG CONFIGURATION
// ============================================================

const EMBEDDING_DIMENSIONS = 384;

// Minimum score required for a chunk to be considered
// potentially relevant.
const MIN_SIMILARITY = 0.45;

// If the first search is weaker than this,
// perform a second query using related terminology.
const FALLBACK_SIMILARITY = 0.60;

const MAX_KNOWLEDGE_MATCHES = 5;

// ============================================================
// TYPES
// ============================================================

type KnowledgeMatch = {
  id?: string;
  document_id?: string;
  project_id?: string;
  content?: string;
  chunk_index?: number;
  similarity?: number;
};

type StoredKnowledgeMatch = KnowledgeMatch & {
  similarity: number;
};

// ============================================================
// QUERY EXPANSION
// ============================================================

function expandQuery(
  query: string
): string {
  const lower = query.toLowerCase();

  const relatedTerms =
    new Set<string>();

  // ------------------------------------------
  // E-commerce / customer support
  // ------------------------------------------

  if (
    lower.includes("refund") ||
    lower.includes("reimbursement")
  ) {
    relatedTerms.add("return");
    relatedTerms.add("refund");
    relatedTerms.add("reimbursement");
    relatedTerms.add("return policy");
  }

  if (
    lower.includes("return")
  ) {
    relatedTerms.add("refund");
    relatedTerms.add("return");
    relatedTerms.add("return policy");
  }

  if (
    lower.includes("shipping") ||
    lower.includes("ship")
  ) {
    relatedTerms.add("delivery");
    relatedTerms.add("shipping");
    relatedTerms.add("delivery policy");
  }

  if (
    lower.includes("delivery")
  ) {
    relatedTerms.add("shipping");
    relatedTerms.add("delivery");
  }

  if (
    lower.includes("cancel") ||
    lower.includes("cancellation")
  ) {
    relatedTerms.add("cancellation");
    relatedTerms.add("cancel");
    relatedTerms.add("order cancellation");
  }

  if (
    lower.includes("price") ||
    lower.includes("cost")
  ) {
    relatedTerms.add("price");
    relatedTerms.add("cost");
    relatedTerms.add("pricing");
  }

  if (
    lower.includes("payment") ||
    lower.includes("pay")
  ) {
    relatedTerms.add("payment");
    relatedTerms.add("billing");
    relatedTerms.add("payment methods");
  }

  // ------------------------------------------
  // Healthcare / medical
  // ------------------------------------------

  if (
    lower.includes("doctor") ||
    lower.includes("physician")
  ) {
    relatedTerms.add("doctor");
    relatedTerms.add("physician");
    relatedTerms.add("medical professional");
  }

  if (
    lower.includes("medicine") ||
    lower.includes("medication") ||
    lower.includes("drug")
  ) {
    relatedTerms.add("medicine");
    relatedTerms.add("medication");
    relatedTerms.add("drug");
  }

  if (
    lower.includes("appointment") ||
    lower.includes("booking")
  ) {
    relatedTerms.add("appointment");
    relatedTerms.add("booking");
    relatedTerms.add("schedule");
  }

  if (
    lower.includes("symptom") ||
    lower.includes("sign")
  ) {
    relatedTerms.add("symptoms");
    relatedTerms.add("signs");
    relatedTerms.add("clinical symptoms");
  }

  if (
    lower.includes("treatment") ||
    lower.includes("therapy")
  ) {
    relatedTerms.add("treatment");
    relatedTerms.add("therapy");
    relatedTerms.add("management");
  }

  // ------------------------------------------
  // General support terminology
  // ------------------------------------------

  if (
    lower.includes("contact") ||
    lower.includes("reach")
  ) {
    relatedTerms.add("contact");
    relatedTerms.add("support");
    relatedTerms.add("customer service");
  }

  if (
    lower.includes("support") ||
    lower.includes("help")
  ) {
    relatedTerms.add("support");
    relatedTerms.add("customer service");
    relatedTerms.add("assistance");
  }

  // ------------------------------------------
  // If no expansion was found,
  // return original query.
  // ------------------------------------------

  if (
    relatedTerms.size === 0
  ) {
    return query;
  }

  return `${query}. Related terminology: ${Array.from(
    relatedTerms
  ).join(", ")}`;
}

// ============================================================
// MERGE KNOWLEDGE RESULTS
// ============================================================

function mergeKnowledgeMatches(
  matchGroups: KnowledgeMatch[][]
): StoredKnowledgeMatch[] {
  const merged =
    new Map<
      string,
      StoredKnowledgeMatch
    >();

  for (const group of matchGroups) {
    for (const match of group) {
      if (
        typeof match.content !==
          "string" ||
        !match.content.trim()
      ) {
        continue;
      }

      if (
        typeof match.similarity !==
        "number"
      ) {
        continue;
      }

      // Prefer database ID when available.
      // Fall back to content when necessary.
      const key =
        match.id ||
        match.content
          .trim()
          .toLowerCase();

      const existing =
        merged.get(key);

      if (
        !existing ||
        match.similarity >
          existing.similarity
      ) {
        merged.set(key, {
          ...match,
          similarity:
            match.similarity,
        });
      }
    }
  }

  return Array.from(
    merged.values()
  ).sort(
    (a, b) =>
      b.similarity -
      a.similarity
  );
}

// ============================================================
// POST /api/chat
// ============================================================

export async function POST(
  request: Request
) {
  try {
    // ========================================================
    // 1. GROQ API KEY
    // ========================================================

    const apiKey =
      process.env.GROQ_API_KEY;

    if (!apiKey) {
      console.error(
        "[CHAT] GROQ_API_KEY is missing."
      );

      return NextResponse.json(
        {
          error:
            "AI service is not configured on the server.",
        },
        { status: 500 }
      );
    }

    const groq =
      new Groq({
        apiKey,
      });

    // ========================================================
    // 2. SUPABASE
    // ========================================================

    const supabase =
      await createClient();

    // ========================================================
    // 3. AUTHENTICATION
    // ========================================================

    const {
      data: { user },
      error: authError,
    } =
      await supabase.auth.getUser();

    if (authError) {
      console.error(
        "[CHAT] Authentication error:",
        authError
      );

      return NextResponse.json(
        {
          error:
            "Authentication failed.",
        },
        { status: 401 }
      );
    }

    if (!user) {
      return NextResponse.json(
        {
          error:
            "You must be logged in.",
        },
        { status: 401 }
      );
    }

    // ========================================================
    // 4. REQUEST BODY
    // ========================================================

    const body =
      await request.json();

    const agentId =
      body.agentId;

    const message =
      body.message;

    const requestedConversationId =
      body.conversationId;

    if (
      typeof agentId !==
        "string" ||
      !agentId.trim()
    ) {
      return NextResponse.json(
        {
          error:
            "Agent ID is required.",
        },
        { status: 400 }
      );
    }

    if (
      typeof message !==
        "string" ||
      !message.trim()
    ) {
      return NextResponse.json(
        {
          error:
            "Message is required.",
        },
        { status: 400 }
      );
    }

    const trimmedMessage =
      message.trim();

    // ========================================================
    // 5. VERIFY AGENT OWNERSHIP
    // ========================================================

    const {
      data: project,
      error: projectError,
    } =
      await supabase
        .from("projects")
        .select("id, name")
        .eq("id", agentId)
        .eq(
          "user_id",
          user.id
        )
        .single();

    if (
      projectError ||
      !project
    ) {
      console.error(
        "[CHAT] Agent ownership error:",
        projectError
      );

      return NextResponse.json(
        {
          error:
            "Agent not found or you do not have access to it.",
        },
        { status: 404 }
      );
    }

    // ========================================================
    // 6. LOAD SYSTEM PROMPT
    // ========================================================

    const {
      data: prompt,
      error: promptError,
    } =
      await supabase
        .from("prompts")
        .select("content")
        .eq(
          "project_id",
          project.id
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        )
        .limit(1)
        .maybeSingle();

    if (promptError) {
      console.error(
        "[CHAT] Prompt loading error:",
        promptError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load the agent instructions.",
        },
        { status: 500 }
      );
    }

    const systemPrompt =
      prompt?.content?.trim() ||
      "You are a helpful AI assistant.";

    // ========================================================
    // 7. VERIFY CONVERSATION
    // ========================================================

    if (
      typeof requestedConversationId !==
        "string" ||
      !requestedConversationId
    ) {
      return NextResponse.json(
        {
          error:
            "Conversation ID is required. Please create a new chat first.",
        },
        { status: 400 }
      );
    }

    const {
      data: conversation,
      error:
        conversationError,
    } =
      await supabase
        .from("conversations")
        .select(
          "id, project_id, title, created_at, updated_at"
        )
        .eq(
          "id",
          requestedConversationId
        )
        .eq(
          "project_id",
          project.id
        )
        .single();

    if (
      conversationError ||
      !conversation
    ) {
      console.error(
        "[CHAT] Conversation error:",
        conversationError
      );

      return NextResponse.json(
        {
          error:
            "Conversation not found or you do not have access to it.",
        },
        { status: 404 }
      );
    }

    const conversationId =
      conversation.id;

    // ========================================================
    // 8. LOAD CONVERSATION HISTORY
    // ========================================================

    const {
      data: previousMessages,
      error: historyError,
    } =
      await supabase
        .from("messages")
        .select(
          "role, content"
        )
        .eq(
          "conversation_id",
          conversationId
        )
        .order(
          "created_at",
          {
            ascending: true,
          }
        );

    if (historyError) {
      console.error(
        "[CHAT] History error:",
        historyError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load conversation history.",
        },
        { status: 500 }
      );
    }

    // ========================================================
    // 9. SAVE USER MESSAGE
    // ========================================================

    const userMessageId =
      randomUUID();

    const userMessage = {
      id:
        userMessageId,

      conversation_id:
        conversationId,

      role:
        "user" as const,

      content:
        trimmedMessage,

      created_at:
        new Date().toISOString(),
    };

    const {
      error:
        userMessageInsertError,
    } =
      await supabase
        .from("messages")
        .insert({
          id:
            userMessage.id,

          conversation_id:
            userMessage.conversation_id,

          role:
            userMessage.role,

          content:
            userMessage.content,

          created_at:
            userMessage.created_at,
        });

    if (
      userMessageInsertError
    ) {
      console.error(
        "[CHAT] User message insert error:",
        userMessageInsertError
      );

      return NextResponse.json(
        {
          error:
            "Unable to save your message.",
        },
        { status: 500 }
      );
    }

    // ========================================================
    // 10. RAG RETRIEVAL
    // ========================================================

    let knowledgeContext =
      "";

    let hasRelevantKnowledge =
      false;

    let topSimilarity =
      0;

    try {
      console.log(
        "================================="
      );

      console.log(
        "[RAG] Starting knowledge retrieval"
      );

      console.log(
        "[RAG] Query:",
        trimmedMessage
      );

      console.log(
        "[RAG] Agent:",
        project.id
      );

      console.log(
        "================================="
      );

      // ------------------------------------------------------
      // First query: exact user question
      // ------------------------------------------------------

      const primaryEmbedding =
        await generateEmbedding(
          trimmedMessage
        );

      if (
        primaryEmbedding.length !==
        EMBEDDING_DIMENSIONS
      ) {
        throw new Error(
          `Expected ${EMBEDDING_DIMENSIONS} dimensions but received ${primaryEmbedding.length}.`
        );
      }

      console.log(
        "[RAG] Primary embedding generated."
      );

      const {
        data:
          primaryMatches,
        error:
          primarySearchError,
      } =
        await supabase.rpc(
          "match_knowledge_chunks",
          {
            query_embedding:
              primaryEmbedding,

            match_project_id:
              project.id,

            match_count:
              MAX_KNOWLEDGE_MATCHES,
          }
        );

      if (
        primarySearchError
      ) {
        throw new Error(
          primarySearchError.message
        );
      }

      const firstMatches =
        Array.isArray(
          primaryMatches
        )
          ? primaryMatches
          : [];

      console.log(
        "[RAG] Primary matches:",
        firstMatches.length
      );

      // ------------------------------------------------------
      // Determine best primary result
      // ------------------------------------------------------

      const primaryBest =
        firstMatches.reduce(
          (
            best: number,
            match: KnowledgeMatch
          ) => {
            if (
              typeof match.similarity !==
              "number"
            ) {
              return best;
            }

            return Math.max(
              best,
              match.similarity
            );
          },
          0
        );

      topSimilarity =
        primaryBest;

      console.log(
        "[RAG] Primary top similarity:",
        primaryBest
      );

      // ------------------------------------------------------
      // Second query when primary retrieval is weak
      // ------------------------------------------------------

      const shouldRunFallback =
        primaryBest <
        FALLBACK_SIMILARITY;

      let secondMatches:
        KnowledgeMatch[] = [];

      if (
        shouldRunFallback
      ) {
        const expandedQuery =
          expandQuery(
            trimmedMessage
          );

        // Only perform another search if
        // the query actually changed.
        if (
          expandedQuery !==
          trimmedMessage
        ) {
          console.log(
            "[RAG] Primary result is weak."
          );

          console.log(
            "[RAG] Expanded query:",
            expandedQuery
          );

          const expandedEmbedding =
            await generateEmbedding(
              expandedQuery
            );

          if (
            expandedEmbedding.length !==
            EMBEDDING_DIMENSIONS
          ) {
            throw new Error(
              `Expected ${EMBEDDING_DIMENSIONS} dimensions but received ${expandedEmbedding.length}.`
            );
          }

          const {
            data:
              expandedMatches,
            error:
              expandedSearchError,
          } =
            await supabase.rpc(
              "match_knowledge_chunks",
              {
                query_embedding:
                  expandedEmbedding,

                match_project_id:
                  project.id,

                match_count:
                  MAX_KNOWLEDGE_MATCHES,
              }
            );

          if (
            expandedSearchError
          ) {
            console.error(
              "[RAG] Expanded search failed:",
              expandedSearchError
            );
          } else {
            secondMatches =
              Array.isArray(
                expandedMatches
              )
                ? expandedMatches
                : [];
          }

          console.log(
            "[RAG] Expanded matches:",
            secondMatches.length
          );
        }
      }

      // ------------------------------------------------------
      // Merge results from both searches
      // ------------------------------------------------------

      const mergedMatches =
        mergeKnowledgeMatches([
          firstMatches,
          secondMatches,
        ]);

      console.log(
        "[RAG] Merged unique matches:",
        mergedMatches.length
      );

      // ------------------------------------------------------
      // Log merged results
      // ------------------------------------------------------

      mergedMatches
        .slice(
          0,
          MAX_KNOWLEDGE_MATCHES
        )
        .forEach(
          (
            match,
            index
          ) => {
            console.log(
              `[RAG] Final match ${
                index + 1
              } similarity:`,
              match.similarity
            );

            console.log(
              `[RAG] Final match ${
                index + 1
              } preview:`,
              match.content
                ?.slice(
                  0,
                  300
                )
            );
          }
        );

      // ------------------------------------------------------
      // Filter final relevant matches
      // ------------------------------------------------------

      const relevantMatches =
        mergedMatches
          .filter(
            (
              match
            ) =>
              match.similarity >=
                MIN_SIMILARITY &&
              typeof match.content ===
                "string" &&
              match.content.trim()
                .length > 0
          )
          .slice(
            0,
            MAX_KNOWLEDGE_MATCHES
          );

      console.log(
        "[RAG] Relevant matches:",
        relevantMatches.length
      );

      if (
        relevantMatches.length >
        0
      ) {
        hasRelevantKnowledge =
          true;

        topSimilarity =
          relevantMatches[0]
            .similarity;

        knowledgeContext =
          relevantMatches
            .map(
              (
                match,
                index
              ) =>
                [
                  `[Knowledge Source ${
                    index + 1
                  }]`,

                  match.content?.trim(),
                ].join("\n")
            )
            .join(
              "\n\n--------------------\n\n"
            );

        console.log(
          "[RAG] Knowledge context created."
        );

        console.log(
          "[RAG] Final top similarity:",
          topSimilarity
        );
      } else {
        console.log(
          "[RAG] No sufficiently relevant knowledge found."
        );
      }

      console.log(
        "================================="
      );
    } catch (knowledgeError) {
      console.error(
        "[RAG] Knowledge retrieval failed:",
        knowledgeError
      );

      return NextResponse.json(
        {
          error:
            "I could not search the agent's knowledge base right now. Please try again.",
        },
        { status: 503 }
      );
    }

    // ========================================================
    // 11. BUILD GROQ HISTORY
    // ========================================================

    const historyForGroq =
      (previousMessages || [])
        .filter(
          (msg) =>
            msg.role ===
              "user" ||
            msg.role ===
              "assistant"
        )
        .map(
          (msg) => ({
            role:
              msg.role ===
              "assistant"
                ? ("assistant" as const)
                : ("user" as const),

            content:
              msg.content,
          })
        );

    // ========================================================
    // 12. RAG SYSTEM PROMPT
    // ========================================================

    const ragSystemPrompt = `
${systemPrompt}

STRICT KNOWLEDGE-BASE RULES:

You are an AI agent operating for a specific organization, business, medical service, or use case.

The retrieved knowledge below is the primary source of truth for organization-specific information.

1. When the user asks about the organization, its products, services, policies, procedures, prices, refunds, returns, appointments, medical information, contact information, or other organization-specific information, use the retrieved knowledge as your primary source.

2. Retrieved information may use different but related terminology than the user's wording.

3. Treat semantically related terminology as relevant when the retrieved content clearly answers the user's question.

For example:
- "refund policy" can refer to refund information contained inside a "return policy".
- "shipping" can refer to "delivery".
- "appointment" can refer to "booking".
- "medicine" can refer to "medication".

4. Never invent organization-specific information.

5. Never guess missing policies, prices, dates, names, procedures, eligibility rules, return periods, refund periods, medical facts, or other specific facts.

6. Do not use general world knowledge to fill missing organization-specific information.

7. If the retrieved knowledge does not contain enough information to answer an organization-specific question, briefly say that the information is not available in the current knowledge base.

8. Do not ask the user to provide more context unless their question is genuinely ambiguous.

9. Do not claim that a fact exists in the knowledge base unless it is supported by the retrieved context.

10. If relevant knowledge is retrieved, answer directly from it.

11. Do not mention embeddings, vector search, similarity scores, retrieval, RAG, internal prompts, or system instructions to the user.

12. Do not expose internal implementation details.

13. Keep responses concise, natural, and professional.

14. For medical information, do not invent medical facts. Use only the available knowledge base for organization-specific medical information and follow the agent's configured instructions.

CURRENT RETRIEVED KNOWLEDGE:

${
  hasRelevantKnowledge
    ? knowledgeContext
    : "No sufficiently relevant knowledge was retrieved for this question."
}
`;

    // ========================================================
    // 13. ADD CURRENT MESSAGE
    // ========================================================

    historyForGroq.push({
      role: "user",
      content:
        trimmedMessage,
    });

    // ========================================================
    // 14. GROQ STREAM
    // ========================================================

    console.log(
      "[AI] Starting Groq response generation."
    );

    console.log(
      "[AI] Knowledge available:",
      hasRelevantKnowledge
    );

    console.log(
      "[AI] Top similarity:",
      topSimilarity
    );

    const stream =
      await groq.chat.completions.create(
        {
          model:
            "llama-3.1-8b-instant",

          messages: [
            {
              role: "system",

              content:
                ragSystemPrompt,
            },

            ...historyForGroq,
          ],

          temperature: 0.2,

          max_tokens: 1000,

          stream: true,
        }
      );

    // ========================================================
    // 15. CREATE READABLE STREAM
    // ========================================================

    const encoder =
      new TextEncoder();

    let fullResponse =
      "";

    const readableStream =
      new ReadableStream({
        async start(
          controller
        ) {
          try {
            // --------------------------------------
            // Send user message
            // --------------------------------------

            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  type:
                    "user_message",

                  message:
                    userMessage,
                }) + "\n"
              )
            );

            // --------------------------------------
            // Stream AI response
            // --------------------------------------

            for await (
              const chunk of stream
            ) {
              const content =
                chunk.choices[0]
                  ?.delta
                  ?.content;

              if (!content) {
                continue;
              }

              fullResponse +=
                content;

              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    type:
                      "chunk",

                    content:
                      content,
                  }) + "\n"
                )
              );
            }

            // --------------------------------------
            // Validate response
            // --------------------------------------

            if (
              !fullResponse.trim()
            ) {
              throw new Error(
                "The AI returned an empty response."
              );
            }

            // --------------------------------------
            // Save assistant message
            // --------------------------------------

            const assistantMessageId =
              randomUUID();

            const assistantMessage =
              {
                id:
                  assistantMessageId,

                conversation_id:
                  conversationId,

                role:
                  "assistant" as const,

                content:
                  fullResponse,

                created_at:
                  new Date().toISOString(),
              };

            const {
              error:
                assistantMessageInsertError,
            } =
              await supabase
                .from("messages")
                .insert({
                  id:
                    assistantMessage.id,

                  conversation_id:
                    assistantMessage.conversation_id,

                  role:
                    assistantMessage.role,

                  content:
                    assistantMessage.content,

                  created_at:
                    assistantMessage.created_at,
                });

            if (
              assistantMessageInsertError
            ) {
              throw new Error(
                "The AI response was generated but could not be saved: " +
                  assistantMessageInsertError.message
              );
            }

            // --------------------------------------
            // Update conversation
            // --------------------------------------

            await supabase
              .from("conversations")
              .update({
                updated_at:
                  new Date().toISOString(),
              })
              .eq(
                "id",
                conversationId
              );

            // --------------------------------------
            // Complete event
            // --------------------------------------

            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  type:
                    "complete",

                  assistantMessage,

                  conversation: {
                    id:
                      conversationId,

                    project_id:
                      project.id,

                    title:
                      conversation.title,
                  },
                }) + "\n"
              )
            );

            controller.close();
          } catch (error) {
            console.error(
              "[AI] Streaming error:",
              error
            );

            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  type:
                    "error",

                  error:
                    error instanceof
                    Error
                      ? error.message
                      : "Streaming failed.",
                }) + "\n"
              )
            );

            controller.close();
          }
        },
      });

    // ========================================================
    // 16. RETURN STREAM
    // ========================================================

    return new Response(
      readableStream,
      {
        status: 200,

        headers: {
          "Content-Type":
            "application/x-ndjson; charset=utf-8",

          "Cache-Control":
            "no-cache, no-transform",

          Connection:
            "keep-alive",
        },
      }
    );
  } catch (error) {
    console.error(
      "================================="
    );

    console.error(
      "[CHAT] CHAT API ERROR"
    );

    console.error(error);

    console.error(
      "================================="
    );

    return NextResponse.json(
      {
        error:
          error instanceof
          Error
            ? error.message
            : "Something went wrong while generating the response.",
      },
      { status: 500 }
    );
  }
}