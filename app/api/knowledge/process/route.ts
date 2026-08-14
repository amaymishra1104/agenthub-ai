import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import { createClient } from "@/lib/supabase/server";

function splitTextIntoChunks(
  text: string,
  chunkSize = 1200,
  overlap = 200
): string[] {
  const cleanedText = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!cleanedText) {
    return [];
  }

  const chunks: string[] = [];

  let start = 0;

  while (start < cleanedText.length) {
    let end = Math.min(
      start + chunkSize,
      cleanedText.length
    );

    if (end < cleanedText.length) {
      const paragraphBreak =
        cleanedText.lastIndexOf(
          "\n\n",
          end
        );

      const sentenceBreak =
        cleanedText.lastIndexOf(
          ". ",
          end
        );

      const spaceBreak =
        cleanedText.lastIndexOf(
          " ",
          end
        );

      if (
        paragraphBreak >
        start + chunkSize * 0.6
      ) {
        end = paragraphBreak;
      } else if (
        sentenceBreak >
        start + chunkSize * 0.6
      ) {
        end = sentenceBreak + 1;
      } else if (
        spaceBreak >
        start + chunkSize * 0.6
      ) {
        end = spaceBreak;
      }
    }

    const chunk = cleanedText
      .slice(start, end)
      .trim();

    if (chunk) {
      chunks.push(chunk);
    }

    if (end >= cleanedText.length) {
      break;
    }

    start = Math.max(
      end - overlap,
      start + 1
    );
  }

  return chunks;
}

export async function POST(
  request: Request
) {
  try {
    console.log(
      "================================="
    );

    console.log(
      "KNOWLEDGE PROCESS API CALLED"
    );

    console.log(
      "================================="
    );

    // ========================================
    // CREATE SUPABASE CLIENT
    // ========================================

    const supabase =
      await createClient();

    // ========================================
    // GET AUTHENTICATED USER
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

    console.log(
      "Authenticated user:",
      user.id
    );

    // ========================================
    // READ REQUEST BODY
    // ========================================

    const body =
      await request.json();

    const documentId =
      body.documentId;

    if (
      typeof documentId !==
        "string" ||
      !documentId
    ) {
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
        .from(
          "knowledge_documents"
        )
        .select(
          "id, project_id, file_name, file_type, file_path"
        )
        .eq(
          "id",
          documentId
        )
        .single();

    if (documentError) {
      console.error(
        "Document lookup error:",
        documentError
      );

      return NextResponse.json(
        {
          error:
            "Unable to find the document: " +
            documentError.message,
        },
        {
          status: 404,
        }
      );
    }

    if (!document) {
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
    // VERIFY PROJECT OWNERSHIP
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
            "You do not have access to this document.",
        },
        {
          status: 403,
        }
      );
    }

    // ========================================
    // DOWNLOAD FILE FROM STORAGE
    // ========================================

    console.log(
      "Downloading file:",
      document.file_path
    );

    const {
      data: fileData,
      error: downloadError,
    } =
      await supabase.storage
        .from(
          "knowledge-base"
        )
        .download(
          document.file_path
        );

    if (downloadError) {
      console.error(
        "Storage download error:",
        downloadError
      );

      return NextResponse.json(
        {
          error:
            "Unable to download the document: " +
            downloadError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (!fileData) {
      return NextResponse.json(
        {
          error:
            "The document file is empty.",
        },
        {
          status: 400,
        }
      );
    }

    // ========================================
    // CONVERT FILE TO BUFFER
    // ========================================

    const buffer =
      Buffer.from(
        await fileData.arrayBuffer()
      );

    console.log(
      "File size:",
      buffer.length,
      "bytes"
    );

    // ========================================
    // EXTRACT TEXT
    // ========================================

    let extractedText = "";

    const fileName =
      document.file_name.toLowerCase();

    if (
      fileName.endsWith(".pdf")
    ) {
      console.log(
        "Extracting PDF text..."
      );

      const parser =
        new PDFParse({
          data: buffer,
        });

      try {
        const result =
          await parser.getText();

        extractedText =
          result.text || "";
      } finally {
        await parser.destroy();
      }
    } else if (
      fileName.endsWith(".txt") ||
      fileName.endsWith(".md")
    ) {
      console.log(
        "Reading text/markdown file..."
      );

      extractedText =
        buffer.toString(
          "utf-8"
        );
    } else {
      return NextResponse.json(
        {
          error:
            "Unsupported file type. Only PDF, TXT, and Markdown files are supported.",
        },
        {
          status: 400,
        }
      );
    }

    extractedText =
      extractedText.trim();

    console.log(
      "Extracted characters:",
      extractedText.length
    );

    // ========================================
    // CHECK EXTRACTED TEXT
    // ========================================

    if (!extractedText) {
      return NextResponse.json(
        {
          error:
            "No readable text was found in the document.",
        },
        {
          status: 400,
        }
      );
    }

    // ========================================
    // SPLIT TEXT INTO CHUNKS
    // ========================================

    console.log(
      "Creating knowledge chunks..."
    );

    const chunks =
      splitTextIntoChunks(
        extractedText
      );

    console.log(
      "Created chunks:",
      chunks.length
    );

    if (chunks.length === 0) {
      return NextResponse.json(
        {
          error:
            "The document could not be divided into text chunks.",
        },
        {
          status: 400,
        }
      );
    }

    // ========================================
    // DELETE EXISTING CHUNKS
    // ========================================

    const {
      error: deleteError,
    } =
      await supabase
        .from(
          "knowledge_chunks"
        )
        .delete()
        .eq(
          "document_id",
          document.id
        );

    if (deleteError) {
      console.error(
        "Old chunks delete error:",
        deleteError
      );

      return NextResponse.json(
        {
          error:
            "Unable to clear previous document chunks: " +
            deleteError.message,
        },
        {
          status: 500,
        }
      );
    }

    // ========================================
    // PREPARE CHUNK ROWS
    // ========================================

    const rows =
      chunks.map(
        (
          content,
          index
        ) => ({
          document_id:
            document.id,

          project_id:
            document.project_id,

          content,

          chunk_index:
            index,

          // Embeddings will be added
          // in the next RAG step.
          embedding: null,
        })
      );

    // ========================================
    // SAVE CHUNKS
    // ========================================

    const {
      error: insertError,
    } =
      await supabase
        .from(
          "knowledge_chunks"
        )
        .insert(rows);

    if (insertError) {
      console.error(
        "Chunk insert error:",
        insertError
      );

      return NextResponse.json(
        {
          error:
            "Unable to save document chunks: " +
            insertError.message,
        },
        {
          status: 500,
        }
      );
    }

    console.log(
      "Chunks saved successfully."
    );

    // ========================================
    // SUCCESS
    // ========================================

    return NextResponse.json(
      {
        success: true,

        documentId:
          document.id,

        fileName:
          document.file_name,

        extractedCharacters:
          extractedText.length,

        chunkCount:
          chunks.length,
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
      "KNOWLEDGE PROCESSING ERROR"
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
            : "Unexpected document processing error.",
      },
      {
        status: 500,
      }
    );
  }
}