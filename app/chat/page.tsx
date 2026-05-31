import { ChatBox } from "@/components/ChatBox";
import { TopNav } from "@/components/TopNav";
import { requireOwnerPageSession } from "@/lib/auth";

export default async function ChatPage() {
  await requireOwnerPageSession();

  return (
    <main className="flex h-[100dvh] flex-col overflow-hidden">
      <TopNav />
      <ChatBox />
    </main>
  );
}
