import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    console.log(
      "================================="
    );

    console.log(
      "CREATE CONVERSATION API CALLED"
    );

    console.log(
      "================================="
    );

    // ------------------------------------------
    // Create Supabase server client
    // ------------------------------------------

    const supabase = await createClient();

    // ------------------------------------------
    // Get logged-in user
    // ------------------------------------------

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    console.log(
      "Authenticated user:",
      user?.id
    );

    if (authError) {
      console.error(
        "Auth error:",
        authError
      );

      return NextResponse.json(
        {
          error:
            "Authentication error: " +
            authError.message,
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

    // ------------------------------------------
    // Read request body
    // ------------------------------------------

    const body =
      await request.json();

    const agentId =
      body.agentId;

    console.log(
      "Agent ID:",
      agentId
    );

    if (
      !agentId ||
      typeof agentId !== "string"
    ) {
      return NextResponse.json(
        {
          error:
            "Agent ID is required.",
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

    if (projectError) {
      console.error(
        "Project lookup error:",
        projectError
      );

      return NextResponse.json(
        {
          error:
            "Unable to find the agent: " +
            projectError.message,
        },
        { status: 404 }
      );
    }

    if (!project) {
      return NextResponse.json(
        {
          error:
            "Agent not found or you do not have access to it.",
        },
        { status: 404 }
      );
    }

    // ------------------------------------------
    // Create conversation
    // ------------------------------------------

    const conversationId =
      randomUUID();

    const now =
      new Date().toISOString();

    const conversation = {
      id: conversationId,
      project_id: project.id,
      title: "New Conversation",
      created_at: now,
      updated_at: now,
    };

    console.log(
      "Creating conversation:",
      conversation
    );

    const {
      error: insertError,
    } = await supabase
      .from("conversations")
      .insert(conversation);

    if (insertError) {
      console.error(
        "Conversation insert error:",
        insertError
      );

      return NextResponse.json(
        {
          error:
            "Unable to create conversation: " +
            insertError.message,
        },
        { status: 500 }
      );
    }

    console.log(
      "Conversation created successfully:",
      conversationId
    );

    // ------------------------------------------
    // Return conversation
    // ------------------------------------------

    return NextResponse.json(
      {
        success: true,
        conversation,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "================================="
    );

    console.error(
      "CREATE CONVERSATION ERROR"
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
            : "Unable to create conversation.",
      },
      { status: 500 }
    );
  }
}