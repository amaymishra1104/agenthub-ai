export const runtime = "nodejs";
export const maxDuration = 60;

import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { generateEmbedding } from "@/lib/embeddings";

export async function POST(request: Request) {
  try {
    console.log("=================================");
    console.log("KNOWLEDGE EMBEDDING API CALLED");
    console.log("=================================");

    const supabase = await createClient();

    // ========================================
    // AUTHENTICATION
    // ========================================

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error(
        "Authentication error:",
        authError
      );

      return NextResponse.json(
        {
          error: authError.message,
        },
        { status: 401 }
      );
    }

    if (!user) {
      return NextResponse.json(
        {
          error: "You must be logged in.",
        },
        { status: 401 }
      );
    }

    // ========================================
    // REQUEST BODY
    // ========================================

    const body = await request.json();

    const documentId = body.documentId;

    if (
      typeof documentId !== "string" ||
      !documentId
    ) {
      return NextResponse.json(
        {
          error: "documentId is required.",
        },
        { status: 400 }
      );
    }

    console.log(
      "Document ID:",
      documentId
    );

    // ========================================
    // GET DOCUMENT
    // ========================================

    const {
      data: document,
      error: documentError,
    } = await supabase
      .from("knowledge_documents")
      .select(
        "id, project_id, file_name"
      )
      .eq("id", documentId)
      .single();

    if (documentError) {
      console.error(
        "Document lookup error:",
        documentError
      );

      return NextResponse.json(
        {
          error:
            "Unable to find document: " +
            documentError.message,
        },
        { status: 404 }
      );
    }

    if (!document) {
      return NextResponse.json(
        {
          error: "Document not found.",
        },
        { status: 404 }
      );
    }

    // ========================================
    // VERIFY PROJECT OWNERSHIP
    // ========================================

    const {
      data: project,
      error: projectError,
    } = await supabase
      .from("projects")
      .select("id")
      .eq("id", document.project_id)
      .eq("user_id", user.id)
      .single();

    if (projectError || !project) {
      console.error(
        "Project ownership error:",
        projectError
      );

      return NextResponse.json(
        {
          error:
            "You do not have access to this document.",
        },
        { status: 403 }
      );
    }

    // ========================================
    // GET CHUNKS
    // ========================================

    const {
      data: chunks,
      error: chunksError,
    } = await supabase
      .from("knowledge_chunks")
      .select(
        "id, content, chunk_index"
      )
      .eq(
        "document_id",
        document.id
      )
      .order("chunk_index", {
        ascending: true,
      });

    if (chunksError) {
      console.error(
        "Chunk lookup error:",
        chunksError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load chunks: " +
            chunksError.message,
        },
        { status: 500 }
      );
    }

    if (
      !chunks ||
      chunks.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "No chunks were found for this document.",
        },
        { status: 400 }
      );
    }

    console.log(
      "Chunks found:",
      chunks.length
    );

    // ========================================
    // GENERATE AND SAVE EMBEDDINGS
    // ========================================

    let processed = 0;

    for (const chunk of chunks) {
      console.log(
        `Generating embedding ${
          chunk.chunk_index + 1
        }/${chunks.length}`
      );

      // --------------------------------------
      // Generate embedding
      // --------------------------------------

      const embedding =
        await generateEmbedding(
          chunk.content
        );

      console.log(
        "Embedding dimensions:",
        embedding.length
      );

      // --------------------------------------
      // Validate dimension
      // --------------------------------------

      if (embedding.length !== 384) {
        throw new Error(
          `Expected 384 dimensions but received ${embedding.length}.`
        );
      }

      // --------------------------------------
      // Save embedding
      // --------------------------------------

      const {
        error: updateError,
      } = await supabase
        .from("knowledge_chunks")
        .update({
          embedding: embedding,
        })
        .eq("id", chunk.id);

      if (updateError) {
        console.error(
          "DATABASE UPDATE ERROR:",
          updateError
        );

        throw new Error(
          `Failed to save embedding: ${updateError.message}`
        );
      }

      console.log(
        "Database update request succeeded."
      );

      // --------------------------------------
      // Verify separately
      // --------------------------------------

      const {
        data: verification,
        error: verificationError,
      } = await supabase
        .from("knowledge_chunks")
        .select("embedding")
        .eq("id", chunk.id)
        .limit(1);

      if (verificationError) {
        console.error(
          "Embedding verification error:",
          verificationError
        );

        throw new Error(
          `Embedding was updated but could not be verified: ${verificationError.message}`
        );
      }

      if (
        !verification ||
        verification.length === 0
      ) {
        throw new Error(
          "Embedding update succeeded, but the chunk could not be found during verification."
        );
      }

      if (
        verification[0].embedding === null
      ) {
        throw new Error(
          "Embedding update returned successfully, but the embedding is still NULL in the database."
        );
      }

      console.log(
        "Embedding successfully verified in database."
      );

      processed++;
    }

    // ========================================
    // SUCCESS
    // ========================================

    console.log("=================================");
    console.log(
      "EMBEDDING PROCESS COMPLETE"
    );
    console.log(
      "Processed:",
      processed
    );
    console.log("=================================");

    return NextResponse.json(
      {
        success: true,
        documentId: document.id,
        fileName: document.file_name,
        chunkCount: chunks.length,
        embeddedCount: processed,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("=================================");
    console.error(
      "KNOWLEDGE EMBEDDING ERROR"
    );
    console.error(error);
    console.error("=================================");

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected embedding error.",
      },
      { status: 500 }
    );
  }
}