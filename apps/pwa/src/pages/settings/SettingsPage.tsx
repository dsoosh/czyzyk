import { CalendarSubscription } from "./CalendarSubscription";
import { PushSettingsSection } from "./PushSettingsSection";

export function SettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-brand-900">Ustawienia</h1>
      <PushSettingsSection />
      <CalendarSubscription />
    </div>
  );
}
