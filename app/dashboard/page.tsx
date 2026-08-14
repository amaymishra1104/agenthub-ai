import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CreateAgentDialog from "@/components/create-agent-dialog";

export default async function DashboardPage() {
  const supabase = await createClient();

  // Get the currently logged-in user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect the dashboard
  if (!user) {
    redirect("/login");
  }

  // Fetch only the current user's projects
  const { data: projects, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching projects:", error);
  }

  const agentCount = projects?.length ?? 0;

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-6 py-10 lg:px-8">
        {/* ========================================
            HEADER
        ======================================== */}

        <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              AgentHub
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
              My Agents
            </h1>

            <p className="mt-2 max-w-xl text-sm leading-6 text-gray-500 sm:text-base">
              Create, manage, and test your AI agents from one
              place.
            </p>
          </div>

          <div className="shrink-0">
            <CreateAgentDialog />
          </div>
        </div>

        {/* ========================================
            STATS
        ======================================== */}

        <div className="mb-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  Total Agents
                </p>

                <p className="mt-2 text-3xl font-bold text-gray-950">
                  {agentCount}
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 text-lg">
                ✦
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  Platform
                </p>

                <p className="mt-2 text-lg font-semibold text-gray-950">
                  AI Agent Workspace
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  Build and test intelligent agents
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 text-lg">
                ◎
              </div>
            </div>
          </div>
        </div>

        {/* ========================================
            AGENTS SECTION HEADER
        ======================================== */}

        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-950">
              Your Agents
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Select an agent to view its configuration,
              knowledge base, and chat.
            </p>
          </div>

          {agentCount > 0 && (
            <span className="hidden rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 sm:inline-flex">
              {agentCount}{" "}
              {agentCount === 1 ? "agent" : "agents"}
            </span>
          )}
        </div>

        {/* ========================================
            EMPTY STATE
        ======================================== */}

        {!projects || projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-2xl">
              ✦
            </div>

            <h2 className="mt-5 text-xl font-semibold text-gray-950">
              No agents yet
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
              Create your first AI agent and give it a
              custom purpose, description, and system
              instructions.
            </p>

            <div className="mt-7">
              <CreateAgentDialog />
            </div>
          </div>
        ) : (
          /* ========================================
             AGENT GRID
          ======================================== */

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <div
                key={project.id}
                className="group flex min-h-[250px] flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md"
              >
                {/* Card header */}

                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-950 text-lg text-white">
                      ✦
                    </div>

                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-gray-950">
                        {project.name}
                      </h3>

                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />

                        <span className="text-xs font-medium text-gray-500">
                          Active
                        </span>
                      </div>
                    </div>
                  </div>

                  <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-500">
                    AI Agent
                  </span>
                </div>

                {/* Description */}

                <p className="mt-6 line-clamp-3 text-sm leading-6 text-gray-500">
                  {project.description ||
                    "No description provided for this agent."}
                </p>

                {/* Bottom action */}

                <div className="mt-auto pt-7">
                  <a
                    href={`/dashboard/agents/${project.id}`}
                    className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium text-gray-900 transition hover:border-gray-900 hover:bg-gray-950 hover:text-white"
                  >
                    <span>Open Agent</span>

                    <span className="transition-transform group-hover:translate-x-0.5">
                      →
                    </span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ========================================
            FOOTER NOTE
        ======================================== */}

        {agentCount > 0 && (
          <div className="mt-10 border-t border-gray-200 pt-5">
            <p className="text-center text-xs text-gray-400">
              Create separate agents for different
              use cases, each with its own instructions
              and knowledge base.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}