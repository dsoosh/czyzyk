import type { ScheduleStep } from "../lib/items";

/** Colours of the steps, in turn (muted navy, sky, gold, coral, sage), as in an infographic timeline. */
const COLORS = ["#4f6587", "#5fb3c4", "#d9a521", "#d9584f", "#6faa7d"];

const hour = (t: string) => t.replace(/^0(\d)/, "$1");

/**
 * The event's plan for the day (event-plan) as a horizontal timeline: arrow segments on one
 * line, times and labels alternately above and below it; scrolls sideways on a phone.
 */
export function EventTimeline({ steps }: { steps: ScheduleStep[] }) {
  return (
    <section aria-label="Plan dnia" className="space-y-2">
      <h2 className="font-display text-2xl font-bold text-ink">Plan dnia</h2>
      <div className="overflow-x-auto rounded-2xl bg-white px-2 py-4 shadow-sm">
        <ol className="flex min-w-max">
          {steps.map((s, i) => {
            const color = COLORS[i % COLORS.length]!;
            const above = i % 2 === 0;
            const card = (
              <div className={`flex flex-col items-center text-center ${above ? "" : "flex-col-reverse"}`}>
                <span className="px-1 text-sm leading-tight text-slate-700">{s.label}</span>
                <span className="font-display text-2xl leading-none font-bold" style={{ color }}>
                  {hour(s.time)}
                  {s.end ? `–${hour(s.end)}` : ""}
                </span>
                <span aria-hidden className="h-4 w-0.5" style={{ background: color }} />
              </div>
            );
            return (
              <li key={`${s.time}-${i}`} className="flex w-36 flex-col items-stretch">
                <div className="flex h-24 flex-col items-center justify-end">{above && card}</div>
                <div
                  aria-hidden
                  className="relative flex h-5 items-center justify-center"
                  style={{ background: color, clipPath: "polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%)" }}
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-white" />
                </div>
                <div className="flex h-24 flex-col items-center justify-start">{!above && card}</div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
