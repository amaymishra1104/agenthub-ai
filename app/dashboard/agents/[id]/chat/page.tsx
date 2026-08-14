import { redirect } from "next/navigation";

import AgentChat from "@/components/agent-chat";
import { createClient } from "@/lib/supabase/server";

type ChatPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function AgentChatPage({
  params,
}: ChatPageProps) {
  const { id } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: project, error } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !project) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6">
          <a
            href={`/dashboard/agents/${project.id}`}
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            ← Back to Agent
          </a>

          <h1 className="mt-3 text-3xl font-bold text-gray-900">
            {project.name}
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Test and interact with your AI agent.
          </p>
        </div>

        <AgentChat agentId={project.id} />
      </div>
    </main>
  );
}