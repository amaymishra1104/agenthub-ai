import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import CreateAgentDialog from "@/components/create-agent-dialog";
import DeleteAgentButton from "@/components/delete-agent-button";
import UserMenu from "@/components/user-menu";

export default async function DashboardPage() {
  const supabase = await createClient();

  // ========================================
  // AUTHENTICATION
  // ========================================

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // ========================================
  // FETCH CURRENT USER'S AGENTS
  // ========================================

  const {
    data: projects,
    error,
  } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    console.error(
      "Error fetching projects:",
      error
    );
  }

  const agents = projects ?? [];
  const agentCount = agents.length;

  // ========================================
  // USER INFORMATION
  // ========================================

  const userEmail =
    user.email || "User";

  // ========================================
  // PAGE
  // ========================================

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-8">

        {/* ========================================
            HEADER
        ======================================== */}

        <header className="mb-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">

            {/* ==================================
                TITLE
            ================================== */}

            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />

                AgentHub
              </div>

              <h1 className="text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
                My Agents
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500 sm:text-base">
                Create, configure, and test AI agents with their own
                instructions and knowledge bases.
              </p>
            </div>

            {/* ==================================
                HEADER ACTIONS
            ================================== */}

            <div className="flex shrink-0 items-center gap-3">

              {/* Create Agent */}

              <CreateAgentDialog />

              {/* Profile / Logout */}

              <UserMenu
                email={userEmail}
              />

            </div>

          </div>
        </header>

        {/* ========================================
            SUMMARY CARDS
        ======================================== */}

        <section className="mb-10 grid gap-4 sm:grid-cols-2">

          {/* ==================================
              TOTAL AGENTS
          ================================== */}

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Total Agents
                </p>

                <p className="mt-2 text-3xl font-bold tracking-tight text-gray-950">
                  {agentCount}
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  {agentCount === 1
                    ? "AI agent in your workspace"
                    : "AI agents in your workspace"}
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-950 text-xl text-white">
                ✦
              </div>

            </div>
          </div>

          {/* ==================================
              WORKSPACE
          ================================== */}

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Workspace
                </p>

                <p className="mt-2 text-lg font-semibold text-gray-950">
                  AI Agent Workspace
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  Configure, ground, and test your agents
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-lg text-gray-700">
                ◎
              </div>

            </div>
          </div>

        </section>

        {/* ========================================
            AGENTS SECTION
        ======================================== */}

        <section>

          {/* ======================================
              SECTION HEADER
          ====================================== */}

          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">

            <div>
              <h2 className="text-xl font-semibold tracking-tight text-gray-950">
                Your Agents
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Open an agent to configure its instructions, knowledge
                base, and chat.
              </p>
            </div>

            {agentCount > 0 && (
              <div className="inline-flex w-fit rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600">
                {agentCount}{" "}
                {agentCount === 1
                  ? "agent"
                  : "agents"}
              </div>
            )}

          </div>

          {/* ========================================
              EMPTY STATE
          ======================================== */}

          {agentCount === 0 ? (

            <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center shadow-sm">

              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-950 text-2xl text-white">
                ✦
              </div>

              <h2 className="mt-5 text-xl font-semibold text-gray-950">
                Create your first agent
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
                Build an AI agent with a specific purpose, custom
                instructions, and its own knowledge base.
              </p>

              <div className="mt-7">
                <CreateAgentDialog />
              </div>

            </div>

          ) : (

            /* ========================================
               AGENT GRID
            ======================================== */

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">

              {agents.map((project) => (

                <article
                  key={project.id}
                  className="group flex min-h-[280px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-lg"
                >

                  {/* ==================================
                      CARD CONTENT
                  ================================== */}

                  <div className="p-6">

                    <div className="flex items-start justify-between gap-4">

                      {/* Agent identity */}

                      <div className="flex min-w-0 items-center gap-3">

                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-950 text-lg text-white">
                          ✦
                        </div>

                        <div className="min-w-0">

                          <h3 className="truncate text-base font-semibold text-gray-950">
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

                      {/* Agent badge */}

                      <span className="shrink-0 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-gray-500">
                        AI Agent
                      </span>

                    </div>

                    {/* ==================================
                        DESCRIPTION
                    ================================== */}

                    <p className="mt-6 line-clamp-3 min-h-[72px] text-sm leading-6 text-gray-500">
                      {project.description ||
                        "No description provided for this agent."}
                    </p>

                    {/* ==================================
                        AGENT FEATURES
                    ================================== */}

                    <div className="mt-6 flex flex-wrap gap-2">

                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-600">
                        Custom Instructions
                      </span>

                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-600">
                        Knowledge Base
                      </span>

                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-600">
                        RAG
                      </span>

                    </div>

                  </div>

                  {/* ==================================
                      CARD ACTIONS
                  ================================== */}

                  <div className="mt-auto border-t border-gray-100 bg-gray-50/70 p-4">

                    <div className="flex gap-2">

                      {/* Open Agent */}

                      <Link
                        href={`/dashboard/agents/${project.id}`}
                        className="flex flex-1 items-center justify-between rounded-xl bg-gray-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-gray-800"
                      >
                        <span>
                          Open Agent
                        </span>

                        <span className="transition-transform duration-200 group-hover:translate-x-0.5">
                          →
                        </span>
                      </Link>

                      {/* Delete Agent */}

                      <DeleteAgentButton
                        agentId={project.id}
                        agentName={project.name}
                      />

                    </div>

                  </div>

                </article>

              ))}

            </div>

          )}

        </section>

        {/* ========================================
            FOOTER
        ======================================== */}

        {agentCount > 0 && (
          <footer className="mt-12 border-t border-gray-200 pt-6">
            <p className="text-center text-xs leading-5 text-gray-400">
              Each agent has its own instructions, conversations, and
              knowledge base.
            </p>
          </footer>
        )}

      </div>
    </main>
  );
}