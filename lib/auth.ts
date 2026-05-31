import { redirect } from "next/navigation";
import { User } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { createClient, createReadOnlyClient } from "@/lib/supabase/server";
import { isOwnerEmail } from "@/lib/owner";

function getUserEmail(user: User | null) {
  return user?.email?.toLowerCase() ?? null;
}

export async function getOptionalOwnerSession() {
  const supabase = await createReadOnlyClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!isOwnerEmail(getUserEmail(session?.user ?? null))) {
    return null;
  }

  return session;
}

export async function requireOwnerPageSession() {
  const supabase = await createReadOnlyClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!isOwnerEmail(getUserEmail(user))) {
    redirect("/login?error=unauthorized");
  }

  return user;
}

export async function requireOwnerApiUser() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("UNAUTHENTICATED");
  }

  if (!isOwnerEmail(getUserEmail(user))) {
    await supabase.auth.signOut();
    throw new Error("FORBIDDEN");
  }

  return user;
}

export async function syncOwnerUser(email: string) {
  return prisma.user.upsert({
    where: { email },
    create: { email },
    update: {}
  });
}
