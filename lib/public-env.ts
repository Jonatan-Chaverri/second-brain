function getRequiredSupabaseUrl() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (value) {
    return value;
  }

  throw new Error("Missing environment variable: NEXT_PUBLIC_SUPABASE_URL");
}

function getRequiredSupabasePublicKey() {
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (publishableKey) {
    return publishableKey;
  }

  const legacyAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (legacyAnonKey) {
    return legacyAnonKey;
  }

  throw new Error("Missing environment variable: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
}

export function getPublicEnv() {
  return {
    supabasePublishableKey: getRequiredSupabasePublicKey(),
    supabaseUrl: getRequiredSupabaseUrl()
  };
}
