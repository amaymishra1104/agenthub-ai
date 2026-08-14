import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import KnowledgeBase from "@/components/knowledge-base";
import AgentChat from "@/components/agent-chat";
import AgentConfiguration from "@/components/agent-configuration";
import { createClient } from "@/lib/supabase/server";

type AgentPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function AgentPage({
  params,
}: AgentPageProps) {
  const { id } = await params;

  const supabase = await createClient();

  // ==========================================
  // AUTHENTICATION
  // ==========================================

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // ==========================================
  // GET AGENT
  // ==========================================

  const { data: project, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !project) {
    notFound();
  }

  // ==========================================
  // GET LATEST SYSTEM PROMPT
  // ==========================================

  const { data: prompt, error: promptError } = await supabase
    .from("prompts")
    .select("content")
    .eq("project_id", project.id)
    .order("updated_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (promptError) {
    console.error("Error fetching agent prompt:", promptError);
  }

  const defaultPrompt = `You are a helpful AI assistant.

Your job is to assist users with their questions and provide accurate, useful responses.

Use the provided knowledge base when answering questions about information specific to this agent or organization.

If the required information is not available in the knowledge base, clearly say that you do not have that information. Do not invent company-specific facts.

Be professional, clear, and helpful.`;

  // ==========================================
  // PAGE
  // ==========================================

  return (
    <main className="min-h-screen bg-gray-50">
      {/* ======================================
          TOP HEADER
      ====================================== */}

      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-6 lg:px-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <Link
                href="/dashboard"
                className="inline-flex items-center text-sm font-medium text-gray-500 transition hover:text-gray-950"
              >
                ← Back to Dashboard
              </Link>

              <div className="mt-4 flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-950 text-lg text-white">
                  ✦
                </div>

                <div className="min-w-0">
                  <h1 className="truncate text-2xl font-bold tracking-tight text-gray-950 sm:text-3xl">
                    {project.name}
                  </h1>

                  <div className="mt-1 flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />

                    <span className="text-xs font-medium text-gray-500">
                      Active AI Agent
                    </span>
                  </div>
                </div>
              </div>

              <p className="mt-4 max-w-3xl text-sm leading-6 text-gray-500">
                {project.description ||
                  "Configure your agent, connect knowledge, and test how it responds to users."}
              </p>
            </div>

            <div className="shrink-0">
              <div className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600">
                Agent Workspace
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ======================================
          WORKSPACE
      ====================================== */}

      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        {/* ====================================
            QUICK OVERVIEW
        ==================================== */}

        <section className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Agent
            </p>

            <p className="mt-2 text-sm font-semibold text-gray-950">
              {project.name}
            </p>

            <p className="mt-1 text-xs text-gray-500">
              Custom AI assistant
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Instructions
            </p>

            <p className="mt-2 text-sm font-semibold text-gray-950">
              {prompt?.content ? "Configured" : "Default"}
            </p>

            <p className="mt-1 text-xs text-gray-500">
              Controls agent behavior
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Knowledge
            </p>

            <p className="mt-2 text-sm font-semibold text-gray-950">
              RAG Enabled
            </p>

            <p className="mt-1 text-xs text-gray-500">
              Ground responses in your documents
            </p>
          </div>
        </section>

        {/* ====================================
            CONFIGURATION
        ==================================== */}

        <section>
          <div className="mb-4">
            <h2 className="text-xl font-semibold tracking-tight text-gray-950">
              Agent Configuration
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Define what your agent is called, what it does, and how it
              should respond.
            </p>
          </div>

          <AgentConfiguration
            agentId={project.id}
            initialName={project.name}
            initialDescription={project.description || ""}
            initialPrompt={prompt?.content || defaultPrompt}
          />
        </section>

        {/* ====================================
            KNOWLEDGE BASE
        ==================================== */}

        <section className="mt-10">
          <div className="mb-4">
            <h2 className="text-xl font-semibold tracking-tight text-gray-950">
              Knowledge Base
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Upload documents that your agent can use to provide
              grounded answers.
            </p>
          </div>

          <KnowledgeBase agentId={project.id} />
        </section>

        {/* ====================================
            CHAT / TESTING
        ==================================== */}

        <section className="mt-10">
          <div className="mb-4">
            <h2 className="text-xl font-semibold tracking-tight text-gray-950">
              Test Your Agent
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Start a conversation and verify your agent's behavior,
              instructions, and knowledge retrieval.
            </p>
          </div>

          <AgentChat agentId={project.id} />
        </section>

        {/* ====================================
            FOOTER
        ==================================== */}

        <div className="mt-12 border-t border-gray-200 pt-6">
          <div className="flex flex-col gap-2 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
            <p className="text-xs text-gray-400">
              AgentHub · Agent configuration, knowledge, and testing
            </p>

            <Link
              href="/dashboard"
              className="text-xs font-medium text-gray-500 transition hover:text-gray-950"
            >
              Back to all agents →
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}