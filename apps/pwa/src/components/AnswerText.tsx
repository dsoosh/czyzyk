import { isAppPlace } from "@czyzyk/shared/assistant";
import type { ReactNode } from "react";
import { Link } from "react-router";

const MARKDOWN_LINK = /\[([^\]\n]{1,80})\]\(([^)\s]{1,120})\)/g;

/**
 * An assistant answer: plain text with markdown links to known places in the app turned into
 * in-app links. Any other link (the answer may echo message content) stays as its label.
 */
export function AnswerText({ text, onNavigate }: { text: string; onNavigate: () => void }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(MARKDOWN_LINK)) {
    const [whole, label, path] = m;
    parts.push(text.slice(last, m.index));
    parts.push(
      isAppPlace(path!) ? (
        <Link key={m.index} to={path!} onClick={onNavigate} className="font-semibold text-clay-700 underline underline-offset-2">
          {label}
        </Link>
      ) : (
        label
      ),
    );
    last = m.index! + whole.length;
  }
  parts.push(text.slice(last));
  return <>{parts}</>;
}
