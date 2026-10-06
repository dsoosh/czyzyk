import { Link } from "react-router";
import { useAuth } from "../../auth/AuthProvider";
import { LoadError, Loading } from "../../components/ui";
import { dayLabel, warsawDay, warsawTime } from "../../lib/dates";
import { fetchTrackedGroups } from "../../lib/history";
import { useLoader, useOnForeground } from "../../lib/useLoader";

/** Tracked groups with their newest message; tapping one opens its history. */
export function ChatsPage() {
  const { client } = useAuth();
  const { data, error, reload } = useLoader(() => fetchTrackedGroups(client), [client]);
  useOnForeground(reload);
  const today = warsawDay(new Date());

  if (error) return <LoadError message={error} onRetry={reload} />;
  if (!data) return <Loading />;

  return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl font-bold text-ink">Czaty</h1>
      {data.length === 0 ? (
        <p className="rounded-2xl bg-white p-4 text-slate-500 shadow-sm">Żadna grupa nie jest jeszcze śledzona.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-2xl bg-white shadow-sm">
          {data.map((g) => (
            <li key={g.id}>
              <Link to={`/czaty/${g.id}`} className="flex flex-col gap-1 p-4 hover:bg-brand-50">
                <span className="flex justify-between gap-2">
                  <span className="font-semibold">{g.name}</span>
                  {g.last && (
                    <span className="shrink-0 text-xs text-slate-500">
                      {dayLabel(warsawDay(g.last.sent_at), today)} {warsawTime(g.last.sent_at)}
                    </span>
                  )}
                </span>
                <span className="truncate text-sm text-slate-500">
                  {g.last ? `${g.last.author}: ${g.last.text || (g.last.has_attachment ? "📎 załącznik" : "")}` : "Brak wiadomości"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
