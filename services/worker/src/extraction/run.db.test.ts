import pg from "pg";
import { pino } from "pino";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../../../../supabase/tests/db.js";
import type { ExtractionModel } from "./model.js";
import type { ExtractionPrompt } from "./prompt.js";
import { runGroupExtraction, type ExtractionDeps } from "./run.js";

let db: TestDb;
let pool: pg.Pool;
let groupId: string;

beforeAll(async () => {
  db = await createTestDb();
  pool = new pg.Pool({ connectionString: db.url, max: 3 });
});

afterAll(async () => {
  await pool?.end();
  await db?.drop();
});

beforeEach(async () => {
  for (const t of ["bring_items", "events", "payments", "action_required", "closures", "facts", "messages", "sync_log", "children", "wa_groups"]) {
    await db.client.query(`delete from ${t}`);
  }
  const { rows } = await db.client.query("insert into wa_groups (wa_name, display_name, tracked) values ('Motylki 2026/27', 'Motylki', true) returning id");
  groupId = rows[0].id;
});

/** Model double: records prompts and answers with operations built from them. */
function scripted(answer: (prompt: ExtractionPrompt) => unknown[]) {
  const prompts: ExtractionPrompt[] = [];
  const model: ExtractionModel = {
    async extract(prompt) {
      prompts.push(prompt as ExtractionPrompt);
      return { operations: answer(prompt as ExtractionPrompt) };
    },
  };
  return { model, prompts };
}

function deps(model: ExtractionModel, now = "2026-10-07T17:00:00Z"): ExtractionDeps {
  return {
    db: pool,
    model,
    logger: pino({ level: "silent" }),
    now: () => new Date(now),
    confidenceThreshold: 0.7,
    contextMessages: 50,
  };
}

let k = 0;
async function addMessage(text: string, sentAt: string, processed = false) {
  const { rows } = await db.client.query(
    `insert into messages (group_id, author, sent_at, text, source, dedupe_key, processed_at)
     values ($1, 'Pani Ania', $2, $3, 'notification', $4, $5) returning id`,
    [groupId, sentAt, text, `k${k++}`, processed ? sentAt : null],
  );
  return rows[0].id as string;
}

const lastAlias = (p: ExtractionPrompt) => [...p.aliases.messages.keys()].at(-1)!;
const op = (o: Record<string, unknown>) => ({ confidence: 0.95, rationale: "Uzasadnienie.", ...o });

