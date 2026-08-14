"use client";

import { useState } from "react";

type AgentConfigurationProps = {
  agentId: string;
  initialName: string;
  initialDescription: string;
  initialPrompt: string;
};

export default function AgentConfiguration({
  agentId,
  initialName,
  initialDescription,
  initialPrompt,
}: AgentConfigurationProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] =
    useState(initialDescription);
  const [prompt, setPrompt] = useState(initialPrompt);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(
        `/api/agents/${agentId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            description,
            prompt,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to save agent configuration."
        );
      }

      setMessage("Agent configuration saved successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save agent configuration."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-gray-950">
          Agent Configuration
        </h2>

        <p className="mt-1 text-sm leading-6 text-gray-500">
          Configure your agent's identity and behavior.
          These instructions are used when generating
          responses.
        </p>
      </div>

      <div className="mt-6 space-y-6">
        {/* Agent Name */}

        <div>
          <label
            htmlFor="agent-name"
            className="block text-sm font-medium text-gray-900"
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
            placeholder="e.g. Customer Support Agent"
            className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
          />
        </div>

        {/* Description */}

        <div>
          <label
            htmlFor="agent-description"
            className="block text-sm font-medium text-gray-900"
          >
            Description
          </label>

          <textarea
            id="agent-description"
            value={description}
            onChange={(event) =>
              setDescription(event.target.value)
            }
            placeholder="Describe what this agent does."
            rows={3}
            className="mt-2 w-full resize-y rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm leading-6 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
          />
        </div>

        {/* System Instructions */}

        <div>
          <div className="flex items-center justify-between gap-4">
            <label
              htmlFor="agent-prompt"
              className="block text-sm font-medium text-gray-900"
            >
              System Instructions
            </label>

            <span className="text-xs text-gray-400">
              {prompt.length} characters
            </span>
          </div>

          <textarea
            id="agent-prompt"
            value={prompt}
            onChange={(event) =>
              setPrompt(event.target.value)
            }
            placeholder={`Example:

You are a helpful customer support agent.

Use the provided knowledge base when answering
company-specific questions.

If the required information is not available,
clearly say that you do not have the information.
Do not invent company-specific facts.`}
            rows={10}
            className="mt-2 w-full resize-y rounded-lg border border-gray-300 bg-white px-4 py-3 font-mono text-sm leading-6 text-gray-900 outline-none transition placeholder:font-sans placeholder:text-gray-400 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
          />

          <p className="mt-2 text-xs leading-5 text-gray-500">
            These instructions define the role, behavior,
            tone, and rules of your AI agent.
          </p>
        </div>
      </div>

      {/* Status */}

      {(message || error) && (
        <div
          className={`mt-5 rounded-lg border px-4 py-3 text-sm ${
            error
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-green-200 bg-green-50 text-green-700"
          }`}
        >
          {error || message}
        </div>
      )}

      {/* Save */}

      <div className="mt-6 flex justify-end border-t border-gray-100 pt-5">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-gray-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </section>
  );
}