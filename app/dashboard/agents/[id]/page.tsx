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
  // GET AGENT SYSTEM PROMPT
  // ==========================================

  const {
    data: prompt,
    error: promptError,
  } = await supabase
    .from("prompts")
    .select("content")
    .eq("project_id", project.id)
    .order("updated_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (promptError) {
    console.error(
      "Error fetching agent prompt:",
      promptError
    );
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
          HEADER
      ====================================== */}

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

      {/* ======================================
          MAIN CONTENT
      ====================================== */}

      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* ====================================
            AGENT CONFIGURATION
        ==================================== */}

        <AgentConfiguration
          agentId={project.id}
          initialName={project.name}
          initialDescription={
            project.description || ""
          }
          initialPrompt={
            prompt?.content || defaultPrompt
          }
        />

        {/* ====================================
            KNOWLEDGE BASE
        ==================================== */}

        <div className="mt-8">
          <KnowledgeBase agentId={project.id} />
        </div>

        {/* ====================================
            CHAT
        ==================================== */}

        <div className="mt-8">
          <AgentChat agentId={project.id} />
        </div>
      </div>
    </main>
  );
}