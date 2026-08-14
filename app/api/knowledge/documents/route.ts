import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    console.log(
      "================================="
    );

    console.log(
      "KNOWLEDGE DOCUMENTS API CALLED"
    );

    console.log(
      "================================="
    );

    const supabase =
      await createClient();

    // ========================================
    // GET CURRENT USER
    // ========================================

    const {
      data: { user },
      error: authError,
    } =
      await supabase.auth.getUser();

    if (authError) {
      console.error(
        "Authentication error:",
        authError
      );

      return NextResponse.json(
        {
          error:
            authError.message,
        },
        {
          status: 401,
        }
      );
    }

    if (!user) {
      return NextResponse.json(
        {
          error:
            "You must be logged in.",
        },
        {
          status: 401,
        }
      );
    }

    // ========================================
    // GET AGENT ID
    // ========================================

    const url =
      new URL(request.url);

    const agentId =
      url.searchParams.get(
        "agentId"
      );

    if (!agentId) {
      return NextResponse.json(
        {
          error:
            "agentId is required.",
        },
        {
          status: 400,
        }
      );
    }

    console.log(
      "Agent ID:",
      agentId
    );

    // ========================================
    // VERIFY AGENT OWNERSHIP
    // ========================================

    const {
      data: project,
      error: projectError,
    } =
      await supabase
        .from("projects")
        .select("id")
        .eq("id", agentId)
        .eq("user_id", user.id)
        .single();

    if (
      projectError ||
      !project
    ) {
      console.error(
        "Project ownership error:",
        projectError
      );

      return NextResponse.json(
        {
          error:
            "Agent not found or you do not have access to it.",
        },
        {
          status: 404,
        }
      );
    }

    // ========================================
    // GET DOCUMENTS
    // ========================================

    const {
      data: documents,
      error: documentsError,
    } =
      await supabase
        .from(
          "knowledge_documents"
        )
        .select(
          "id, file_name, file_type, created_at"
        )
        .eq(
          "project_id",
          agentId
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        );

    if (documentsError) {
      console.error(
        "Documents query error:",
        documentsError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load knowledge documents: " +
            documentsError.message,
        },
        {
          status: 500,
        }
      );
    }

    // ========================================
    // GET CHUNK / EMBEDDING STATUS
    // ========================================

    const documentIds =
      (documents ?? []).map(
        (document) =>
          document.id
      );

    let chunkStatus:
      {
        id: string;
        document_id: string;
        embedding: unknown;
      }[] = [];

    if (
      documentIds.length > 0
    ) {
      const {
        data: chunks,
        error: chunksError,
      } =
        await supabase
          .from(
            "knowledge_chunks"
          )
          .select(
            "id, document_id, embedding"
          )
          .in(
            "document_id",
            documentIds
          );

      if (chunksError) {
        console.error(
          "Knowledge chunks query error:",
          chunksError
        );

        return NextResponse.json(
          {
            error:
              "Unable to load knowledge chunk status: " +
              chunksError.message,
          },
          {
            status: 500,
          }
        );
      }

      chunkStatus =
        chunks ?? [];
    }

    // ========================================
    // BUILD DOCUMENT STATUS
    // ========================================

    const enrichedDocuments =
      (documents ?? []).map(
        (document) => {
          const chunks =
            chunkStatus.filter(
              (chunk) =>
                chunk.document_id ===
                document.id
            );

          const chunkCount =
            chunks.length;

          const embeddedChunkCount =
            chunks.filter(
              (chunk) =>
                chunk.embedding !==
                null
            ).length;

          return {
            ...document,

            chunk_count:
              chunkCount,

            embedded_chunk_count:
              embeddedChunkCount,

            embedded:
              chunkCount > 0 &&
              embeddedChunkCount ===
                chunkCount,
          };
        }
      );

    // ========================================
    // SUCCESS
    // ========================================

    console.log(
      "Documents found:",
      enrichedDocuments.length
    );

    console.log(
      "Document status:",
      enrichedDocuments.map(
        (document) => ({
          file_name:
            document.file_name,
          chunks:
            document.chunk_count,
          embedded:
            document.embedded_chunk_count,
          ready:
            document.embedded,
        })
      )
    );

    return NextResponse.json(
      {
        documents:
          enrichedDocuments,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "================================="
    );

    console.error(
      "KNOWLEDGE DOCUMENTS API ERROR"
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
            : "Unexpected error while loading documents.",
      },
      {
        status: 500,
      }
    );
  }
}