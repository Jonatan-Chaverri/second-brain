import { JournalEditor } from "@/components/JournalEditor";
import { TopNav } from "@/components/TopNav";
import { requireOwnerPageSession } from "@/lib/auth";

export default async function JournalPage() {
  await requireOwnerPageSession();

  return (
    <main className="flex h-[100dvh] flex-col overflow-hidden">
      <TopNav />
      <JournalEditor />
    </main>
  );
}
