import { NextResponse, type NextRequest } from "next/server";
import { isOwnerEmail } from "@/lib/owner";
import { updateSession } from "@/lib/supabase/middleware";

const publicPaths = new Set(["/login"]);

function withCopiedCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie);
  });

  return to;
}

export async function middleware(request: NextRequest) {
  const { supabase, response } = updateSession(request);
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublicPath = publicPaths.has(pathname);

  if (!user && !isPublicPath) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && !isOwnerEmail(user.email)) {
    await supabase.auth.signOut();
    return withCopiedCookies(
      response,
      NextResponse.redirect(new URL("/login?error=unauthorized", request.url))
    );
  }

  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/journal", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"]
};
