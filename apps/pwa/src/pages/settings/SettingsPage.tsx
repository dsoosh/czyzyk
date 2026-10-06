import { CalendarSubscription } from "./CalendarSubscription";
import { PushSettingsSection } from "./PushSettingsSection";

export function SettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl font-bold text-ink">Ustawienia</h1>
      <PushSettingsSection />
      <CalendarSubscription />
    </div>
  );
}
