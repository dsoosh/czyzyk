import { splitLinks } from "../lib/links";

/** Message text with its links clickable under a short name; the full address in the title. */
export function MessageText({ text, className = "" }: { text: string; className?: string }) {
  return (
    <p className={`whitespace-pre-wrap break-words ${className}`}>
      {splitLinks(text).map((part, i) =>
        "url" in part ? (
          <a
            key={i}
            href={part.url}
            title={part.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            onClick={(e) => e.stopPropagation()}
            className="font-semibold text-brand-700 underline underline-offset-2"
          >
            🔗 {part.label}
          </a>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </p>
  );
}