describe("runGroupExtraction", () => {
  it("tworzy wydarzenie i powiązaną rzecz do przyniesienia, oznacza wiadomości jako przetworzone", async () => {
    const id = await addMessage("W piątek bal, przebrania", "2026-10-07T16:02:00Z");
    const { model } = scripted((p) => [
      op({
        op: "create",
        type: "bring_item",
        ref: null,
        data: { description: "przebranie", due_date: "2026-10-09", event: "nowe1" },
        source_messages: [lastAlias(p)],
      }),
      op({
        op: "create",
        type: "event",
        ref: "nowe1",
        data: { title: "Bal", start: "2026-10-09", end: null, all_day: true, location: null, whole_kindergarten: false },
        source_messages: [lastAlias(p)],
      }),
    ]);

    const result = await runGroupExtraction(deps(model), groupId);
    expect(result).toMatchObject({ status: "ok", messages: 1, created: 2, rejected: [] });

    const { rows: events } = await db.client.query("select * from events");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ title: "Bal", all_day: true, status: "active", group_id: groupId, source_message_ids: [id] });
    expect(new Date(events[0].starts_at).toISOString()).toBe("2026-10-08T22:00:00.000Z"); // 9.10 00:00 in Warsaw
    const { rows: items } = await db.client.query("select * from bring_items");
    expect(items[0]).toMatchObject({ description: "przebranie", event_id: events[0].id, status: "active" });
    expect((await db.client.query("select processed_at from messages where id = $1", [id])).rows[0].processed_at).not.toBeNull();
    const { rows: log } = await db.client.query("select status, details from sync_log");
    expect(log[0]).toMatchObject({ status: "ok", details: { messages: 1, created: 2 } });
    expect(JSON.stringify(log[0].details)).not.toContain("przebrani");
  });

  it("zmiana terminu aktualizuje istniejące wydarzenie zamiast tworzyć nowe", async () => {
    const old = await addMessage("Wycieczka do ZOO 10.10", "2026-10-01T08:00:00Z", true);
    await db.client.query(
      `insert into events (group_id, title, starts_at, all_day, source_message_ids, confidence, rationale)
       values ($1, 'Wycieczka do ZOO', '2026-10-09T22:00:00Z', true, array[$2::uuid], 0.9, 'x')`,
      [groupId, old],
    );
    const now = await addMessage("Wycieczka przeniesiona na 17.10", "2026-10-07T10:00:00Z");
    const { model, prompts } = scripted((p) => {
      const alias = [...p.aliases.items].find(([, v]) => v.type === "event")![0];
      return [op({ op: "update", type: "event", target: alias, data: { start: "2026-10-17" }, source_messages: [lastAlias(p)] })];
    });

    expect(await runGroupExtraction(deps(model), groupId)).toMatchObject({ status: "ok", updated: 1 });
    expect(prompts[0]!.user).toContain("Wycieczka do ZOO");
    const { rows } = await db.client.query("select * from events");
    expect(rows).toHaveLength(1);
    expect(new Date(rows[0].starts_at).toISOString()).toBe("2026-10-16T22:00:00.000Z");
    expect(rows[0].source_message_ids.sort()).toEqual([old, now].sort());
  });

  it("odwołanie ustawia status cancelled", async () => {
    await db.client.query(
      "insert into events (group_id, title, starts_at, all_day) values ($1, 'Teatrzyk', '2026-10-13T22:00:00Z', true)",
      [groupId],
    );
    await addMessage("Teatrzyk w środę odwołany", "2026-10-07T10:00:00Z");
    const { model } = scripted((p) => [
      op({ op: "cancel", type: "event", target: "E1", source_messages: [lastAlias(p)] }),
    ]);
    expect(await runGroupExtraction(deps(model), groupId)).toMatchObject({ cancelled: 1 });
    expect((await db.client.query("select status from events")).rows[0].status).toBe("cancelled");
  });

  it("rozmowa bez treści organizacyjnej nie tworzy elementów, ale oznacza wiadomości", async () => {
    await addMessage("Dziękujemy! 😊", "2026-10-07T10:00:00Z");
    await addMessage("👍", "2026-10-07T10:01:00Z");
    const { model } = scripted(() => []);
    expect(await runGroupExtraction(deps(model), groupId)).toMatchObject({ status: "ok", messages: 2, created: 0 });
    expect((await db.client.query("select count(*)::int as n from messages where processed_at is null")).rows[0].n).toBe(0);
    for (const t of ["events", "payments", "bring_items"]) {
      expect((await db.client.query(`select count(*)::int as n from ${t}`)).rows[0].n).toBe(0);
    }
  });

  it("niska pewność daje status needs_review", async () => {
    await addMessage("chyba trzeba będzie coś wpłacić na wycieczkę?", "2026-10-07T10:00:00Z");
    const { model } = scripted((p) => [
      op({
        op: "create",
        type: "payment",
        ref: null,
        data: { description: "wycieczka", amount_pln: null, due_date: null },
        source_messages: [lastAlias(p)],
        confidence: 0.5,
      }),
    ]);
    expect(await runGroupExtraction(deps(model), groupId)).toMatchObject({ needsReview: 1 });
    expect((await db.client.query("select status from payments")).rows[0].status).toBe("needs_review");
  });

  it("odrzuca nieznane aliasy i niepoprawne dane, zapisując resztę i powód w dzienniku", async () => {
    await addMessage("Jutro dzień kropki, kolorowe ubrania", "2026-10-07T10:00:00Z");
    const { model } = scripted((p) => [
      op({ op: "cancel", type: "event", target: "E99", source_messages: [lastAlias(p)] }),
      op({
        op: "create",
        type: "event",
        ref: null,
        data: { title: "Zły", start: "2026-10-09", end: "2026-10-01", all_day: true, location: null, whole_kindergarten: false },
        source_messages: [lastAlias(p)],
      }),
      op({
        op: "create",
        type: "event",
        ref: null,
        data: { title: "Dzień kropki", start: "2026-10-08", end: null, all_day: true, location: null, whole_kindergarten: true },
        source_messages: [lastAlias(p)],
      }),
    ]);
    const result = await runGroupExtraction(deps(model), groupId);
    expect(result).toMatchObject({ status: "ok", created: 1 });
    const { rows } = await db.client.query("select title, group_id from events");
    expect(rows).toEqual([{ title: "Dzień kropki", group_id: null }]);
    const { rows: log } = await db.client.query("select status, details from sync_log");
    expect(log[0].status).toBe("partial");
    expect(log[0].details.rejected.map((r: { index: number }) => r.index)).toEqual([0, 1]);
  });

  it("błąd modelu zostawia wiadomości nieprzetworzone i zapisuje błąd w dzienniku", async () => {
    await addMessage("W piątek bal", "2026-10-07T10:00:00Z");
    const failing: ExtractionModel = {
      async extract() {
        throw Object.assign(new Error("overloaded"), { name: "InternalServerError", status: 529 });
      },
    };
    await expect(runGroupExtraction(deps(failing), groupId)).rejects.toThrow("overloaded");
    expect((await db.client.query("select count(*)::int as n from messages where processed_at is null")).rows[0].n).toBe(1);
    const { rows } = await db.client.query("select status, details from sync_log");
    expect(rows[0]).toMatchObject({ status: "error", details: { error: "InternalServerError", reason: 529 } });
  });

  it("nie uruchamia dwóch ekstrakcji tej samej grupy naraz", async () => {
    await addMessage("W piątek bal", "2026-10-07T10:00:00Z");
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const slow: ExtractionModel = {
      async extract() {
        await gate;
        return { operations: [] };
      },
    };
    const first = runGroupExtraction(deps(slow), groupId);
    await new Promise((r) => setTimeout(r, 100));
    expect(await runGroupExtraction(deps(slow), groupId)).toEqual({ status: "locked" });
    release();
    expect(await first).toMatchObject({ status: "ok" });
  });

  it("aktualizacja rzeczy zachowuje powiązane wydarzenie, a podaje istniejące elementy z aliasami", async () => {
    const { rows: ev } = await db.client.query(
      "insert into events (group_id, title, starts_at, all_day) values ($1, 'Bal', '2026-10-08T22:00:00Z', true) returning id",
      [groupId],
    );
    await db.client.query(
      "insert into bring_items (group_id, event_id, description, due_date) values ($1, $2, 'przebranie', '2026-10-09')",
      [groupId, ev[0].id],
    );
    await addMessage("Przebrania mają być jesienne", "2026-10-07T10:00:00Z");
    const { model, prompts } = scripted((p) => [
      op({ op: "update", type: "bring_item", target: "E2", data: { description: "jesienne przebranie" }, source_messages: [lastAlias(p)] }),
    ]);
    expect(await runGroupExtraction(deps(model), groupId)).toMatchObject({ updated: 1 });
    expect(prompts[0]!.user).toContain('"event":"E1"');
    const { rows } = await db.client.query("select description, event_id from bring_items");
    expect(rows[0]).toEqual({ description: "jesienne przebranie", event_id: ev[0].id });
  });

  it("element poprawiony przez admina: zmiana trafia do kolejki zamiast nadpisać decyzję", async () => {
    const old = await addMessage("Wycieczka do ZOO 16.10", "2026-10-01T08:00:00Z", true);
    const { rows: ev } = await db.client.query(
      `insert into events (group_id, title, starts_at, all_day, source_message_ids, confidence, rationale, reviewed_at)
       values ($1, 'Wycieczka do ZOO', '2026-10-15T22:00:00Z', true, array[$2::uuid], 0.9, 'x', now()) returning id`,
      [groupId, old],
    );
    const now = await addMessage("Wycieczka 17.10", "2026-10-07T10:00:00Z");
    const { model } = scripted((p) => [
      op({ op: "update", type: "event", target: "E1", data: { start: "2026-10-17" }, source_messages: [lastAlias(p)] }),
    ]);

    expect(await runGroupExtraction(deps(model), groupId)).toMatchObject({ status: "ok", updated: 0, needsReview: 1 });
    const { rows } = await db.client.query("select * from events where id = $1", [ev[0].id]);
    expect(new Date(rows[0].starts_at).toISOString()).toBe("2026-10-15T22:00:00.000Z");
    expect(rows[0].status).toBe("active");
    expect(rows[0].source_message_ids).toEqual([old]);
    expect(rows[0].pending_patch).toEqual({
      op: "update",
      data: { start: "2026-10-17" },
      confidence: 0.95,
      rationale: "Uzasadnienie.",
      source_message_ids: [now],
    });
  });

  it("odwołanie elementu zatwierdzonego przez admina też trafia do kolejki", async () => {
    await db.client.query(
      "insert into events (group_id, title, starts_at, all_day, reviewed_at) values ($1, 'Teatrzyk', '2026-10-13T22:00:00Z', true, now())",
      [groupId],
    );
    await addMessage("Teatrzyk odwołany", "2026-10-07T10:00:00Z");
    const { model } = scripted((p) => [op({ op: "cancel", type: "event", target: "E1", source_messages: [lastAlias(p)] })]);
    expect(await runGroupExtraction(deps(model), groupId)).toMatchObject({ cancelled: 0, needsReview: 1 });
    const { rows } = await db.client.query("select status, pending_patch->>'op' as proposal from events");
    expect(rows[0]).toEqual({ status: "active", proposal: "cancel" });
  });

  it("przypisuje dzieci z listy (bez względu na wielkość liter), pomija nieznane, update zmienia przypisanie", async () => {
    const { rows: kids } = await db.client.query<{ id: string; name: string }>(
      "insert into children (name, group_id) values ('Zosia', $1), ('Antek', null) returning id, name",
      [groupId],
    );
    const zosia = kids.find((c) => c.name === "Zosia")!.id;
    const antek = kids.find((c) => c.name === "Antek")!.id;
    await addMessage("Zosia przynosi jutro kasztany", "2026-10-07T16:02:00Z");
    const first = scripted((p) => [
      op({
        op: "create",
        type: "bring_item",
        ref: null,
        data: { description: "kasztany", due_date: "2026-10-08", event: null },
        children: ["zosia", "Kasia"],
        source_messages: [lastAlias(p)],
      }),
    ]);
    await runGroupExtraction(deps(first.model), groupId);
    expect(first.prompts[0]!.user).toContain('"Zosia" – grupa "Motylki"');
    const { rows: created } = await db.client.query("select id, child_ids from bring_items");
    expect(created).toEqual([{ id: expect.any(String), child_ids: [zosia] }]);

    await addMessage("Sorry, kasztany przynosi Antek", "2026-10-07T16:30:00Z");
    const second = scripted((p) => [
      op({ op: "update", type: "bring_item", target: "E1", data: {}, children: ["Antek"], source_messages: [lastAlias(p)] }),
    ]);
    await runGroupExtraction(deps(second.model), groupId);
    expect(second.prompts[0]!.user).toContain('| dzieci: ["Zosia"]');
    const { rows: updated } = await db.client.query("select child_ids, description from bring_items");
    expect(updated).toEqual([{ child_ids: [antek], description: "kasztany" }]);
  });
});
