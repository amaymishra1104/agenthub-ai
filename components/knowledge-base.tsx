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
  embedded?: boolean;
  chunk_count?: number;
  embedded_chunk_count?: number;
};

export default function KnowledgeBase({
  agentId,
}: KnowledgeBaseProps) {
  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const [uploading, setUploading] =
    useState(false);

  const [processingDocumentId, setProcessingDocumentId] =
    useState<string | null>(null);

  const [embeddingDocumentId, setEmbeddingDocumentId] =
    useState<string | null>(null);

  const [deletingDocumentId, setDeletingDocumentId] =
    useState<string | null>(null);

  const [documents, setDocuments] =
    useState<UploadedDocument[]>([]);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  // =========================================================
  // LOAD DOCUMENTS
  // =========================================================

  async function loadDocuments() {
    try {
      setError("");

      const response = await fetch(
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

        throw new Error(
          `Unable to load documents. Status ${response.status}.`
        );
      }

      if (!text.trim()) {
        setDocuments([]);
        return;
      }

      let data: {
        documents?: UploadedDocument[];
        error?: string;
      };

      try {
        data = JSON.parse(text);
      } catch {
        console.error(
          "Documents API returned invalid JSON:",
          text
        );

        throw new Error(
          "The documents API returned an invalid response."
        );
      }

      if (!Array.isArray(data.documents)) {
        setDocuments([]);
        return;
      }

      setDocuments(data.documents);
    } catch (error) {
      console.error(
        "Failed to load documents:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Unable to load knowledge documents."
      );
    }
  }

  // =========================================================
  // LOAD DOCUMENTS WHEN AGENT CHANGES
  // =========================================================

  useEffect(() => {
    loadDocuments();
  }, [agentId]);

  // =========================================================
  // UPLOAD DOCUMENT
  // =========================================================

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

    // -------------------------------------------------------
    // VALIDATE FILE TYPE
    // -------------------------------------------------------

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
      allowedTypes.includes(file.type);

    const validExtension =
      allowedExtensions.some(
        (extension) =>
          fileName.endsWith(extension)
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

    // -------------------------------------------------------
    // VALIDATE FILE SIZE
    // -------------------------------------------------------

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

      // =====================================================
      // STEP 1 — UPLOAD
      // =====================================================

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

      let uploadData: {
        document?: UploadedDocument;
        error?: string;
      };

      try {
        uploadData =
          JSON.parse(uploadText);
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

      // =====================================================
      // ADD DOCUMENT TO UI
      // =====================================================

      setDocuments(
        (current) => [
          {
            ...uploadedDocument,
            embedded: false,
            chunk_count: 0,
            embedded_chunk_count: 0,
          },
          ...current.filter(
            (document) =>
              document.id !==
              uploadedDocument.id
          ),
        ]
      );

      // =====================================================
      // STEP 2 — PROCESS DOCUMENT
      // =====================================================

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

      let processData: {
        chunkCount?: number;
        error?: string;
      };

      try {
        processData =
          JSON.parse(processText);
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

      if (chunkCount === 0) {
        throw new Error(
          "Document processing completed but no knowledge chunks were created."
        );
      }

      setDocuments(
        (current) =>
          current.map(
            (document) =>
              document.id ===
              uploadedDocument.id
                ? {
                    ...document,
                    embedded: false,
                    chunk_count:
                      chunkCount,
                    embedded_chunk_count: 0,
                  }
                : document
          )
      );

      setMessage(
        `Document processed successfully. Created ${chunkCount} ${
          chunkCount === 1
            ? "knowledge chunk"
            : "knowledge chunks"
        }. You can now generate embeddings.`
      );

      // -------------------------------------------------------
      // RESET FILE INPUT
      // -------------------------------------------------------

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

  // =========================================================
  // PROCESS EXISTING DOCUMENT
  // =========================================================

  async function handleProcessDocument(
    documentId: string
  ) {
    try {
      setError("");
      setMessage("");

      setProcessingDocumentId(
        documentId
      );

      setMessage(
        "Processing document and creating knowledge chunks..."
      );

      const response =
        await fetch(
          "/api/knowledge/process",
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

      let data: {
        chunkCount?: number;
        error?: string;
      };

      try {
        data = JSON.parse(text);
      } catch {
        console.error(
          "Process API returned invalid response:",
          text
        );

        throw new Error(
          "The document processing API returned an invalid response."
        );
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
            `Document processing failed with status ${response.status}.`
        );
      }

      const chunkCount =
        typeof data.chunkCount ===
        "number"
          ? data.chunkCount
          : 0;

      if (chunkCount === 0) {
        throw new Error(
          "Document was processed but no knowledge chunks were created."
        );
      }

      setDocuments(
        (current) =>
          current.map(
            (document) =>
              document.id ===
              documentId
                ? {
                    ...document,
                    embedded: false,
                    chunk_count:
                      chunkCount,
                    embedded_chunk_count: 0,
                  }
                : document
          )
      );

      setMessage(
        `Document processed successfully. Created ${chunkCount} ${
          chunkCount === 1
            ? "knowledge chunk"
            : "knowledge chunks"
        }. You can now generate embeddings.`
      );
    } catch (error) {
      console.error(
        "Document processing error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong while processing the document."
      );

      setMessage("");
    } finally {
      setProcessingDocumentId(
        null
      );
    }
  }

  // =========================================================
  // GENERATE EMBEDDINGS
  // =========================================================

  async function handleGenerateEmbeddings(
    documentId: string
  ) {
    try {
      setError("");
      setMessage("");

      setEmbeddingDocumentId(
        documentId
      );

      setMessage(
        "Generating embeddings... The first run may take a little longer while the embedding model loads."
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

      let data: {
        embeddedCount?: number;
        error?: string;
      };

      try {
        data = JSON.parse(text);
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

      if (embeddedCount === 0) {
        throw new Error(
          "Embedding generation completed but no embeddings were created."
        );
      }

      setDocuments(
        (current) =>
          current.map(
            (document) =>
              document.id ===
              documentId
                ? {
                    ...document,
                    embedded: true,
                    embedded_chunk_count:
                      embeddedCount,
                  }
                : document
          )
      );

      setMessage(
        `Embeddings generated successfully for ${embeddedCount} ${
          embeddedCount === 1
            ? "chunk"
            : "chunks"
        }. This document is now ready for semantic search.`
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

  // =========================================================
  // DELETE DOCUMENT
  // =========================================================

  async function handleDeleteDocument(
    document: UploadedDocument
  ) {
    const confirmed =
      window.confirm(
        `Are you sure you want to delete "${document.file_name}"?\n\nThis will permanently remove the document, its knowledge chunks, embeddings, and stored file.`
      );

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setMessage("");

      setDeletingDocumentId(
        document.id
      );

      const response =
        await fetch(
          `/api/knowledge/documents?documentId=${encodeURIComponent(
            document.id
          )}`,
          {
            method: "DELETE",
          }
        );

      const text =
        await response.text();

      let data: {
        error?: string;
        message?: string;
      } = {};

      if (text.trim()) {
        try {
          data = JSON.parse(text);
        } catch {
          console.error(
            "Delete API returned invalid JSON:",
            text
          );
        }
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
            `Document deletion failed with status ${response.status}.`
        );
      }

      setDocuments(
        (current) =>
          current.filter(
            (item) =>
              item.id !==
              document.id
          )
      );

      setMessage(
        `"${document.file_name}" was deleted successfully.`
      );
    } catch (error) {
      console.error(
        "Document deletion error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong while deleting the document."
      );
    } finally {
      setDeletingDocumentId(
        null
      );
    }
  }

  // =========================================================
  // OPEN FILE PICKER
  // =========================================================

  function openFilePicker() {
    if (
      uploading ||
      processingDocumentId !== null ||
      embeddingDocumentId !== null ||
      deletingDocumentId !== null
    ) {
      return;
    }

    fileInputRef.current?.click();
  }

  // =========================================================
  // FILE TYPE LABEL
  // =========================================================

  function getFileTypeLabel(
    fileType: string | null
  ) {
    if (!fileType) {
      return "Document";
    }

    if (
      fileType.includes("pdf")
    ) {
      return "PDF document";
    }

    if (
      fileType.includes("markdown")
    ) {
      return "Markdown document";
    }

    if (
      fileType.includes("text")
    ) {
      return "Text document";
    }

    return fileType;
  }

  // =========================================================
  // UI
  // =========================================================

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Knowledge Base
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Upload documents that your AI
            agent can use when answering
            questions.
          </p>
        </div>

        {documents.length > 0 && (
          <div className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
            {documents.length}{" "}
            {documents.length === 1
              ? "document"
              : "documents"}
          </div>
        )}
      </div>

      {/* =====================================================
          UPLOAD AREA
      ===================================================== */}

      <div className="mt-6">
        <button
          type="button"
          onClick={
            openFilePicker
          }
          disabled={
            uploading ||
            processingDocumentId !==
              null ||
            embeddingDocumentId !==
              null ||
            deletingDocumentId !==
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
            PDF, TXT, or Markdown ·
            Maximum 10 MB
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
            processingDocumentId !==
              null ||
            embeddingDocumentId !==
              null ||
            deletingDocumentId !==
              null
          }
          className="hidden"
        />
      </div>

      {/* =====================================================
          SUCCESS MESSAGE
      ===================================================== */}

      {message && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {message}
        </div>
      )}

      {/* =====================================================
          ERROR MESSAGE
      ===================================================== */}

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* =====================================================
          DOCUMENTS
      ===================================================== */}

      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            Documents
          </h3>

          {documents.length > 0 && (
            <span className="text-xs text-gray-500">
              {documents.length}{" "}
              {documents.length === 1
                ? "document"
                : "documents"}
            </span>
          )}
        </div>

        {documents.length === 0 ? (
          <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-xl shadow-sm">
              📚
            </div>

            <p className="mt-3 text-sm font-medium text-gray-700">
              No documents uploaded
              yet.
            </p>

            <p className="mt-1 text-xs text-gray-400">
              Upload your first document
              above to give your agent
              additional knowledge.
            </p>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {documents.map(
              (document) => {
                const isProcessing =
                  processingDocumentId ===
                  document.id;

                const isEmbedding =
                  embeddingDocumentId ===
                  document.id;

                const isDeleting =
                  deletingDocumentId ===
                  document.id;

                const isEmbedded =
                  document.embedded ===
                  true;

                const hasChunks =
                  typeof document.chunk_count ===
                    "number" &&
                  document.chunk_count >
                    0;

                return (
                  <div
                    key={
                      document.id
                    }
                    className="rounded-xl border border-gray-200 bg-white p-4 transition hover:border-gray-300 hover:shadow-sm"
                  >
                    {/* ==========================================
                        DOCUMENT HEADER
                    =========================================== */}

                    <div className="flex items-start justify-between gap-4">
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
                            {getFileTypeLabel(
                              document.file_type
                            )}
                          </p>
                        </div>
                      </div>

                      {/* ========================================
                          STATUS
                      ========================================= */}

                      <div className="flex shrink-0 items-center gap-2">
                        {isDeleting ? (
                          <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                            Deleting...
                          </span>
                        ) : isProcessing ? (
                          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                            Processing...
                          </span>
                        ) : isEmbedding ? (
                          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                            Generating...
                          </span>
                        ) : isEmbedded ? (
                          <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                            ✓ Embedded
                          </span>
                        ) : hasChunks ? (
                          <span className="rounded-full bg-yellow-50 px-2.5 py-1 text-xs font-medium text-yellow-700">
                            Processed
                          </span>
                        ) : (
                          <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                            Processing required
                          </span>
                        )}
                      </div>
                    </div>

                    {/* ==========================================
                        PIPELINE STATUS
                    =========================================== */}

                    <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {/* STEP 1 */}

                      <div className="rounded-lg bg-gray-50 px-3 py-2">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                          Step 1
                        </p>

                        <p className="mt-0.5 text-xs font-medium text-gray-700">
                          ✓ Document uploaded
                        </p>
                      </div>

                      {/* STEP 2 */}

                      <div className="rounded-lg bg-gray-50 px-3 py-2">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                          Step 2
                        </p>

                        <p className="mt-0.5 text-xs font-medium text-gray-700">
                          {hasChunks
                            ? "✓ Document processed"
                            : isProcessing
                            ? "⟳ Processing document"
                            : "○ Processing required"}
                        </p>
                      </div>

                      {/* STEP 3 */}

                      <div className="rounded-lg bg-gray-50 px-3 py-2">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                          Step 3
                        </p>

                        <p className="mt-0.5 text-xs font-medium text-gray-700">
                          {isEmbedded
                            ? "✓ Vector embedding ready"
                            : isEmbedding
                            ? "⟳ Generating vector"
                            : !hasChunks
                            ? "○ Process document first"
                            : "○ Embedding required"}
                        </p>
                      </div>
                    </div>

                    {/* ==========================================
                        ACTIONS
                    =========================================== */}

                    <div className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        {isEmbedded ? (
                          <>
                            <p className="text-sm font-medium text-gray-800">
                              Ready for semantic
                              search
                            </p>

                            <p className="mt-0.5 text-xs text-gray-500">
                              {document.embedded_chunk_count ??
                                document.chunk_count ??
                                0}{" "}
                              vector{" "}
                              {(document.embedded_chunk_count ??
                                document.chunk_count ??
                                0) ===
                              1
                                ? "embedding"
                                : "embeddings"}{" "}
                              stored in the
                              knowledge base.
                            </p>
                          </>
                        ) : !hasChunks ? (
                          <>
                            <p className="text-sm font-medium text-gray-800">
                              Process document into
                              knowledge chunks
                            </p>

                            <p className="mt-0.5 text-xs text-gray-500">
                              Extract text and split
                              this document into chunks
                              before generating
                              embeddings.
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-medium text-gray-800">
                              Convert document chunks
                              into vector embeddings
                            </p>

                            <p className="mt-0.5 text-xs text-gray-500">
                              Embeddings enable
                              semantic search over
                              this document.
                            </p>
                          </>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {/* ======================================
                            MAIN ACTION
                        ======================================= */}

                        {isEmbedded ? (
                          <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs font-medium text-green-700">
                            ✓ Ready
                          </div>
                        ) : !hasChunks ? (
                          <button
                            type="button"
                            onClick={() =>
                              handleProcessDocument(
                                document.id
                              )
                            }
                            disabled={
                              uploading ||
                              processingDocumentId !==
                                null ||
                              embeddingDocumentId !==
                                null ||
                              deletingDocumentId !==
                                null
                            }
                            className="rounded-md bg-black px-4 py-2 text-xs font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isProcessing
                              ? "Processing..."
                              : "Process Document"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              handleGenerateEmbeddings(
                                document.id
                              )
                            }
                            disabled={
                              uploading ||
                              processingDocumentId !==
                                null ||
                              embeddingDocumentId !==
                                null ||
                              deletingDocumentId !==
                                null
                            }
                            className="rounded-md bg-black px-4 py-2 text-xs font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isEmbedding
                              ? "Generating..."
                              : "Generate Embeddings"}
                          </button>
                        )}

                        {/* ======================================
                            DELETE
                        ======================================= */}

                        <button
                          type="button"
                          onClick={() =>
                            handleDeleteDocument(
                              document
                            )
                          }
                          disabled={
                            uploading ||
                            processingDocumentId !==
                              null ||
                            embeddingDocumentId !==
                              null ||
                            deletingDocumentId !==
                              null
                          }
                          className="rounded-md border border-red-200 bg-white px-4 py-2 text-xs font-medium text-red-600 transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isDeleting
                            ? "Deleting..."
                            : "Delete"}
                        </button>
                      </div>
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