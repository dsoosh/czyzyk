import { parseOperation, type ItemData, type ItemType, type ParsedOperation } from "@czyzyk/shared";
import type { Aliases } from "./prompt.js";

export type EventRef = { kind: "existing"; id: string } | { kind: "new"; ref: string } | null;

/** `index` is the operation's position in the model output (used in rejection reports). */
export type ResolvedOperation = { index: number } & (
  | {
      op: "create";
      type: ItemType;
      ref: string | null;
      data: ItemData[ItemType];
      children: string[];
      eventRef: EventRef;
      sourceMessageIds: string[];
      confidence: number;
      rationale: string;
    }
  | {
      op: "update";
      type: ItemType;
      targetId: string;
      data: Partial<ItemData[ItemType]>;
      children: string[];
      eventRef: EventRef | undefined;
      sourceMessageIds: string[];
      confidence: number;
      rationale: string;
    }
  | { op: "cancel"; type: ItemType; targetId: string; sourceMessageIds: string[]; confidence: number; rationale: string }
);

export interface Rejection {
  index: number;
  reason: string;
}

/**
 * Validates model output and maps aliases to ids. Anything pointing outside the
 * prompt (unknown W…/E… aliases, wrong item type, undefined refs) is rejected,
 * so the model can only touch what it was shown.
 */
export function resolveOperations(raw: unknown[], aliases: Aliases): { accepted: ResolvedOperation[]; rejected: Rejection[] } {
  const accepted: ResolvedOperation[] = [];
  const rejected: Rejection[] = [];

  const parsed: { index: number; op: ParsedOperation }[] = [];
  raw.forEach((input, index) => {
    const result = parseOperation(input);
    if (result.ok) parsed.push({ index, op: result.value });
    else rejected.push({ index, reason: result.error });
  });

  const eventRefs = new Set<string>();
  for (const { op } of parsed) {
    if (op.op === "create" && op.type === "event" && op.ref) eventRefs.add(op.ref);
  }
  const seenRefs = new Set<string>();

  for (const { index, op } of parsed) {
    const reject = (reason: string) => rejected.push({ index, reason });

    const sourceMessageIds: string[] = [];
    const unknown = op.sourceMessages.filter((alias) => !aliases.messages.has(alias));
    if (unknown.length) {
      reject(`unknown message alias ${unknown.join(", ")}`);
      continue;
    }
    for (const alias of op.sourceMessages) sourceMessageIds.push(aliases.messages.get(alias)!);
    const common = { index, type: op.type, sourceMessageIds: [...new Set(sourceMessageIds)], confidence: op.confidence, rationale: op.rationale };

    let eventRef: EventRef | undefined;
    if (op.op !== "cancel" && op.type === "bring_item" && "event" in op.data) {
      const ref = (op.data as { event?: string | null }).event;
      if (ref == null) eventRef = null;
      else if (ref.startsWith("E")) {
        const item = aliases.items.get(ref);
        if (!item || item.type !== "event") {
          reject(`event ${ref} is not an existing event`);
          continue;
        }
        eventRef = { kind: "existing", id: item.id };
      } else if (eventRefs.has(ref)) eventRef = { kind: "new", ref };
      else {
        reject(`unknown event ref ${ref}`);
        continue;
      }
    }

    if (op.op === "create") {
      if (op.ref) {
        if (seenRefs.has(op.ref)) {
          reject(`duplicate ref ${op.ref}`);
          continue;
        }
        seenRefs.add(op.ref);
      }
      accepted.push({ op: "create", ref: op.ref, data: op.data, children: op.children, eventRef: eventRef ?? null, ...common });
      continue;
    }

    const target = aliases.items.get(op.target);
    if (!target) {
      reject(`unknown item alias ${op.target}`);
      continue;
    }
    if (target.type !== op.type) {
      reject(`item ${op.target} is ${target.type}, not ${op.type}`);
      continue;
    }
    accepted.push(
      op.op === "update"
        ? { op: "update", targetId: target.id, data: op.data, children: op.children, eventRef, ...common }
        : { op: "cancel", targetId: target.id, ...common },
    );
  }

  rejected.sort((a, b) => a.index - b.index);
  return { accepted, rejected };
}
