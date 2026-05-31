import { SettingsView } from "@/components/SettingsView";
import { TopNav } from "@/components/TopNav";
import { requireOwnerPageSession } from "@/lib/auth";

export default async function SettingsPage() {
  await requireOwnerPageSession();

  return (
    <main className="min-h-screen">
      <TopNav />
      <SettingsView />
    </main>
  );
}
