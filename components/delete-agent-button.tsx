"use client";

import {
  useState,
} from "react";

import {
  Trash2,
  Loader2,
} from "lucide-react";

type DeleteAgentButtonProps = {
  agentId: string;
  agentName: string;
  onDeleted?: () => void;
};

export default function DeleteAgentButton({
  agentId,
  agentName,
  onDeleted,
}: DeleteAgentButtonProps) {
  const [
    isDeleting,
    setIsDeleting,
  ] = useState(false);

  const [
    showConfirmation,
    setShowConfirmation,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  async function handleDelete() {
    if (isDeleting) {
      return;
    }

    setIsDeleting(true);
    setError("");

    try {
      const response =
        await fetch(
          `/api/agents/${agentId}`,
          {
            method: "DELETE",
            headers: {
              "Content-Type":
                "application/json",
            },
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to delete agent."
        );
      }

      setShowConfirmation(
        false
      );

      if (onDeleted) {
        onDeleted();
      }

      // Refresh the server component
      // so the deleted agent disappears
      // from the dashboard.
      window.location.reload();
    } catch (error) {
      console.error(
        "Delete agent error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Unable to delete agent."
      );

      setIsDeleting(false);
    }
  }

  return (
    <>
      {/* ====================================================
          DELETE BUTTON
      ==================================================== */}

      <button
        type="button"
        onClick={() => {
          setError("");
          setShowConfirmation(
            true
          );
        }}
        className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600 transition hover:border-red-300 hover:bg-red-50"
      >
        <Trash2
          size={16}
        />

        Delete
      </button>

      {/* ====================================================
          CONFIRMATION MODAL
      ==================================================== */}

      {showConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-agent-title"
          >
            {/* Header */}

            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <Trash2
                  size={20}
                />
              </div>

              <div>
                <h2
                  id="delete-agent-title"
                  className="text-lg font-semibold text-gray-950"
                >
                  Delete agent?
                </h2>

                <p className="mt-1 text-sm leading-6 text-gray-500">
                  This will permanently
                  delete{" "}
                  <span className="font-medium text-gray-800">
                    {agentName}
                  </span>
                  , including its
                  conversations,
                  instructions,
                  and knowledge base.
                </p>
              </div>
            </div>

            {/* Warning */}

            <div className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
              <p className="text-xs leading-5 text-red-700">
                This action cannot be
                undone.
              </p>
            </div>

            {/* Error */}

            {error && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm text-red-700">
                  {error}
                </p>
              </div>
            )}

            {/* Actions */}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={
                  isDeleting
                }
                onClick={() => {
                  setShowConfirmation(
                    false
                  );
                  setError("");
                }}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={
                  isDeleting
                }
                onClick={
                  handleDelete
                }
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? (
                  <>
                    <Loader2
                      size={16}
                      className="animate-spin"
                    />

                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2
                      size={16}
                    />

                    Delete Agent
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}