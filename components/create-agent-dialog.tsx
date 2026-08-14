"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CreateAgentDialog() {
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleCreateAgent() {
    setErrorMessage("");

    // Validate agent name
    if (!name.trim()) {
      setErrorMessage("Please enter an agent name.");
      return;
    }

    setLoading(true);

    try {
      // Get the currently logged-in user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw new Error(userError.message);
      }

      if (!user) {
        throw new Error("You must be logged in to create an agent.");
      }

      // Create the project/agent
      const {
        data: project,
        error: projectError,
      } = await supabase
        .from("projects")
        .insert({
          user_id: user.id,
          name: name.trim(),
          description: description.trim() || null,
        })
        .select()
        .single();

      if (projectError) {
        throw new Error(projectError.message);
      }

      if (!project) {
        throw new Error("Failed to create the agent.");
      }

      // Create the system prompt associated with the project
      const { error: promptError } = await supabase
        .from("prompts")
        .insert({
          project_id: project.id,
          content:
            systemPrompt.trim() ||
            "You are a helpful AI assistant.",
        });

      if (promptError) {
        // If prompt creation fails, remove the project
        // so we don't leave an incomplete agent behind.
        await supabase
          .from("projects")
          .delete()
          .eq("id", project.id);

        throw new Error(promptError.message);
      }

      // Reset form
      setName("");
      setDescription("");
      setSystemPrompt("");

      // Close modal
      setOpen(false);

      // Refresh the server-rendered dashboard
      router.refresh();
    } catch (error) {
      console.error("Error creating agent:", error);

      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(
          "Something went wrong while creating the agent."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    if (loading) {
      return;
    }

    setOpen(false);
    setErrorMessage("");
  }

  return (
    <>
      {/* Create Agent Button */}
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
      >
        + Create Agent
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            {/* Header */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Create Agent
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Configure your new AI agent.
              </p>
            </div>

            {/* Form */}
            <div className="mt-6 space-y-4">
              {/* Agent Name */}
              <div>
                <label
                  htmlFor="agent-name"
                  className="text-sm font-medium text-gray-900"
                >
                  Agent Name
                </label>

                <input
                  id="agent-name"
                  type="text"
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  placeholder="Customer Support Agent"
                  disabled={loading}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-gray-500 focus:ring-1 focus:ring-gray-500 disabled:cursor-not-allowed disabled:bg-gray-100"
                />
              </div>

              {/* Description */}
              <div>
                <label
                  htmlFor="agent-description"
                  className="text-sm font-medium text-gray-900"
                >
                  Description
                </label>

                <input
                  id="agent-description"
                  type="text"
                  value={description}
                  onChange={(event) =>
                    setDescription(event.target.value)
                  }
                  placeholder="Helps customers with orders"
                  disabled={loading}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-gray-500 focus:ring-1 focus:ring-gray-500 disabled:cursor-not-allowed disabled:bg-gray-100"
                />
              </div>

              {/* System Prompt */}
              <div>
                <label
                  htmlFor="system-prompt"
                  className="text-sm font-medium text-gray-900"
                >
                  System Prompt
                </label>

                <textarea
                  id="system-prompt"
                  value={systemPrompt}
                  onChange={(event) =>
                    setSystemPrompt(event.target.value)
                  }
                  placeholder="You are a helpful customer support agent..."
                  rows={6}
                  disabled={loading}
                  className="mt-1 w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-gray-500 focus:ring-1 focus:ring-gray-500 disabled:cursor-not-allowed disabled:bg-gray-100"
                />
              </div>

              {/* Error */}
              {errorMessage && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {errorMessage}
                </div>
              )}
            </div>

            {/* Buttons */}
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={handleClose}
                disabled={loading}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                onClick={handleCreateAgent}
                disabled={loading}
                className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}