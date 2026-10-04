import { parseOperation, type ItemType, type ParsedOperation } from "@czyzyk/shared";

export interface ExpectedOperation {
  op: "create" | "update" | "cancel";
  type: ItemType;
  /** Alias of the existing item (E…) for update/cancel. */
  target?: string;
  /** Exact values in data (dates, amounts, booleans, event alias). */
  fields?: Record<string, unknown>;
  /** Case-insensitive substrings in data text fields. */
  contains?: Record<string, string>;
}

export interface EvalCase {
  id: string;
  items?: { type: ItemType; data: Record<string, unknown> }[];
  messages: { author: string; sent_at: string; text: string }[];
  expected: ExpectedOperation[];
  /** Extra confident operations tolerated beyond the expected ones (default 0). */
  maxExtra?: number;
  /** Every operation must stay below the confidence threshold. */
  noConfidentOps?: boolean;
}

export interface CaseScore {
  id: string;
  pass: boolean;
  problems: string[];
}

function matches(expected: ExpectedOperation, actual: ParsedOperation): boolean {
  if (expected.op !== actual.op || expected.type !== actual.type) return false;
  if (expected.target && (actual.op === "create" || actual.target !== expected.target)) return false;
  const data = (actual.op === "cancel" ? {} : actual.data) as Record<string, unknown>;
  for (const [k, v] of Object.entries(expected.fields ?? {})) if (data[k] !== v) return false;
  for (const [k, v] of Object.entries(expected.contains ?? {})) {
    if (!String(data[k] ?? "").toLocaleLowerCase("pl-PL").includes(v.toLocaleLowerCase("pl-PL"))) return false;
  }
  return true;
}

function describe(o: ParsedOperation): string {
  const target = o.op === "create" ? "" : ` ${o.target}`;
  const data = o.op === "cancel" ? "" : ` ${JSON.stringify(o.data)}`;
  return `${o.op} ${o.type}${target}${data} (${o.confidence})`;
}

/** Scores the model's raw operations (model aliases, before id mapping) against a case. */
export function scoreCase(c: EvalCase, raw: unknown[], threshold: number): CaseScore {
  const problems: string[] = [];
  const ops: ParsedOperation[] = [];
  raw.forEach((r, i) => {
    const p = parseOperation(r);
    if (p.ok) ops.push(p.value);
    else problems.push(`niepoprawna operacja #${i}: ${p.error}`);
  });

  if (c.noConfidentOps) {
    for (const o of ops) if (o.confidence >= threshold) problems.push(`pewna operacja mimo niejasnej wiadomości: ${describe(o)}`);
  }

  const unmatched = [...ops];
  for (const e of c.expected) {
    const i = unmatched.findIndex((o) => matches(e, o));
    if (i === -1) problems.push(`brak oczekiwanej operacji: ${e.op} ${e.type} ${JSON.stringify({ ...e.fields, ...e.contains })}`);
    else unmatched.splice(i, 1);
  }

  const extra = unmatched.filter((o) => o.confidence >= threshold);
  if (!c.noConfidentOps && extra.length > (c.maxExtra ?? 0)) {
    problems.push(...extra.map((o) => `nadmiarowa operacja: ${describe(o)}`));
  }
  return { id: c.id, pass: problems.length === 0, problems };
}
