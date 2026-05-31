"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type NavLink = {
  href: "/journal" | "/chat" | "/people" | "/aliases";
  label: string;
};

const navLinks: NavLink[] = [
  { href: "/journal", label: "Journal" },
  { href: "/chat", label: "Chat" },
  { href: "/people", label: "People" },
  { href: "/aliases", label: "Aliases" }
];

function getLinkClass(pathname: string, href: string) {
  const isActive = pathname === href;

  return isActive
    ? "rounded-full bg-indigo-500/15 px-4 py-2 text-indigo-300 ring-1 ring-inset ring-indigo-400/40 shadow-[0_0_18px_-6px_rgba(129,140,248,0.6)]"
    : "rounded-full px-4 py-2 text-sand-700 hover:bg-sand-100 hover:text-sand-900";
}

function getMobileLinkClass(pathname: string, href: string) {
  const isActive = pathname === href;

  return isActive
    ? "block rounded-2xl bg-indigo-500/15 px-4 py-3 text-indigo-300 ring-1 ring-inset ring-indigo-400/40"
    : "block rounded-2xl px-4 py-3 text-sand-700 hover:bg-sand-100 hover:text-sand-900";
}

export function TopNav() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <header className="relative z-50 border-b border-sand-200/80 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <button
          type="button"
          aria-label="Toggle navigation"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((current) => !current)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-sand-200 text-sand-700 hover:border-sand-300 hover:text-sand-900 sm:hidden"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden
          >
            {isOpen ? (
              <>
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="6" y1="18" x2="18" y2="6" />
              </>
            ) : (
              <>
                <line x1="4" y1="7" x2="20" y2="7" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="17" x2="20" y2="17" />
              </>
            )}
          </svg>
        </button>

        <nav className="hidden items-center gap-3 text-sm font-medium text-sand-700 sm:flex">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className={getLinkClass(pathname, link.href)}>
              {link.label}
            </Link>
          ))}
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

      {isOpen ? (
        <nav className="absolute inset-x-0 top-full z-40 border-b border-sand-200/80 bg-white px-4 py-3 shadow-lg shadow-sand-900/5 sm:hidden">
          <ul className="flex flex-col gap-1 text-sm font-medium">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={getMobileLinkClass(pathname, link.href)}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
