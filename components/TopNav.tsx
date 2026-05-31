"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function getLinkClass(pathname: string, href: string) {
  const isActive = pathname === href;

  return isActive
    ? "rounded-full bg-indigo-500/15 px-4 py-2 text-indigo-300 ring-1 ring-inset ring-indigo-400/40 shadow-[0_0_18px_-6px_rgba(129,140,248,0.6)]"
    : "rounded-full px-4 py-2 text-sand-700 hover:bg-sand-100 hover:text-sand-900";
}

export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-sand-200/80 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <nav className="flex items-center gap-3 text-sm font-medium text-sand-700">
          <Link href="/journal" className={getLinkClass(pathname, "/journal")}>
            Journal
          </Link>
          <Link href="/chat" className={getLinkClass(pathname, "/chat")}>
            Chat
          </Link>
          <Link href="/aliases" className={getLinkClass(pathname, "/aliases")}>
            Aliases
          </Link>
        </nav>

        <form action="/api/logout" method="post">
          <button
            type="submit"
            className="rounded-full border border-sand-300 px-4 py-2 text-sm font-medium text-sand-700 hover:border-sand-400 hover:text-sand-900"
          >
            Logout
          </button>
        </form>
      </div>
    </header>
  );
}
