import { androidBridge } from "../../lib/androidApp";
import { CalendarSubscription } from "./CalendarSubscription";
import { ChildrenSection } from "./ChildrenSection";
import { FamilySection } from "./FamilySection";
import { MyPhoneSection } from "./MyPhoneSection";
import { PushSettingsSection } from "./PushSettingsSection";

export function SettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl font-bold text-ink">Ustawienia</h1>
      <PhoneSettingsButton />
      <ChildrenSection />
      <FamilySection />
      <MyPhoneSection />
      <PushSettingsSection />
      <CalendarSubscription />
    </div>
  );
}

/** Inside the Android app: opens its native screen (pairing, permissions, sync). */
function PhoneSettingsButton() {
  const bridge = androidBridge();
  if (!bridge) return null;
  return (
    <button type="button" onClick={() => bridge.openPhoneSettings()} className="w-full rounded-full bg-ink px-5 py-3 font-semibold text-cream">
      Ustawienia telefonu
    </button>
  );
}
