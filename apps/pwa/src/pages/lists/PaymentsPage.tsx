import { useState } from "react";
import { useAuth, useProfile } from "../../auth/AuthProvider";
import { DoneToggle, LoadError, Loading, Meta, Row, Section, SourceLink } from "../../components/ui";
import { dayLabel, warsawDay } from "../../lib/dates";
import { formatAmount, groupLabel, type Payment } from "../../lib/items";
import { doneLabel, fetchPaymentList, sortOpenPayments } from "../../lib/tracking";
import { useLoader, useOnForeground } from "../../lib/useLoader";
import { useMarkDone } from "../../lib/useMarkDone";

export function PaymentsPage() {
  const { client } = useAuth();
  const me = useProfile().id;
  const [today] = useState(() => warsawDay(new Date()));
  const { data, error, loading, reload } = useLoader(() => fetchPaymentList(client), [client]);
  const mark = useMarkDone("payment", reload);
  useOnForeground(reload);

  if (error) return <LoadError message={error} onRetry={reload} />;
  if (!data) return loading ? <Loading /> : null;

  const row = (p: Payment) => {
    const overdue = p.paid_at == null && p.due_date != null && p.due_date < today;
    return (
      <Row key={p.id}>
        <div className="flex items-start gap-3">
          <DoneToggle
            checked={p.paid_at != null}
            label={`${p.description}: zapłacone`}
            disabled={mark.pending === p.id}
            onToggle={() => void mark.toggle(p.id, p.paid_at == null)}
          />
          <div className="flex flex-1 flex-col gap-1">
            <span className={p.paid_at ? "text-slate-400" : "font-medium"}>
              {p.description}
              {p.amount_pln != null && <span className="text-brand-700"> · {formatAmount(p.amount_pln)}</span>}
            </span>
            <Meta>
              {overdue && <span className="rounded bg-red-100 px-1.5 font-semibold text-red-700">po terminie</span>}
              {p.due_date && <span className={overdue ? "text-red-700" : ""}>do {dayLabel(p.due_date, today)}</span>}
              <span>{p.paid_at ? doneLabel("zapłacone", p.paid_by, p.paid_at, me, data.people, today) : "do zapłaty"}</span>
              <span>{groupLabel(data.groups, p.group_id)}</span>
              <SourceLink kind="payment" id={p.id} />
            </Meta>
          </div>
        </div>
      </Row>
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-brand-900">Płatności</h1>
      {mark.error && <p role="alert" className="text-red-700">{mark.error}</p>}
      <Section title="Do zapłaty" empty="Wszystko zapłacone">
        {sortOpenPayments(data.open, today).map(row)}
      </Section>
      {data.paid.length > 0 && (
        <details className="space-y-2">
          <summary className="cursor-pointer text-sm font-semibold tracking-wide text-slate-500 uppercase">
            Zapłacone ({data.paid.length})
          </summary>
          <ul aria-label="Zapłacone" className="mt-2 divide-y divide-slate-100 rounded-2xl bg-white shadow-sm">
            {data.paid.map(row)}
          </ul>
        </details>
      )}
    </div>
  );
}
