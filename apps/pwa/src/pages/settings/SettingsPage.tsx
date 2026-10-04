import { CalendarSubscription } from "./CalendarSubscription";

export function SettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-brand-900">Ustawienia</h1>
      <CalendarSubscription />
    </div>
  );
}
