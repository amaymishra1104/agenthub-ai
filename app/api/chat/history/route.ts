import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

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

    const url = new URL(request.url);

    const agentId =
      url.searchParams.get("agentId");

    if (!agentId) {
      return NextResponse.json(
        {
          error: "Agent ID is required.",
        },
        { status: 400 }
      );
    }

    // ------------------------------------------
    // Verify agent ownership
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
      return NextResponse.json(
        {
          error:
            "Agent not found or you do not have access to it.",
        },
        { status: 404 }
      );
    }

    // ------------------------------------------
    // Get ALL conversations for this agent
    // ------------------------------------------

    const {
      data: conversations,
      error: conversationsError,
    } = await supabase
      .from("conversations")
      .select(
        "id, project_id, title, created_at, updated_at"
      )
      .eq("project_id", project.id)
      .order("updated_at", {
        ascending: false,
      });

    if (conversationsError) {
      console.error(
        "Conversations error:",
        conversationsError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load conversations: " +
            conversationsError.message,
        },
        { status: 500 }
      );
    }

    // ------------------------------------------
    // Return conversations
    // ------------------------------------------

    return NextResponse.json({
      conversations: conversations || [],
    });
  } catch (error) {
    console.error(
      "History API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load conversations.",
      },
      { status: 500 }
    );
  }
}