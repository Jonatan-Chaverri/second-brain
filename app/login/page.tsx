import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";
import { env } from "@/lib/env";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(188,145,83,0.16),transparent_32rem)]" />
      <div className="relative w-full">
        <Suspense fallback={null}>
          <LoginForm ownerEmail={env.ownerEmail} />
        </Suspense>
      </div>
    </main>
  );
}
