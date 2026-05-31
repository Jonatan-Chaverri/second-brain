// USD per 1M tokens. Update as OpenAI pricing changes.
type ModelPricing = {
  input: number;
  output: number;
};

const PRICING: Record<string, ModelPricing> = {
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1": { input: 2.0, output: 8.0 },
  "gpt-4.1-nano": { input: 0.1, output: 0.4 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4o": { input: 2.5, output: 10.0 },
  "text-embedding-3-small": { input: 0.02, output: 0 },
  "text-embedding-3-large": { input: 0.13, output: 0 }
};

function lookupPricing(model: string): ModelPricing | null {
  if (PRICING[model]) return PRICING[model];
  // Tolerate dated suffixes like "gpt-4.1-mini-2025-04-14".
  const base = Object.keys(PRICING).find((key) => model.startsWith(key));
  return base ? PRICING[base] : null;
}

export function estimateUsdCost(input: {
  model: string;
  inputTokens: number;
  outputTokens: number;
}): number | null {
  const pricing = lookupPricing(input.model);
  if (!pricing) return null;
  return (input.inputTokens * pricing.input + input.outputTokens * pricing.output) / 1_000_000;
}
