import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  request: Request,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const supabase = await createClient();

    // ==========================================
    // AUTHENTICATION
    // ==========================================

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

    // ==========================================
    // VERIFY PROJECT OWNERSHIP
    // ==========================================

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

    // ==========================================
    // GET LATEST PROMPT
    // ==========================================

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

    // ==========================================
    // VALIDATION
    // ==========================================

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

    // ==========================================
    // AUTHENTICATION
    // ==========================================

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

    // ==========================================
    // VERIFY PROJECT OWNERSHIP
    // ==========================================

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

    // ==========================================
    // UPDATE PROJECT
    // ==========================================

    const {
      data: updatedProject,
      error: updateProjectError,
    } = await supabase
      .from("projects")
      .update({
        name,
        description,
        updated_at: new Date().toISOString(),
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

    // ==========================================
    // CHECK FOR EXISTING PROMPT
    // ==========================================

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

    // ==========================================
    // UPDATE EXISTING PROMPT
    // ==========================================

    if (existingPrompt) {
      const {
        error: updatePromptError,
      } = await supabase
        .from("prompts")
        .update({
          content: prompt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingPrompt.id);

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

    // ==========================================
    // CREATE PROMPT IF NONE EXISTS
    // ==========================================

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

    // ==========================================
    // SUCCESS
    // ==========================================

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