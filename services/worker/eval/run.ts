/**
 * Runs the extraction evaluation set against the real model and prints a report.
 * Costs real API tokens: requires ANTHROPIC_API_KEY and EXTRACTION_MODEL.
 *
 *   npm run eval:extraction -w @czyzyk/worker [-- --only bal-przebrania]
 */
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import type { ItemData, ItemType } from "@czyzyk/shared";
import type { ExtractionBatch } from "../src/extraction/batch.js";
import { AnthropicExtractionModel } from "../src/extraction/model.js";
import { buildExtractionPrompt } from "../src/extraction/prompt.js";
import { scoreCase, type EvalCase } from "./score.js";

const apiKey = process.env.ANTHROPIC_API_KEY;
const modelName = process.env.EXTRACTION_MODEL;
const threshold = Number(process.env.EXTRACTION_CONFIDENCE_THRESHOLD ?? 0.7);
if (!apiKey || !modelName) {
  console.error("Ustaw ANTHROPIC_API_KEY i EXTRACTION_MODEL (patrz services/worker/.env.example).");
  process.exit(2);
}

const { cases } = JSON.parse(readFileSync(new URL("./cases.json", import.meta.url), "utf8")) as { cases: EvalCase[] };
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : undefined;

export function batchFor(c: EvalCase): { batch: ExtractionBatch; now: Date } {
  const itemId = (alias: string) => `item-${alias.slice(1)}`;
  const items = (c.items ?? []).map((item, i) => {
    const data = { ...item.data } as Record<string, unknown>;
    if (item.type === "bring_item" && typeof data.event === "string") data.event = itemId(data.event);
    return { id: `item-${i + 1}`, type: item.type as ItemType, status: "active" as const, data: data as ItemData[ItemType] };
  });
  const newMessages = c.messages.map((m, i) => ({
    id: `msg-${i + 1}`,
    author: m.author,
    sentAt: new Date(m.sent_at),
    text: m.text,
    hasAttachment: false,
  }));
  const last = Math.max(...newMessages.map((m) => m.sentAt.getTime()));
  return {
    batch: { group: { id: "group", name: "Motylki" }, newMessages, contextMessages: [], items },
    now: new Date(last + 30 * 60_000),
  };
}

const model = new AnthropicExtractionModel(new Anthropic({ apiKey, maxRetries: 4 }), modelName);
let passed = 0;
let tokens = { input: 0, output: 0 };
const selected = cases.filter((c) => !only || c.id === only);

for (const c of selected) {
  const { batch, now } = batchFor(c);
  const prompt = buildExtractionPrompt(batch, now);
  try {
    const result = await model.extract(prompt);
    tokens = { input: tokens.input + (result.usage?.input_tokens ?? 0), output: tokens.output + (result.usage?.output_tokens ?? 0) };
    const score = scoreCase(c, result.operations, threshold);
    if (score.pass) passed++;
    console.log(`${score.pass ? "✓" : "✗"} ${c.id}`);
    for (const p of score.problems) console.log(`    ${p}`);
  } catch (error) {
    console.log(`✗ ${c.id}\n    błąd modelu: ${(error as Error).message}`);
  }
}

console.log(`\nZgodność: ${passed}/${selected.length} (${Math.round((100 * passed) / selected.length)}%), model ${modelName}`);
console.log(`Tokeny: wejście ${tokens.input}, wyjście ${tokens.output}`);
process.exit(passed === selected.length ? 0 : 1);
