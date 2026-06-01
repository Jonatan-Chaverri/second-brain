import { MeView } from "@/components/MeView";
import { TopNav } from "@/components/TopNav";
import { requireOwnerPageSession } from "@/lib/auth";

export default async function MePage() {
  await requireOwnerPageSession();

  return (
    <main className="min-h-screen">
      <TopNav />
      <MeView />
    </main>
  );
}
