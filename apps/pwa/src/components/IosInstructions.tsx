/** Web Push on iPhone works only from the home screen app. */
export function IosInstructions() {
  return (
    <div role="note" aria-label="Instrukcja dla iPhone'a" className="space-y-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
      <p className="font-semibold">Na iPhonie powiadomienia działają tylko z aplikacji na ekranie początkowym.</p>
      <ol className="list-decimal space-y-1 pl-5">
        <li>
          Stuknij <strong>Udostępnij</strong> (kwadrat ze strzałką) na dole Safari.
        </li>
        <li>
          Wybierz <strong>Do ekranu początkowego</strong> i potwierdź.
        </li>
        <li>Otwórz Czyżyka z nowej ikony i włącz powiadomienia.</li>
      </ol>
    </div>
  );
}
