import type { DropOff } from "../lib/items";

interface Place {
  icon: string;
  name: string;
  bg: string;
}

/** The kindergarten's usual drop-off places, recognised by a word in the place name. */
const PLACES: { match: RegExp; place: Place }[] = [
  { match: /\bbaz(a|y|ie|ę)\b/i, place: { icon: "🏡", name: "Baza", bg: "#e3ea8c" } },
  { match: /witosa/i, place: { icon: "🏫", name: "Witosa", bg: "#b8dff4" } },
  { match: /p[ęe]g[óo]w/i, place: { icon: "🌲", name: "Pęgów", bg: "#a9e2d4" } },
  { match: /\book\b|ośrodek kultury|osrodek kultury/i, place: { icon: "🎭", name: "OOK", bg: "#d8c9f3" } },
  { match: /\bkin(o|a|ie)\b/i, place: { icon: "🎬", name: "Kino", bg: "#f6c3cb" } },
  { match: /dworz|dworc|\bpkp\b|stacj/i, place: { icon: "🚉", name: "Dworzec", bg: "#f8d88a" } },
];

const OTHER: Omit<Place, "name"> = { icon: "📍", bg: "#e4d7bf" };

/** A main place (Baza, Witosa, Pęgów, OOK, Kino, Dworzec) with its icon, or 📍 with the place as written. */
export function placeOf(text: string): Place & { known: boolean } {
  const hit = PLACES.find((p) => p.match.test(text));
  return hit ? { ...hit.place, known: true } : { ...OTHER, name: text, known: false };
}

/** Tag of a place; the full text stays in the title when it says more than the short name. */
export function PlaceTag({ place }: { place: string }) {
  const p = placeOf(place);
  return (
    <span
      title={place}
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold text-ink"
      style={{ background: p.bg }}
    >
      <span aria-hidden>{p.icon}</span>
      {p.known ? p.name : place}
    </span>
  );
}

const hour = (t: string) => t.replace(/^0(\d)/, "$1");

/** "🏡 Baza od 8:30 do 8:45": where and until when to bring the child (event-plan). */
export function DropOffTag({ dropOff }: { dropOff: DropOff }) {
  const times = [dropOff.from ? `od ${hour(dropOff.from)}` : null, dropOff.until ? `do ${hour(dropOff.until)}` : null].filter(Boolean).join(" ");
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <PlaceTag place={dropOff.place} />
      {times && <span>{times}</span>}
    </span>
  );
}

/** All drop-off options of an event, "albo" between them. */
export function DropOffs({ items }: { items: DropOff[] }) {
  return (
    <span aria-label="Gdzie przyprowadzić" className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
      {items.map((d, i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          {i > 0 && <span className="text-muted">albo</span>}
          <DropOffTag dropOff={d} />
        </span>
      ))}
    </span>
  );
}
