import pg from "pg";
import type { Logger } from "pino";

export const MESSAGE_INGESTED_CHANNEL = "message_ingested";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface MessageListener {
  /** Resolves once LISTEN is active (tests wait for it before inserting). */
  ready: Promise<void>;
  stop(): Promise<void>;
}

/**
 * Keeps a dedicated connection listening for new unprocessed messages (migration 0009)
 * and reports their group ids. Reconnects after errors until stopped; the minute scan
 * covers notifications lost in between. The payload is a group id, never message content.
 */
export function listenForMessages(
  databaseUrl: string,
  onGroup: (groupId: string) => Promise<void>,
  logger: Logger,
  reconnectDelayMs = 5000,
): MessageListener {
  let stopped = false;
  let client: pg.Client | null = null;
  let timer: NodeJS.Timeout | null = null;
  let markReady: () => void = () => {};
  const ready = new Promise<void>((resolve) => (markReady = resolve));

  const scheduleReconnect = () => {
    if (stopped || timer) return;
    timer = setTimeout(() => {
      timer = null;
      void connect();
    }, reconnectDelayMs);
    timer.unref();
  };

  const connect = async () => {
    const c = new pg.Client({ connectionString: databaseUrl });
    client = c;
    c.on("notification", (n) => {
      if (n.channel !== MESSAGE_INGESTED_CHANNEL || !n.payload || !UUID.test(n.payload)) return;
      onGroup(n.payload).catch((error: unknown) =>
        logger.warn({ groupId: n.payload, error: error instanceof Error ? error.name : "Error" }, "enqueue after notification failed"),
      );
    });
    const lost = (error?: Error) => {
      if (stopped || client !== c) return;
      logger.warn({ error: error?.name ?? "connection closed" }, "message listener lost, reconnecting");
      client = null;
      c.removeAllListeners("end");
      c.end().catch(() => {});
      scheduleReconnect();
    };
    c.on("error", lost);
    c.on("end", () => lost());
    try {
      await c.connect();
      await c.query(`listen ${MESSAGE_INGESTED_CHANNEL}`);
      logger.info("listening for new messages");
      markReady();
    } catch (error) {
      lost(error instanceof Error ? error : undefined);
    }
  };

  void connect();

  return {
    ready,
    async stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      const c = client;
      client = null;
      await c?.end().catch(() => {});
    },
  };
}
