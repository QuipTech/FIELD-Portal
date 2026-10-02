// Approximate USD per million tokens for Bedrock on-demand inference, for
// the usage figures on Admin → AI configuration (ai_usage_log and
// ai_platform_usage_log). An estimate only: AWS billing is the source of
// truth.
const PRICE_PER_MILLION_TOKENS: [
  pattern: string,
  price: { input: number; output: number },
][] = [
  ['claude-sonnet-4-5', { input: 3, output: 15 }],
  ['claude-haiku-4-5', { input: 1, output: 5 }],
  ['titan-embed-text-v2', { input: 0.02, output: 0 }],
];

export const estimateBedrockCost = (
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): number => {
  const price = PRICE_PER_MILLION_TOKENS.find(([pattern]) =>
    modelId.includes(pattern),
  )?.[1];
  if (!price) return 0;
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
};
