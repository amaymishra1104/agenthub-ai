"use client";

import {
  ChangeEvent,
  useEffect,
  useRef,
  useState,
} from "react";

type KnowledgeBaseProps = {
  agentId: string;
};

type UploadedDocument = {
  id: string;
  file_name: string;
  file_type: string | null;
  created_at: string;
};

export default function KnowledgeBase({
  agentId,
}: KnowledgeBaseProps) {
  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const [uploading, setUploading] =
    useState(false);

  const [embeddingDocumentId, setEmbeddingDocumentId] =
    useState<string | null>(null);

  const [documents, setDocuments] =
    useState<UploadedDocument[]>([]);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  // ==========================================
  // LOAD EXISTING DOCUMENTS
  // ==========================================

  async function loadDocuments() {
    try {
      setError("");

      const response =
        await fetch(
          `/api/knowledge/documents?agentId=${encodeURIComponent(
            agentId
          )}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

      const text =
        await response.text();

      if (!response.ok) {
        console.error(
          "Documents API error:",
          text
        );

        return;
      }

      if (!text.trim()) {
        return;
      }

      let data;

      try {
        data =
          JSON.parse(text);
      } catch {
        console.error(
          "Documents API returned invalid JSON."
        );

        return;
      }

      if (
        Array.isArray(
          data.documents
        )
      ) {
        setDocuments(
          data.documents
        );
      }
    } catch (error) {
      console.error(
        "Failed to load documents:",
        error
      );
    }
  }

  // ==========================================
  // LOAD DOCUMENTS WHEN AGENT CHANGES
  // ==========================================

  useEffect(() => {
    loadDocuments();
  }, [agentId]);

  // ==========================================
  // UPLOAD DOCUMENT
  // ==========================================

  async function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    setError("");
    setMessage("");

    // ========================================
    // VALIDATE FILE TYPE
    // ========================================

    const allowedTypes = [
      "application/pdf",
      "text/plain",
      "text/markdown",
    ];

    const allowedExtensions = [
      ".pdf",
      ".txt",
      ".md",
    ];

    const fileName =
      file.name.toLowerCase();

    const validType =
      allowedTypes.includes(
        file.type
      );

    const validExtension =
      allowedExtensions.some(
        (extension) =>
          fileName.endsWith(
            extension
          )
      );

    if (
      !validType &&
      !validExtension
    ) {
      setError(
        "Please upload a PDF, TXT, or Markdown file."
      );

      event.target.value = "";

      return;
    }

    // ========================================
    // VALIDATE FILE SIZE
    // ========================================

    const maxSize =
      10 * 1024 * 1024;

    if (file.size > maxSize) {
      setError(
        "File size must be 10 MB or smaller."
      );

      event.target.value = "";

      return;
    }

    try {
      setUploading(true);

      setMessage(
        "Uploading document..."
      );

      // ======================================
      // STEP 1 — UPLOAD FILE
      // ======================================

      const formData =
        new FormData();

      formData.append(
        "file",
        file
      );

      formData.append(
        "agentId",
        agentId
      );

      const uploadResponse =
        await fetch(
          "/api/knowledge/upload",
          {
            method: "POST",
            body: formData,
          }
        );

      const uploadText =
        await uploadResponse.text();

      let uploadData;

      try {
        uploadData =
          JSON.parse(
            uploadText
          );
      } catch {
        console.error(
          "Upload API returned:",
          uploadText
        );

        throw new Error(
          "The upload API returned an invalid response."
        );
      }

      if (!uploadResponse.ok) {
        throw new Error(
          uploadData.error ||
            `Upload failed with status ${uploadResponse.status}.`
        );
      }

      if (
        !uploadData.document ||
        typeof uploadData.document.id !==
          "string"
      ) {
        throw new Error(
          "Upload succeeded, but the API did not return a valid document."
        );
      }

      const uploadedDocument =
        uploadData.document;

      // ======================================
      // ADD DOCUMENT TO UI
      // ======================================

      setDocuments(
        (current) => [
          uploadedDocument,
          ...current.filter(
            (document) =>
              document.id !==
              uploadedDocument.id
          ),
        ]
      );

      // ======================================
      // STEP 2 — PROCESS DOCUMENT
      // ======================================

      setMessage(
        "Upload complete. Processing document..."
      );

      const processResponse =
        await fetch(
          "/api/knowledge/process",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              documentId:
                uploadedDocument.id,
            }),
          }
        );

      const processText =
        await processResponse.text();

      let processData;

      try {
        processData =
          JSON.parse(
            processText
          );
      } catch {
        console.error(
          "Process API returned:",
          processText
        );

        throw new Error(
          "The document processing API returned an invalid response."
        );
      }

      if (!processResponse.ok) {
        throw new Error(
          processData.error ||
            `Document processing failed with status ${processResponse.status}.`
        );
      }

      const chunkCount =
        typeof processData.chunkCount ===
        "number"
          ? processData.chunkCount
          : 0;

      setMessage(
        `Document processed successfully. Created ${chunkCount} knowledge ${
          chunkCount === 1
            ? "chunk"
            : "chunks"
        }.`
      );

      // ======================================
      // RESET FILE INPUT
      // ======================================

      if (
        fileInputRef.current
      ) {
        fileInputRef.current.value =
          "";
      }
    } catch (error) {
      console.error(
        "Knowledge upload/process error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong while uploading the document."
      );

      setMessage("");
    } finally {
      setUploading(false);
    }
  }

  // ==========================================
  // GENERATE EMBEDDINGS
  // ==========================================

  async function handleGenerateEmbeddings(
    documentId: string
  ) {
    try {
      setError("");

      setMessage(
        "Generating embeddings... The first run may take a little longer while the embedding model loads."
      );

      setEmbeddingDocumentId(
        documentId
      );

      const response =
        await fetch(
          "/api/knowledge/embed",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              documentId,
            }),
          }
        );

      const text =
        await response.text();

      let data;

      try {
        data =
          JSON.parse(text);
      } catch {
        console.error(
          "Embedding API returned:",
          text
        );

        throw new Error(
          "The embedding API returned an invalid response."
        );
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
            `Embedding generation failed with status ${response.status}.`
        );
      }

      const embeddedCount =
        typeof data.embeddedCount ===
        "number"
          ? data.embeddedCount
          : 0;

      setMessage(
        `Embeddings generated successfully for ${embeddedCount} ${
          embeddedCount === 1
            ? "chunk"
            : "chunks"
        }.`
      );
    } catch (error) {
      console.error(
        "Embedding generation error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong while generating embeddings."
      );

      setMessage("");
    } finally {
      setEmbeddingDocumentId(
        null
      );
    }
  }

  // ==========================================
  // OPEN FILE PICKER
  // ==========================================

  function openFilePicker() {
    if (uploading) {
      return;
    }

    fileInputRef.current?.click();
  }

  // ==========================================
  // UI
  // ==========================================

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      {/* ====================================== */}
      {/* HEADER */}
      {/* ====================================== */}

      <div>
        <h2 className="text-xl font-semibold text-gray-900">
          Knowledge Base
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          Upload documents that your
          AI agent can use when
          answering questions.
        </p>
      </div>

      {/* ====================================== */}
      {/* UPLOAD AREA */}
      {/* ====================================== */}

      <div className="mt-6">
        <button
          type="button"
          onClick={
            openFilePicker
          }
          disabled={
            uploading ||
            embeddingDocumentId !==
              null
          }
          className="flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 px-6 py-10 text-center transition hover:border-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-lg">
            {uploading
              ? "..."
              : "↑"}
          </div>

          <p className="mt-4 text-sm font-medium text-gray-900">
            {uploading
              ? "Processing document..."
              : "Upload a document"}
          </p>

          <p className="mt-1 text-xs text-gray-500">
            PDF, TXT, or Markdown
            · Maximum 10 MB
          </p>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
          onChange={
            handleFileChange
          }
          disabled={
            uploading ||
            embeddingDocumentId !==
              null
          }
          className="hidden"
        />
      </div>

      {/* ====================================== */}
      {/* SUCCESS MESSAGE */}
      {/* ====================================== */}

      {message && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {message}
        </div>
      )}

      {/* ====================================== */}
      {/* ERROR MESSAGE */}
      {/* ====================================== */}

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ====================================== */}
      {/* DOCUMENT LIST */}
      {/* ====================================== */}

      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            Documents
          </h3>

          {documents.length >
            0 && (
            <span className="text-xs text-gray-500">
              {documents.length}{" "}
              {documents.length ===
              1
                ? "document"
                : "documents"}
            </span>
          )}
        </div>

        {documents.length ===
        0 ? (
          <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
            <p className="text-sm text-gray-500">
              No documents uploaded
              yet.
            </p>

            <p className="mt-1 text-xs text-gray-400">
              Upload your first
              document above.
            </p>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {documents.map(
              (document) => {
                const isEmbedding =
                  embeddingDocumentId ===
                  document.id;

                return (
                  <div
                    key={
                      document.id
                    }
                    className="rounded-lg border border-gray-200 p-4"
                  >
                    {/* ================================ */}
                    {/* DOCUMENT INFO */}
                    {/* ================================ */}

                    <div className="flex items-center justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-lg">
                          📄
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-900">
                            {
                              document.file_name
                            }
                          </p>

                          <p className="mt-0.5 text-xs text-gray-500">
                            {document.file_type ||
                              "Document"}
                          </p>
                        </div>
                      </div>

                      {/* ============================== */}
                      {/* STATUS */}
                      {/* ============================== */}

                      <span className="shrink-0 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                        Processed
                      </span>
                    </div>

                    {/* ================================ */}
                    {/* EMBEDDING ACTION */}
                    {/* ================================ */}

                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
                      <p className="text-xs text-gray-500">
                        Convert this
                        document's chunks
                        into vector
                        embeddings for
                        semantic search.
                      </p>

                      <button
                        type="button"
                        onClick={() =>
                          handleGenerateEmbeddings(
                            document.id
                          )
                        }
                        disabled={
                          uploading ||
                          embeddingDocumentId !==
                            null
                        }
                        className="shrink-0 rounded-md bg-black px-3 py-2 text-xs font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isEmbedding
                          ? "Generating..."
                          : "Generate Embeddings"}
                      </button>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}
      </div>
    </section>
  );
}