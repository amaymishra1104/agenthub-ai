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

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-6xl">
        {/* Dashboard Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              My Agents
            </h1>

            <p className="mt-2 text-gray-600">
              Create and manage your AI agents.
            </p>
          </div>

          <CreateAgentDialog />
        </div>

        {/* Agent List */}
        {!projects || projects.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-10 text-center shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">
              No agents yet
            </h2>

            <p className="mt-2 text-gray-600">
              Create your first AI agent to get started.
            </p>

            <div className="mt-6">
              <CreateAgentDialog />
            </div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <div
                key={project.id}
                className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">
                      {project.name}
                    </h2>

                    <p className="mt-2 text-sm text-gray-600">
                      {project.description ||
                        "No description provided."}
                    </p>
                  </div>
                </div>

                <div className="mt-6">
                  <a
                    href={`/dashboard/agents/${project.id}`}
                    className="text-sm font-medium text-gray-900 underline underline-offset-4 hover:text-gray-600"
                  >
                    Open Agent →
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}