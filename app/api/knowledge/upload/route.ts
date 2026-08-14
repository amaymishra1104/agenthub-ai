import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request
) {
  try {
    console.log(
      "================================="
    );

    console.log(
      "KNOWLEDGE UPLOAD API CALLED"
    );

    console.log(
      "================================="
    );

    // ----------------------------------------
    // Supabase server client
    // ----------------------------------------

    const supabase =
      await createClient();

    // ----------------------------------------
    // Check authenticated user
    // ----------------------------------------

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

    console.log(
      "Authenticated user:",
      user.id
    );

    // ----------------------------------------
    // Read multipart form data
    // ----------------------------------------

    const formData =
      await request.formData();

    const file =
      formData.get("file");

    const agentId =
      formData.get("agentId");

    // ----------------------------------------
    // Validate file
    // ----------------------------------------

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          error:
            "No file was provided.",
        },
        { status: 400 }
      );
    }

    // ----------------------------------------
    // Validate agent ID
    // ----------------------------------------

    if (
      typeof agentId !==
        "string" ||
      !agentId
    ) {
      return NextResponse.json(
        {
          error:
            "Agent ID is required.",
        },
        { status: 400 }
      );
    }

    console.log(
      "Agent ID:",
      agentId
    );

    console.log(
      "File:",
      file.name
    );

    // ----------------------------------------
    // Validate file size
    // ----------------------------------------

    const maxSize =
      10 * 1024 * 1024;

    if (file.size > maxSize) {
      return NextResponse.json(
        {
          error:
            "File size must be 10 MB or smaller.",
        },
        { status: 400 }
      );
    }

    // ----------------------------------------
    // Validate file extension
    // ----------------------------------------

    const fileName =
      file.name.toLowerCase();

    const allowedExtensions = [
      ".pdf",
      ".txt",
      ".md",
    ];

    const isAllowed =
      allowedExtensions.some(
        (extension) =>
          fileName.endsWith(
            extension
          )
      );

    if (!isAllowed) {
      return NextResponse.json(
        {
          error:
            "Only PDF, TXT, and Markdown files are supported.",
        },
        { status: 400 }
      );
    }

    // ----------------------------------------
    // Verify agent ownership
    // ----------------------------------------

    const {
      data: project,
      error: projectError,
    } =
      await supabase
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
            "Unable to find this agent.",
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

    // ----------------------------------------
    // Convert file to buffer
    // ----------------------------------------

    const fileBuffer =
      Buffer.from(
        await file.arrayBuffer()
      );

    // ----------------------------------------
    // Create unique storage path
    // ----------------------------------------

    const safeFileName =
      file.name
        .replace(
          /[^a-zA-Z0-9._-]/g,
          "_"
        );

    const filePath =
      `${user.id}/${agentId}/${crypto.randomUUID()}-${safeFileName}`;

    console.log(
      "Storage path:",
      filePath
    );

    // ----------------------------------------
    // Upload to Supabase Storage
    // ----------------------------------------

    const {
      error: uploadError,
    } =
      await supabase.storage
        .from("knowledge-base")
        .upload(
          filePath,
          fileBuffer,
          {
            contentType:
              file.type ||
              "application/octet-stream",

            upsert: false,
          }
        );

    if (uploadError) {
      console.error(
        "Storage upload error:",
        uploadError
      );

      return NextResponse.json(
        {
          error:
            "Failed to upload file: " +
            uploadError.message,
        },
        { status: 500 }
      );
    }

    console.log(
      "File uploaded successfully."
    );

    // ----------------------------------------
    // Create database document record
    // ----------------------------------------

    const {
      data: document,
      error: documentError,
    } =
      await supabase
        .from(
          "knowledge_documents"
        )
        .insert({
          project_id:
            project.id,

          file_name:
            file.name,

          file_type:
            file.type ||
            null,

          file_path:
            filePath,
        })
        .select(
          "id, file_name, file_type, created_at"
        )
        .single();

    // ----------------------------------------
    // Roll back storage upload
    // if database insert fails
    // ----------------------------------------

    if (documentError) {
      console.error(
        "Document database error:",
        documentError
      );

      await supabase.storage
        .from("knowledge-base")
        .remove([
          filePath,
        ]);

      return NextResponse.json(
        {
          error:
            "File uploaded but database record could not be created: " +
            documentError.message,
        },
        { status: 500 }
      );
    }

    console.log(
      "Document record created:",
      document.id
    );

    // ----------------------------------------
    // Return successful response
    // ----------------------------------------

    return NextResponse.json(
      {
        success: true,

        document,
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
      "KNOWLEDGE UPLOAD ERROR"
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
            : "Unexpected upload error.",
      },
      {
        status: 500,
      }
    );
  }
}