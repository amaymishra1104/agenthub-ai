export const runtime = "nodejs";
export const maxDuration = 60;
import Groq from "groq-sdk";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { generateEmbedding } from "@/lib/embeddings";

export async function POST(request: Request) {
  try {
    // ------------------------------------------
    // 1. Check Groq API key
    // ------------------------------------------

    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "GROQ_API_KEY is not available on the server.",
        },
        { status: 500 }
      );
    }

    const groq = new Groq({
      apiKey,
    });

    // ------------------------------------------
    // 2. Create Supabase client
    // ------------------------------------------

    const supabase = await createClient();

    // ------------------------------------------
    // 3. Get authenticated user
    // ------------------------------------------

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "You must be logged in.",
        },
        { status: 401 }
      );
    }

    // ------------------------------------------
    // 4. Read request body
    // ------------------------------------------

    const body = await request.json();

    const agentId = body.agentId;
    const message = body.message;
    const requestedConversationId =
      body.conversationId;

    if (
      !agentId ||
      typeof agentId !== "string"
    ) {
      return NextResponse.json(
        {
          error: "Agent ID is required.",
        },
        { status: 400 }
      );
    }

    if (
      !message ||
      typeof message !== "string"
    ) {
      return NextResponse.json(
        {
          error: "Message is required.",
        },
        { status: 400 }
      );
    }

    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
      return NextResponse.json(
        {
          error: "Message cannot be empty.",
        },
        { status: 400 }
      );
    }

    // ------------------------------------------
    // 5. Verify agent ownership
    // ------------------------------------------

    const {
      data: project,
      error: projectError,
    } = await supabase
      .from("projects")
      .select("id, name")
      .eq("id", agentId)
      .eq("user_id", user.id)
      .single();

    if (projectError || !project) {
      console.error(
        "Project error:",
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

    // ------------------------------------------
    // 6. Get system prompt
    // ------------------------------------------

    const {
      data: prompt,
      error: promptError,
    } = await supabase
      .from("prompts")
      .select("content")
      .eq("project_id", project.id)
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (promptError) {
      console.error(
        "Prompt error:",
        promptError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load the agent's system prompt.",
        },
        { status: 500 }
      );
    }

    const systemPrompt =
      prompt?.content ||
      "You are a helpful AI assistant.";

    // ------------------------------------------
    // 7. Verify/select conversation
    // ------------------------------------------

    if (
      !requestedConversationId ||
      typeof requestedConversationId !==
        "string"
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
      error: conversationError,
    } = await supabase
      .from("conversations")
      .select(
        "id, project_id, title, created_at, updated_at"
      )
      .eq("id", requestedConversationId)
      .eq("project_id", project.id)
      .single();

    if (
      conversationError ||
      !conversation
    ) {
      console.error(
        "Conversation error:",
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

    // ------------------------------------------
    // 8. Load previous messages
    // ------------------------------------------

    const {
      data: previousMessages,
      error: historyError,
    } = await supabase
      .from("messages")
      .select("role, content")
      .eq(
        "conversation_id",
        conversationId
      )
      .order("created_at", {
        ascending: true,
      });

    if (historyError) {
      console.error(
        "History error:",
        historyError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load conversation history: " +
            historyError.message,
        },
        { status: 500 }
      );
    }

    // ------------------------------------------
    // 9. Save user message
    // ------------------------------------------

    const userMessageId = randomUUID();

    const userMessage = {
      id: userMessageId,
      conversation_id: conversationId,
      role: "user" as const,
      content: trimmedMessage,
      created_at: new Date().toISOString(),
    };

    const {
      error: userMessageInsertError,
    } = await supabase
      .from("messages")
      .insert({
        id: userMessage.id,
        conversation_id:
          userMessage.conversation_id,
        role: userMessage.role,
        content: userMessage.content,
        created_at:
          userMessage.created_at,
      });

    if (userMessageInsertError) {
      console.error(
        "User message insert error:",
        userMessageInsertError
      );

      return NextResponse.json(
        {
          error:
            "Unable to save your message: " +
            userMessageInsertError.message,
        },
        { status: 500 }
      );
    }

    // ------------------------------------------
    // 10. Search knowledge base
    // ------------------------------------------

    let knowledgeContext = "";

    try {
      console.log(
        "Generating knowledge query embedding..."
      );

      const queryEmbedding =
        await generateEmbedding(
          trimmedMessage
        );

      console.log(
        "Query embedding dimensions:",
        queryEmbedding.length
      );

      if (
        queryEmbedding.length !== 384
      ) {
        throw new Error(
          `Expected 384 dimensions but received ${queryEmbedding.length}.`
        );
      }

      console.log(
        "Searching knowledge base..."
      );

      const {
        data: knowledgeMatches,
        error: knowledgeSearchError,
      } = await supabase.rpc(
        "match_knowledge_chunks",
        {
          query_embedding:
            queryEmbedding,
          match_project_id:
            project.id,
          match_count: 5,
        }
      );

      if (knowledgeSearchError) {
        throw new Error(
          knowledgeSearchError.message
        );
      }

      const matches =
        Array.isArray(knowledgeMatches)
          ? knowledgeMatches
          : [];

      console.log(
        "Knowledge matches found:",
        matches.length
      );

      // ----------------------------------------
      // Similarity threshold
      // ----------------------------------------

      const relevantMatches =
        matches.filter(
          (match: {
            similarity?: number;
            content?: string;
          }) =>
            typeof match.similarity ===
              "number" &&
            match.similarity >= 0.70 &&
            typeof match.content ===
              "string" &&
            match.content.trim()
        );

      console.log(
        "Relevant knowledge matches:",
        relevantMatches.length
      );

      if (
        relevantMatches.length > 0
      ) {
        knowledgeContext =
          relevantMatches
            .map(
              (
                match: {
                  content: string;
                  similarity: number;
                },
                index: number
              ) =>
                `[Knowledge Source ${
                  index + 1
                } | similarity: ${match.similarity.toFixed(
                  3
                )}]\n${match.content}`
            )
            .join("\n\n");
      }
    } catch (knowledgeError) {
      // ----------------------------------------
      // Knowledge search failure
      // ----------------------------------------
      //
      // We don't want a temporary vector-search
      // problem to completely destroy the existing
      // chatbot functionality.
      //
      // Groq can still answer using the system
      // prompt and conversation history.

      console.error(
        "Knowledge search failed:",
        knowledgeError
      );

      knowledgeContext = "";
    }

    // ------------------------------------------
    // 11. Build Groq message history
    // ------------------------------------------

    const historyForGroq =
      (previousMessages || []).map(
        (msg) => ({
          role:
            msg.role === "assistant"
              ? ("assistant" as const)
              : ("user" as const),
          content: msg.content,
        })
      );

    // ------------------------------------------
    // 12. Build RAG-aware system prompt
    // ------------------------------------------

    let ragSystemPrompt =
      systemPrompt;

    if (knowledgeContext) {
      ragSystemPrompt = `${systemPrompt}

IMPORTANT KNOWLEDGE-BASE INSTRUCTIONS:

You have access to the following knowledge retrieved from this agent's knowledge base.

Use this information when it is relevant to the user's question.

Do not invent facts that are not supported by the knowledge base.

If the knowledge base contains the answer, prefer the knowledge-base information over unsupported assumptions.

If the knowledge base does not contain enough information to answer a question, be honest about that rather than making up a specific policy, price, date, or fact.

KNOWLEDGE BASE CONTEXT:

${knowledgeContext}`;
    } else {
      ragSystemPrompt = `${systemPrompt}

IMPORTANT:

No sufficiently relevant knowledge-base information was found for the current user question.

Do not pretend that the knowledge base contains an answer when it does not.

If you cannot answer confidently from your instructions and conversation context, say so honestly.`;
    }

    historyForGroq.push({
      role: "user",
      content: trimmedMessage,
    });

    // ------------------------------------------
    // 13. Start Groq streaming
    // ------------------------------------------

    console.log(
      "Starting Groq stream..."
    );

    console.log(
      "Agent:",
      project.name
    );

    console.log(
      "Conversation:",
      conversationId
    );

    console.log(
      "RAG context available:",
      Boolean(knowledgeContext)
    );

    const stream =
      await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",

        messages: [
          {
            role: "system",
            content: ragSystemPrompt,
          },
          ...historyForGroq,
        ],

        temperature: 0.7,
        max_tokens: 1000,

        stream: true,
      });

    // ------------------------------------------
    // 14. Create readable stream
    // ------------------------------------------

    const encoder =
      new TextEncoder();

    let fullResponse = "";

    const readableStream =
      new ReadableStream({
        async start(controller) {
          try {
            // ------------------------------------
            // Send saved user message
            // ------------------------------------

            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  type: "user_message",
                  message:
                    userMessage,
                }) + "\n"
              )
            );

            // ------------------------------------
            // Stream Groq chunks
            // ------------------------------------

            for await (
              const chunk of stream
            ) {
              const content =
                chunk.choices[0]
                  ?.delta?.content;

              if (!content) {
                continue;
              }

              fullResponse += content;

              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    type: "chunk",
                    content,
                  }) + "\n"
                )
              );
            }

            // ------------------------------------
            // Save complete assistant response
            // ------------------------------------

            if (!fullResponse.trim()) {
              throw new Error(
                "Groq returned an empty response."
              );
            }

            const assistantMessageId =
              randomUUID();

            const assistantMessage = {
              id: assistantMessageId,
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
            } = await supabase
              .from("messages")
              .insert({
                id: assistantMessage.id,
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
                "The AI responded, but we could not save its response: " +
                  assistantMessageInsertError.message
              );
            }

            // ------------------------------------
            // Update conversation timestamp
            // ------------------------------------

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

            // ------------------------------------
            // Tell client stream is complete
            // ------------------------------------

            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  type: "complete",
                  assistantMessage,
                  conversation: {
                    id: conversationId,
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
              "Streaming error:",
              error
            );

            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  type: "error",
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

    // ------------------------------------------
    // 15. Return streaming response
    // ------------------------------------------

    return new Response(
      readableStream,
      {
        status: 200,

        headers: {
          "Content-Type":
            "application/x-ndjson; charset=utf-8",

          "Cache-Control":
            "no-cache, no-transform",

          Connection: "keep-alive",
        },
      }
    );
  } catch (error) {
    console.error(
      "================================="
    );

    console.error(
      "CHAT API ERROR"
    );

    console.error(error);

    console.error(
      "================================="
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong while generating the response.",
      },
      { status: 500 }
    );
  }
}