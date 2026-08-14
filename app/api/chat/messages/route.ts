import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    // ------------------------------------------
    // 1. Get logged-in user
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
    // 2. Get conversation ID
    // ------------------------------------------

    const url = new URL(request.url);

    const conversationId =
      url.searchParams.get(
        "conversationId"
      );

    if (!conversationId) {
      return NextResponse.json(
        {
          error:
            "Conversation ID is required.",
        },
        { status: 400 }
      );
    }

    // ------------------------------------------
    // 3. Verify conversation belongs to
    //    an agent owned by current user
    // ------------------------------------------

    const {
      data: conversation,
      error: conversationError,
    } = await supabase
      .from("conversations")
      .select(
        `
        id,
        project_id,
        title,
        created_at,
        updated_at,
        projects!inner (
          id,
          user_id
        )
        `
      )
      .eq("id", conversationId)
      .single();

    if (
      conversationError ||
      !conversation
    ) {
      return NextResponse.json(
        {
          error:
            "Conversation not found.",
        },
        { status: 404 }
      );
    }

    // ------------------------------------------
    // 4. Verify ownership
    // ------------------------------------------

    const projectData =
      conversation.projects as unknown as
        | {
            id: string;
            user_id: string;
          }
        | {
            id: string;
            user_id: string;
          }[];

    const project = Array.isArray(
      projectData
    )
      ? projectData[0]
      : projectData;

    if (
      !project ||
      project.user_id !== user.id
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have access to this conversation.",
        },
        { status: 403 }
      );
    }

    // ------------------------------------------
    // 5. Load messages
    // ------------------------------------------

    const {
      data: messages,
      error: messagesError,
    } = await supabase
      .from("messages")
      .select(
        "id, conversation_id, role, content, created_at"
      )
      .eq(
        "conversation_id",
        conversationId
      )
      .order("created_at", {
        ascending: true,
      });

    if (messagesError) {
      console.error(
        "Messages error:",
        messagesError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load messages: " +
            messagesError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      conversation: {
        id: conversation.id,
        project_id:
          conversation.project_id,
        title: conversation.title,
        created_at:
          conversation.created_at,
        updated_at:
          conversation.updated_at,
      },
      messages: messages || [],
    });
  } catch (error) {
    console.error(
      "Messages API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load messages.",
      },
      { status: 500 }
    );
  }
}