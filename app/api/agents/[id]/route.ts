import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

// ============================================================
// GET AGENT
// ============================================================

export async function GET(
  request: Request,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const supabase = await createClient();

    // ========================================================
    // AUTHENTICATION
    // ========================================================

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          error: "You must be logged in.",
        },
        {
          status: 401,
        }
      );
    }

    // ========================================================
    // VERIFY PROJECT OWNERSHIP
    // ========================================================

    const {
      data: project,
      error: projectError,
    } = await supabase
      .from("projects")
      .select("id, name, description")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (projectError || !project) {
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

    // ========================================================
    // GET LATEST PROMPT
    // ========================================================

    const {
      data: prompt,
      error: promptError,
    } = await supabase
      .from("prompts")
      .select(
        "id, project_id, content, created_at, updated_at"
      )
      .eq("project_id", id)
      .order("updated_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (promptError) {
      console.error(
        "Prompt query error:",
        promptError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load agent instructions.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      agent: project,
      prompt: prompt ?? null,
    });
  } catch (error) {
    console.error(
      "GET /api/agents/[id] error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error.",
      },
      {
        status: 500,
      }
    );
  }
}

// ============================================================
// UPDATE AGENT
// ============================================================

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const body = await request.json();

    const name =
      typeof body.name === "string"
        ? body.name.trim()
        : "";

    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : "";

    const prompt =
      typeof body.prompt === "string"
        ? body.prompt.trim()
        : "";

    // ========================================================
    // VALIDATION
    // ========================================================

    if (!name) {
      return NextResponse.json(
        {
          error: "Agent name is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (!prompt) {
      return NextResponse.json(
        {
          error:
            "System instructions are required.",
        },
        {
          status: 400,
        }
      );
    }

    const supabase = await createClient();

    // ========================================================
    // AUTHENTICATION
    // ========================================================

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          error: "You must be logged in.",
        },
        {
          status: 401,
        }
      );
    }

    // ========================================================
    // VERIFY PROJECT OWNERSHIP
    // ========================================================

    const {
      data: project,
      error: projectError,
    } = await supabase
      .from("projects")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (projectError || !project) {
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

    // ========================================================
    // UPDATE PROJECT
    // ========================================================

    const {
      data: updatedProject,
      error: updateProjectError,
    } = await supabase
      .from("projects")
      .update({
        name,
        description,
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select(
        "id, name, description, created_at, updated_at"
      )
      .single();

    if (updateProjectError) {
      console.error(
        "Project update error:",
        updateProjectError
      );

      return NextResponse.json(
        {
          error:
            "Unable to update agent: " +
            updateProjectError.message,
        },
        {
          status: 500,
        }
      );
    }

    // ========================================================
    // CHECK EXISTING PROMPT
    // ========================================================

    const {
      data: existingPrompt,
      error: existingPromptError,
    } = await supabase
      .from("prompts")
      .select("id")
      .eq("project_id", id)
      .order("updated_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (existingPromptError) {
      console.error(
        "Existing prompt query error:",
        existingPromptError
      );

      return NextResponse.json(
        {
          error:
            "Unable to check existing agent instructions.",
        },
        {
          status: 500,
        }
      );
    }

    // ========================================================
    // UPDATE EXISTING PROMPT
    // ========================================================

    if (existingPrompt) {
      const {
        error: updatePromptError,
      } = await supabase
        .from("prompts")
        .update({
          content: prompt,
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          existingPrompt.id
        );

      if (updatePromptError) {
        console.error(
          "Prompt update error:",
          updatePromptError
        );

        return NextResponse.json(
          {
            error:
              "Agent was updated, but system instructions could not be saved: " +
              updatePromptError.message,
          },
          {
            status: 500,
          }
        );
      }
    }

    // ========================================================
    // CREATE PROMPT IF NONE EXISTS
    // ========================================================

    else {
      const {
        error: insertPromptError,
      } = await supabase
        .from("prompts")
        .insert({
          project_id: id,
          content: prompt,
        });

      if (insertPromptError) {
        console.error(
          "Prompt insert error:",
          insertPromptError
        );

        return NextResponse.json(
          {
            error:
              "Agent was updated, but system instructions could not be created: " +
              insertPromptError.message,
          },
          {
            status: 500,
          }
        );
      }
    }

    // ========================================================
    // SUCCESS
    // ========================================================

    return NextResponse.json({
      success: true,
      agent: updatedProject,
      message:
        "Agent configuration saved successfully.",
    });
  } catch (error) {
    console.error(
      "PATCH /api/agents/[id] error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error.",
      },
      {
        status: 500,
      }
    );
  }
}

// ============================================================
// DELETE AGENT
// ============================================================

export async function DELETE(
  request: Request,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    console.log(
      "================================="
    );

    console.log(
      "DELETE AGENT API CALLED"
    );

    console.log(
      "Agent ID:",
      id
    );

    console.log(
      "================================="
    );

    const supabase =
      await createClient();

    // ========================================================
    // AUTHENTICATION
    // ========================================================

    const {
      data: { user },
      error: authError,
    } =
      await supabase.auth.getUser();

    if (
      authError ||
      !user
    ) {
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

    // ========================================================
    // VERIFY OWNERSHIP
    // ========================================================

    const {
      data: project,
      error: projectError,
    } =
      await supabase
        .from("projects")
        .select(
          "id, name"
        )
        .eq(
          "id",
          id
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
        "Agent ownership check failed:",
        projectError
      );

      return NextResponse.json(
        {
          error:
            "Agent not found or you do not have permission to delete it.",
        },
        {
          status: 404,
        }
      );
    }

    console.log(
      "Deleting agent:",
      project.name
    );

    // ========================================================
    // DELETE MESSAGES
    // ========================================================

    const {
      data: conversations,
      error:
        conversationsFetchError,
    } =
      await supabase
        .from("conversations")
        .select("id")
        .eq(
          "project_id",
          id
        );

    if (
      conversationsFetchError
    ) {
      console.error(
        "Conversation lookup error:",
        conversationsFetchError
      );

      return NextResponse.json(
        {
          error:
            "Unable to prepare agent deletion: " +
            conversationsFetchError.message,
        },
        {
          status: 500,
        }
      );
    }

    const conversationIds =
      (conversations ??
        []).map(
        (
          conversation
        ) =>
          conversation.id
      );

    if (
      conversationIds.length >
      0
    ) {
      const {
        error:
          messagesDeleteError,
      } =
        await supabase
          .from("messages")
          .delete()
          .in(
            "conversation_id",
            conversationIds
          );

      if (
        messagesDeleteError
      ) {
        console.error(
          "Messages deletion error:",
          messagesDeleteError
        );

        return NextResponse.json(
          {
            error:
              "Unable to delete agent messages: " +
              messagesDeleteError.message,
          },
          {
            status: 500,
          }
        );
      }
    }

    // ========================================================
    // DELETE CONVERSATIONS
    // ========================================================

    const {
      error:
        conversationsDeleteError,
    } =
      await supabase
        .from("conversations")
        .delete()
        .eq(
          "project_id",
          id
        );

    if (
      conversationsDeleteError
    ) {
      console.error(
        "Conversations deletion error:",
        conversationsDeleteError
      );

      return NextResponse.json(
        {
          error:
            "Unable to delete agent conversations: " +
            conversationsDeleteError.message,
        },
        {
          status: 500,
        }
      );
    }

    // ========================================================
    // GET KNOWLEDGE DOCUMENTS
    // ========================================================

    const {
      data: documents,
      error:
        documentsFetchError,
    } =
      await supabase
        .from(
          "knowledge_documents"
        )
        .select("id")
        .eq(
          "project_id",
          id
        );

    if (
      documentsFetchError
    ) {
      console.error(
        "Knowledge document lookup error:",
        documentsFetchError
      );

      return NextResponse.json(
        {
          error:
            "Unable to prepare knowledge-base deletion: " +
            documentsFetchError.message,
        },
        {
          status: 500,
        }
      );
    }

    const documentIds =
      (documents ??
        []).map(
        (
          document
        ) =>
          document.id
      );

    // ========================================================
    // DELETE KNOWLEDGE CHUNKS
    // ========================================================

    if (
      documentIds.length >
      0
    ) {
      const {
        error:
          chunksDeleteError,
      } =
        await supabase
          .from(
            "knowledge_chunks"
          )
          .delete()
          .in(
            "document_id",
            documentIds
          );

      if (
        chunksDeleteError
      ) {
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
    }

    // ========================================================
    // DELETE KNOWLEDGE DOCUMENTS
    // ========================================================

    const {
      error:
        documentsDeleteError,
    } =
      await supabase
        .from(
          "knowledge_documents"
        )
        .delete()
        .eq(
          "project_id",
          id
        );

    if (
      documentsDeleteError
    ) {
      console.error(
        "Knowledge documents deletion error:",
        documentsDeleteError
      );

      return NextResponse.json(
        {
          error:
            "Unable to delete knowledge documents: " +
            documentsDeleteError.message,
        },
        {
          status: 500,
        }
      );
    }

    // ========================================================
    // DELETE PROMPTS
    // ========================================================

    const {
      error: promptsDeleteError,
    } =
      await supabase
        .from("prompts")
        .delete()
        .eq(
          "project_id",
          id
        );

    if (
      promptsDeleteError
    ) {
      console.error(
        "Prompts deletion error:",
        promptsDeleteError
      );

      return NextResponse.json(
        {
          error:
            "Unable to delete agent instructions: " +
            promptsDeleteError.message,
        },
        {
          status: 500,
        }
      );
    }

    // ========================================================
    // DELETE PROJECT / AGENT
    // ========================================================

    const {
      error:
        projectDeleteError,
    } =
      await supabase
        .from("projects")
        .delete()
        .eq(
          "id",
          id
        )
        .eq(
          "user_id",
          user.id
        );

    if (
      projectDeleteError
    ) {
      console.error(
        "Project deletion error:",
        projectDeleteError
      );

      return NextResponse.json(
        {
          error:
            "Unable to delete agent: " +
            projectDeleteError.message,
        },
        {
          status: 500,
        }
      );
    }

    // ========================================================
    // SUCCESS
    // ========================================================

    console.log(
      "Agent deleted successfully:",
      id
    );

    console.log(
      "================================="
    );

    return NextResponse.json(
      {
        success: true,

        message:
          "Agent deleted successfully.",

        agentId: id,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "DELETE /api/agents/[id] error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error while deleting agent.",
      },
      {
        status: 500,
      }
    );
  }
}