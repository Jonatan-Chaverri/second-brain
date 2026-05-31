import { ChatBox } from "@/components/ChatBox";
import { TopNav } from "@/components/TopNav";
import { requireOwnerPageSession } from "@/lib/auth";

export default async function ChatPage() {
  await requireOwnerPageSession();

  return (
    <main className="min-h-screen">
      <TopNav />
      <ChatBox />
    </main>
  );
}
