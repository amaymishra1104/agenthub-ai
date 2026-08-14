import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const STORAGE_BUCKET = "knowledge-base";

export async function GET(request: Request) {
  try {
    console.log("=================================");
    console.log("KNOWLEDGE DOCUMENTS API CALLED");
    console.log("=================================");

    const supabase = await createClient();

    // ========================================
    // GET CURRENT USER
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
        {
          status: 401,
        }
      );
    }

    if (!user) {
      return NextResponse.json(
        {
          error: "You must be logged in.",
        },
        {
          status: 401,
        }
      );
    }

    // ========================================
    // GET AGENT ID
    // ========================================

    const url = new URL(request.url);

    const agentId =
      url.searchParams.get("agentId");

    if (!agentId) {
      return NextResponse.json(
        {
          error: "agentId is required.",
        },
        {
          status: 400,
        }
      );
    }

    console.log("Agent ID:", agentId);

    // ========================================
    // VERIFY AGENT OWNERSHIP
    // ========================================

    const {
      data: project,
      error: projectError,
    } = await supabase
      .from("projects")
      .select("id")
      .eq("id", agentId)
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
    } = await supabase
      .from("knowledge_documents")
      .select(
        "id, file_name, file_type, file_path, created_at"
      )
      .eq("project_id", agentId)
      .order("created_at", {
        ascending: false,
      });

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
        (document) => document.id
      );

    let chunkStatus: {
      id: string;
      document_id: string;
      embedding: unknown;
    }[] = [];

    if (documentIds.length > 0) {
      const {
        data: chunks,
        error: chunksError,
      } = await supabase
        .from("knowledge_chunks")
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

      chunkStatus = chunks ?? [];
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
                chunk.embedding !== null
            ).length;

          return {
            id: document.id,
            file_name:
              document.file_name,
            file_type:
              document.file_type,
            created_at:
              document.created_at,

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

// ======================================================
// DELETE DOCUMENT
// ======================================================

export async function DELETE(
  request: Request
) {
  try {
    console.log("=================================");
    console.log("DELETE KNOWLEDGE DOCUMENT API");
    console.log("=================================");

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
          error: authError.message,
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
    // GET DOCUMENT ID
    // ========================================

    const url =
      new URL(request.url);

    const documentId =
      url.searchParams.get(
        "documentId"
      );

    if (!documentId) {
      return NextResponse.json(
        {
          error:
            "documentId is required.",
        },
        {
          status: 400,
        }
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
    } =
      await supabase
        .from("knowledge_documents")
        .select(
          "id, project_id, file_path, file_name"
        )
        .eq(
          "id",
          documentId
        )
        .single();

    if (
      documentError ||
      !document
    ) {
      console.error(
        "Document lookup error:",
        documentError
      );

      return NextResponse.json(
        {
          error:
            "Document not found.",
        },
        {
          status: 404,
        }
      );
    }

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
        .eq(
          "id",
          document.project_id
        )
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
        "Project ownership error:",
        projectError
      );

      return NextResponse.json(
        {
          error:
            "You do not have permission to delete this document.",
        },
        {
          status: 403,
        }
      );
    }

    console.log(
      "Ownership verified for user:",
      user.id
    );

    // ========================================
    // DELETE KNOWLEDGE CHUNKS
    // ========================================

    const {
      error: chunksDeleteError,
    } =
      await supabase
        .from("knowledge_chunks")
        .delete()
        .eq(
          "document_id",
          documentId
        );

    if (chunksDeleteError) {
      console.error(
        "Knowledge chunks deletion error:",
        chunksDeleteError
      );

      return NextResponse.json(
        {
          error:
            "Unable to delete knowledge chunks: " +
            chunksDeleteError.message,
        },
        {
          status: 500,
        }
      );
    }

    console.log(
      "Knowledge chunks deleted."
    );

    // ========================================
    // DELETE FILE FROM SUPABASE STORAGE
    // ========================================

    if (document.file_path) {
      console.log(
        "Deleting storage file:",
        document.file_path
      );

      const {
        error: storageError,
      } =
        await supabase.storage
          .from(
            STORAGE_BUCKET
          )
          .remove([
            document.file_path,
          ]);

      if (storageError) {
        console.error(
          "Storage deletion error:",
          storageError
        );

        return NextResponse.json(
          {
            error:
              "Unable to delete the stored file: " +
              storageError.message,
          },
          {
            status: 500,
          }
        );
      }

      console.log(
        "Storage file deleted."
      );
    }

    // ========================================
    // DELETE DOCUMENT RECORD
    // ========================================

    const {
      error: deleteDocumentError,
    } =
      await supabase
        .from(
          "knowledge_documents"
        )
        .delete()
        .eq(
          "id",
          documentId
        );

    if (deleteDocumentError) {
      console.error(
        "Document record deletion error:",
        deleteDocumentError
      );

      return NextResponse.json(
        {
          error:
            "File was removed from storage, but the document record could not be deleted: " +
            deleteDocumentError.message,
        },
        {
          status: 500,
        }
      );
    }

    // ========================================
    // SUCCESS
    // ========================================

    console.log(
      "Document deleted successfully:",
      document.file_name
    );

    return NextResponse.json(
      {
        success: true,
        message:
          "Document deleted successfully.",
        documentId,
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
      "DELETE KNOWLEDGE DOCUMENT API ERROR"
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
            : "Unexpected error while deleting document.",
      },
      {
        status: 500,
      }
    );
  }
}