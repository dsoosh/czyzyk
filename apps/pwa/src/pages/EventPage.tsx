import { Link, useParams } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { LoadError, Loading, SourceLink } from "../components/ui";
import { longDayLabel, warsawDay, warsawTime } from "../lib/dates";
import { fetchEvent, groupLabel } from "../lib/items";
import { useLoader } from "../lib/useLoader";

export function EventPage() {
  const { id = "" } = useParams();
  const { client } = useAuth();
  const { data, error, loading, reload } = useLoader(() => fetchEvent(client, id), [client, id]);
  if (error) return <LoadError message={error} onRetry={reload} />;
  if (!data) return loading ? <Loading /> : null;
  const { event, bring, groups } = data;
  if (!event) return <p className="text-slate-600">Nie znaleziono wydarzenia.</p>;

  const day = warsawDay(event.starts_at);
  const when = event.all_day
    ? `${longDayLabel(day)}, cały dzień`
    : `${longDayLabel(day)}, ${warsawTime(event.starts_at)}${event.ends_at ? `–${warsawTime(event.ends_at)}` : ""}`;

  return (
    <article className="space-y-4">
      <Link to="/kalendarz" className="text-sm text-brand-700">
        ← Kalendarz
      </Link>
      <h1 className="text-2xl font-bold text-brand-900">{event.title}</h1>
      {event.status === "cancelled" && <p className="font-semibold text-red-700">Odwołane</p>}
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-2xl bg-white p-4 shadow-sm">
        <dt className="text-slate-500">Termin</dt>
        <dd>{when}</dd>
        {event.location && (
          <>
            <dt className="text-slate-500">Miejsce</dt>
            <dd>{event.location}</dd>
          </>
        )}
        <dt className="text-slate-500">Grupa</dt>
        <dd>{groupLabel(groups, event.group_id)}</dd>
      </dl>
      <section aria-label="Do przyniesienia" className="space-y-2">
        <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">Do przyniesienia</h2>
        {bring.length === 0 ? (
          <p className="text-slate-500">Nic</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-2xl bg-white shadow-sm">
            {bring.map((b) => (
              <li key={b.id} className="flex items-center justify-between p-4">
                <span>{b.description}</span>
                <SourceLink kind="bring_item" id={b.id} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <SourceLink kind="event" id={event.id} />
    </article>
  );
}
