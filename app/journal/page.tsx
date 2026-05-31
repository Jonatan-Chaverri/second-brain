import { JournalEditor } from "@/components/JournalEditor";
import { TopNav } from "@/components/TopNav";
import { requireOwnerPageSession } from "@/lib/auth";

export default async function JournalPage() {
  await requireOwnerPageSession();

  return (
    <main className="min-h-screen">
      <TopNav />
      <JournalEditor />
    </main>
  );
}
