import cors from "@fastify/cors";
import { assistantAskSchema, type AssistantAnswer } from "@czyzyk/shared";
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import type { SessionVerifier } from "../push/session.js";
import type { DailyLimiter, RateLimiter } from "../rateLimit.js";
import { loadViewContext, warsawDate } from "./context.js";
import type { AssistantModel } from "./model.js";
import { ASSISTANT_SYSTEM, buildAssistantMessages } from "./prompt.js";

export const NO_ANSWER = "Nie mogę odpowiedzieć na to pytanie.";

/**
 * Questions about the screen a family member is looking at. The server loads the
 * screen's data itself; the model has no tools. Logs carry the view kind, counts
 * and statuses only, never questions, answers or message content.
 */
export async function assistantRoutes(
  app: FastifyInstance,
  opts: {
    db: pg.Pool;
    verify: SessionVerifier | null;
    model: AssistantModel | null;
    origins: string[];
    perUser: RateLimiter;
    daily: DailyLimiter;
    now?: () => number;
  },
) {
  const { db } = opts;
  const now = opts.now ?? Date.now;
  await app.register(cors, { origin: opts.origins, methods: ["POST"], allowedHeaders: ["authorization", "content-type"], maxAge: 3600 });

  app.post("/ask", async (request, reply) => {
    if (!opts.verify || !opts.model) return reply.code(503).send({ error: "assistant_not_configured" });
    const header = request.headers.authorization ?? "";
    let userId: string;
    try {
      if (!header.startsWith("Bearer ")) throw new Error("missing token");
      userId = await opts.verify(header.slice(7).trim());
    } catch {
      return reply.code(401).send({ error: "unauthorized" });
    }
    // Same rule as is_family(): a profile row means a family member.
    const { rowCount: isFamily } = await db.query("select 1 from public.profiles where id = $1", [userId]);
    if (!isFamily) return reply.code(403).send({ error: "forbidden" });

    const parsed = assistantAskSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_request", fields: [...new Set(parsed.error.issues.map((i) => i.path.join(".") || "(root)"))] });
    }
    const { view, question, history } = parsed.data;

    const at = new Date(now());
    if (!opts.perUser.hit(`assistant:${userId}`)) return reply.code(429).send({ error: "rate_limited" });
    if (!opts.daily.hit(userId, warsawDate(at))) return reply.code(429).send({ error: "daily_limit" });

    const context = await loadViewContext(db, view, at);
    const result = await opts.model.answer({ system: ASSISTANT_SYSTEM, messages: buildAssistantMessages(context, question, history, at) });

    request.log.info(
      { view: view.kind, answered: result.text !== null, inputTokens: result.usage.input_tokens, outputTokens: result.usage.output_tokens },
      "assistant answered",
    );
    const body: AssistantAnswer = { answer: result.text ?? NO_ANSWER };
    return body;
  });
}
