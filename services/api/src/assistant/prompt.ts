import type Anthropic from "@anthropic-ai/sdk";
import type { AssistantTurn } from "@czyzyk/shared";
import { dayWithWeekday, warsawDate, type ViewContext } from "./context.js";

/** Escapes the closing tag so data cannot end the <dane> block early. */
function fence(text: string): string {
  return text.replaceAll("</dane>", "<\\/dane>");
}

export function buildAssistantMessages(
  context: ViewContext,
  question: string,
  history: AssistantTurn[],
  now: Date,
): Anthropic.MessageParam[] {
  const today = dayWithWeekday(warsawDate(now));
  return [
    ...history.map((t): Anthropic.MessageParam => ({ role: t.role, content: t.content })),
    {
      role: "user",
      content: [
        { type: "text", text: `Dziś jest ${today} (Europe/Warsaw).\nEkran: ${context.title}\n\n<dane>\n${fence(context.data)}\n</dane>` },
        { type: "text", text: `Pytanie: ${question}` },
      ],
    },
  ];
}
