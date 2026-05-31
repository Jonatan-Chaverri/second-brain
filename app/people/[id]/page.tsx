import { notFound } from "next/navigation";

import { PersonEditor } from "@/components/PersonEditor";
import { TopNav } from "@/components/TopNav";
import { requireOwnerPageSession, syncOwnerUser } from "@/lib/auth";
import { listPeopleForUser } from "@/lib/people-service";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PersonPage({ params }: PageProps) {
  const authUser = await requireOwnerPageSession();
  const dbUser = await syncOwnerUser(authUser.email!.toLowerCase());
  const { id } = await params;

  const people = await listPeopleForUser(dbUser.id);
  const person = people.find((candidate) => candidate.id === id);

  if (!person) {
    notFound();
  }

  return (
    <main className="min-h-screen">
      <TopNav />
      <PersonEditor person={person} />
    </main>
  );
}
