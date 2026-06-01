import { notFound } from "next/navigation";

import { ProjectEditor } from "@/components/ProjectEditor";
import { TopNav } from "@/components/TopNav";
import { requireOwnerPageSession, syncOwnerUser } from "@/lib/auth";
import { listProjectsForUser, PROJECT_STATUS_OPTIONS } from "@/lib/projects-service";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProjectPage({ params }: PageProps) {
  const authUser = await requireOwnerPageSession();
  const dbUser = await syncOwnerUser(authUser.email!.toLowerCase());
  const { id } = await params;

  const projects = await listProjectsForUser(dbUser.id);
  const project = projects.find((candidate) => candidate.id === id);

  if (!project) {
    notFound();
  }

  return (
    <main className="min-h-screen">
      <TopNav />
      <ProjectEditor
        project={project}
        statusOptions={[...PROJECT_STATUS_OPTIONS]}
      />
    </main>
  );
}
