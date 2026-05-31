import { AliasManager } from "@/components/AliasManager";
import { TopNav } from "@/components/TopNav";
import { requireOwnerPageSession } from "@/lib/auth";

export default async function AliasesPage() {
  await requireOwnerPageSession();

  return (
    <main className="min-h-screen">
      <TopNav />
      <AliasManager />
    </main>
  );
}
