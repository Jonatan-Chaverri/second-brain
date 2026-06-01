"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { BlinkSprite } from "@/components/BlinkSprite";

type NavLink = {
  href: "/journal" | "/chat" | "/people" | "/aliases" | "/settings";
  label: string;
  icon: ReactNode;
};

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      {children}
    </svg>
  );
}

const navLinks: NavLink[] = [
  {
    href: "/journal",
    label: "Journal",
    icon: (
      <Icon>
        <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z" />
        <path d="M5 17a3 3 0 0 1 3-3h11" />
        <path d="M9 8h6M9 12h6" />
      </Icon>
    )
  },
  {
    href: "/chat",
    label: "Chat",
    icon: (
      <Icon>
        <path d="M21 12a8 8 0 1 1-3.2-6.4L21 4l-1.4 3.2A8 8 0 0 1 21 12z" />
        <path d="M8 11h.01M12 11h.01M16 11h.01" />
      </Icon>
    )
  },
  {
    href: "/people",
    label: "People",
    icon: (
      <Icon>
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M16 14c2.8 0 5 2.2 5 5" />
      </Icon>
    )
  },
  {
    href: "/aliases",
    label: "Aliases",
    icon: (
      <Icon>
        <path d="M4 7h12" />
        <path d="M4 12h8" />
        <path d="M4 17h12" />
        <path d="m18 9 3 3-3 3" />
      </Icon>
    )
  },
  {
    href: "/settings",
    label: "Settings",
    icon: (
      <Icon>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.17.41.26.85.27 1.3" />
      </Icon>
    )
  }
];

function getLinkClass(pathname: string, href: string) {
  const isActive = pathname === href;

  return isActive
    ? "inline-flex items-center gap-2 rounded-full bg-indigo-500/15 px-4 py-2 text-indigo-300 ring-1 ring-inset ring-indigo-400/40 shadow-[0_0_18px_-6px_rgba(129,140,248,0.6)]"
    : "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sand-700 hover:bg-sand-100 hover:text-sand-900";
}

function getMobileLinkClass(pathname: string, href: string) {
  const isActive = pathname === href;

  return isActive
    ? "flex items-center gap-3 rounded-2xl bg-indigo-500/15 px-4 py-3 text-indigo-300 ring-1 ring-inset ring-indigo-400/40"
    : "flex items-center gap-3 rounded-2xl px-4 py-3 text-sand-700 hover:bg-sand-100 hover:text-sand-900";
}

export function TopNav() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (headerRef.current && headerRef.current.contains(target)) return;
      if (sidebarRef.current && sidebarRef.current.contains(target)) return;
      setIsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <header ref={headerRef} className="sticky top-0 z-50 border-b border-sand-200/80 bg-white/80 backdrop-blur">
      <div className="relative mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 sm:hidden">
          <BlinkSprite size={40} />
        </span>
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
              {link.icon}
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex">
            <BlinkSprite size={40} />
          </span>
          <form action="/api/logout" method="post">
            <button
              type="submit"
              className="rounded-full border border-sand-300 px-4 py-2 text-sm font-medium text-sand-700 hover:border-sand-400 hover:text-sand-900"
            >
              Logout
            </button>
          </form>
        </div>
      </div>

      {mounted && isOpen
        ? createPortal(
            <div className="sm:hidden">
              <div
                className="fixed inset-0 z-[60] bg-sand-900/40 backdrop-blur-sm"
                aria-hidden
                onClick={() => setIsOpen(false)}
              />
              <aside
                ref={sidebarRef}
                role="dialog"
                aria-label="Navigation"
                aria-modal="true"
                className="fixed inset-y-0 left-0 z-[70] flex w-72 max-w-[80%] flex-col border-r border-sand-200 bg-white shadow-2xl shadow-sand-900/20"
              >
            <div className="flex items-center justify-between border-b border-sand-200 px-4 py-4">
              <span className="text-sm font-semibold uppercase tracking-wide text-sand-500">
                Second Brain
              </span>
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-sand-200 text-sand-700 hover:border-sand-300 hover:text-sand-900"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                  aria-hidden
                >
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="6" y1="18" x2="18" y2="6" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-4">
              <ul className="flex flex-col gap-1 text-sm font-medium">
                {navLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={getMobileLinkClass(pathname, link.href)}>
                      {link.icon}
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
              </aside>
            </div>,
            document.body
          )
        : null}
    </header>
  );
}
