import Link from "next/link";

export function TopNav() {
  return (
    <header className="border-b border-sand-200/80 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <nav className="flex items-center gap-3 text-sm font-medium text-sand-700">
          <Link
            href="/journal"
            className="rounded-full bg-sand-100 px-4 py-2 text-sand-900 hover:bg-sand-200"
          >
            Second Brain
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
