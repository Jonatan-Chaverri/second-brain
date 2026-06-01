import { ProjectsList } from "@/components/ProjectsList";
import { TopNav } from "@/components/TopNav";
import { requireOwnerPageSession } from "@/lib/auth";

export default async function ProjectsPage() {
  await requireOwnerPageSession();

  return (
    <main className="min-h-screen">
      <TopNav />
      <ProjectsList />
    </main>
  );
}
