const requiredPublicEnvs = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const;

function getEnvValue(key: "OWNER_EMAIL" | (typeof requiredPublicEnvs)[number]) {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }

  return value;
}

export const env = {
  ownerEmail: getEnvValue("OWNER_EMAIL").toLowerCase()
};

export const publicEnv = {
  supabaseAnonKey: getEnvValue("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseUrl: getEnvValue("NEXT_PUBLIC_SUPABASE_URL")
};
