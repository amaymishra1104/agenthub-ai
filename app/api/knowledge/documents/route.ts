import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: Request
) {
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

    // ========================================
    // CREATE SUPABASE SERVER CLIENT
    // ========================================

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
    // GET AGENT ID FROM URL
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
        .eq(
          "id",
          agentId
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
    // SUCCESS
    // ========================================

    console.log(
      "Documents found:",
      documents?.length ?? 0
    );

    return NextResponse.json(
      {
        documents:
          documents ?? [],
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