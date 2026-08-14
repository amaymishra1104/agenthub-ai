import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import KnowledgeBase from "@/components/knowledge-base";
import AgentChat from "@/components/agent-chat";
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
  // GET CURRENT USER
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

  const {
    data: project,
    error,
  } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  // ==========================================
  // AGENT NOT FOUND
  // ==========================================

  if (error || !project) {
    notFound();
  }

  // ==========================================
  // PAGE
  // ==========================================

  return (
    <main className="min-h-screen bg-gray-50">
      {/* ====================================== */}
      {/* HEADER */}
      {/* ====================================== */}

      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Link
                href="/dashboard"
                className="text-sm text-gray-500 transition hover:text-gray-900"
              >
                ← Back to Dashboard
              </Link>

              <h1 className="mt-3 text-3xl font-bold tracking-tight text-gray-900">
                {project.name}
              </h1>

              <p className="mt-2 max-w-2xl text-sm text-gray-500">
                {project.description ||
                  "Configure and test your AI agent."}
              </p>
            </div>

            <div className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600">
              AI Agent
            </div>
          </div>
        </div>
      </div>

      {/* ====================================== */}
      {/* MAIN CONTENT */}
      {/* ====================================== */}

      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* ==================================== */}
        {/* AGENT INFORMATION */}
        {/* ==================================== */}

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            Agent Configuration
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Information about this AI agent.
          </p>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {/* Agent Name */}

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Agent Name
              </p>

              <p className="mt-1 text-sm font-medium text-gray-900">
                {project.name}
              </p>
            </div>

            {/* Description */}

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Description
              </p>

              <p className="mt-1 text-sm text-gray-700">
                {project.description ||
                  "No description provided."}
              </p>
            </div>
          </div>
        </section>

        {/* ==================================== */}
        {/* KNOWLEDGE BASE */}
        {/* ==================================== */}

        <div className="mt-8">
          <KnowledgeBase
            agentId={project.id}
          />
        </div>

        {/* ==================================== */}
        {/* CHAT */}
        {/* ==================================== */}

        <div className="mt-8">
          <AgentChat
            agentId={project.id}
          />
        </div>
      </div>
    </main>
  );
}