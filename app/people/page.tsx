import { PeopleList } from "@/components/PeopleList";
import { TopNav } from "@/components/TopNav";
import { requireOwnerPageSession } from "@/lib/auth";

export default async function PeoplePage() {
  await requireOwnerPageSession();

  return (
    <main className="min-h-screen">
      <TopNav />
      <PeopleList />
    </main>
  );
}
