import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useAuth, useProfile } from "../auth/AuthProvider";
import { EventHistory } from "../components/EventHistory";
import { LoadError, Loading, SourceLink } from "../components/ui";
import { longDayLabel, warsawDay, warsawTime } from "../lib/dates";
import { deleteEvent, fetchEvent, groupLabel } from "../lib/items";
import { useLoader } from "../lib/useLoader";
import { repeatLabel } from "../lib/recurrence";

/** Map search for an event's place (event location). */
export function mapUrl(location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}

export function EventPage() {
  const { id = "" } = useParams();
  const { client } = useAuth();
  const isAdmin = useProfile().role === "admin";
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
      <h1 className="font-display text-4xl font-bold text-ink">{event.title}</h1>
      {event.status === "cancelled" && <p className="font-semibold text-red-700">Odwołane</p>}
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-2xl bg-white p-4 shadow-sm">
        <dt className="text-slate-500">Termin</dt>
        <dd>{repeatLabel(event) ? `${repeatLabel(event)}, od ${when}` : when}</dd>
        {event.location && (
          <>
            <dt className="text-slate-500">Miejsce</dt>
            <dd>
              {event.location}{" "}
              <a href={mapUrl(event.location)} target="_blank" rel="noreferrer" className="text-sm text-brand-700 underline">
                Mapa
              </a>
            </dd>
          </>
        )}
        {event.meeting_point && (
          <>
            <dt className="text-slate-500">Zbiórka</dt>
            <dd>
              {event.meeting_point}{" "}
              <a href={mapUrl(event.meeting_point)} target="_blank" rel="noreferrer" className="text-sm text-brand-700 underline">
                Mapa
              </a>
            </dd>
          </>
        )}
        <dt className="text-slate-500">Grupa</dt>
        <dd>{groupLabel(groups, event.group_id)}</dd>
      </dl>
      <section aria-label="Do przyniesienia" className="space-y-2">
        <h2 className="font-display text-2xl font-bold text-ink">Do przyniesienia</h2>
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
      <EventHistory eventId={event.id} />
      <SourceLink kind="event" id={event.id} />
      {isAdmin && <DeleteEvent id={event.id} title={event.title} />}
    </article>
  );
}

/** Admin only (event-deletion): removes a wrong or duplicate event after a confirmation. */
function DeleteEvent({ id, title }: { id: string; title: string }) {
  const { client } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remove = async () => {
    if (!window.confirm(`Usunąć wydarzenie „${title}”? Tego nie da się cofnąć.`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteEvent(client, id);
      navigate("/kalendarz", { replace: true });
    } catch {
      setError("Nie udało się usunąć wydarzenia.");
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2 border-t border-slate-200 pt-4">
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        {busy ? "Usuwanie…" : "Usuń wydarzenie"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
