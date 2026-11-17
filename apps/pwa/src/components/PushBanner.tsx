import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { androidBridge } from "../lib/androidApp";
import { readPublicEnv } from "../lib/env";
import { currentSubscription, dismissPushBanner, enablePush, isPushBannerDismissed, notificationPermission, pushSupport } from "../lib/push";
import { IosInstructions } from "./IosInstructions";

/**
 * Invites the user to turn on push on this device with one tap. Never asks for permission
 * on its own: the browser prompt appears only after "Włącz".
 */
export function PushBanner() {
  const { client } = useAuth();
  const { pathname } = useLocation();
  const { apiUrl, vapidPublicKey } = readPublicEnv();
  const support = pushSupport();
  const configured = apiUrl != null && vapidPublicKey != null;
  // Czyżyk Connect (Android WebView) has no Web Push.
  const eligible = configured && androidBridge() == null && support !== "unsupported" && notificationPermission() !== "denied" && !isPushBannerDismissed();
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [hidden, setHidden] = useState(false);
  const [showIos, setShowIos] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!eligible || support !== "supported") return;
    let alive = true;
    void currentSubscription().then(
      (s) => alive && setSubscribed(s != null),
      () => alive && setSubscribed(false),
    );
    return () => {
      alive = false;
    };
  }, [eligible, support]);

  // iPhone outside the home screen cannot subscribe, so there is nothing to wait for.
  const known = support === "ios-needs-install" || subscribed === false;
  if (!eligible || hidden || !known || pathname.startsWith("/ustawienia")) return null;

  const enable = async () => {
    setMessage(null);
    if (support === "ios-needs-install") return setShowIos(true);
    setBusy(true);
    try {
      await enablePush(client, apiUrl!, vapidPublicKey!);
      setHidden(true);
    } catch (error) {
      if ((error as Error).message === "permission") {
        // Refused in the browser prompt: asking again would not help.
        if (notificationPermission() === "denied") return setHidden(true);
        setMessage("Przeglądarka nie zezwoliła na powiadomienia.");
      } else {
        setMessage("Nie udało się włączyć powiadomień. Spróbuj w Ustawieniach.");
      }
    } finally {
      setBusy(false);
    }
  };

  const later = () => {
    dismissPushBanner();
    setHidden(true);
  };

  return (
    <section aria-label="Włącz powiadomienia" className="mb-4 space-y-3 rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-700">
        <strong className="text-ink">Włącz powiadomienia</strong>, żeby dostawać skrót na jutro i alerty o zmianach w przedszkolu.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void enable()}
          className="rounded-lg bg-brand-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          Włącz
        </button>
        <button type="button" onClick={later} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">
          Nie teraz
        </button>
      </div>
      {showIos && <IosInstructions />}
      {message && (
        <p role="status" className="text-sm text-slate-700">
          {message}
        </p>
      )}
    </section>
  );
}
