"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getPublicEnv } from "@/lib/public-env";

export function createClient() {
  const publicEnv = getPublicEnv();
  return createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey);
}
