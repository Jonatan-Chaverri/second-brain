function getRequiredEnvValue(key: string) {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }

  return value;
}

export const env = {
  ownerEmail: getRequiredEnvValue("OWNER_EMAIL").toLowerCase()
};

export const serverEnv = {
  openAiApiKey: getRequiredEnvValue("OPENAI_API_KEY"),
  openAiEmbeddingModel: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
  openAiSummaryModel: process.env.OPENAI_SUMMARY_MODEL || "gpt-4.1-mini"
};
