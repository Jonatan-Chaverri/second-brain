import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isOwnerEmail } from "@/lib/owner";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirectTo = new URL("/journal", origin);

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=invalid_link", origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/login?error=invalid_link", origin));
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user || !isOwnerEmail(user.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=unauthorized", origin));
  }

  return NextResponse.redirect(redirectTo);
}
