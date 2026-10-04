import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { App } from "../App";
import { AuthProvider } from "../auth/AuthProvider";
import { adminProfile, fakeSupabase, familyProfile, type FakeOptions } from "./fakeSupabase";

/** Renders the whole app at `path` for a signed-in family member (or admin). */
export function renderAt(path: string, options: FakeOptions & { admin?: boolean } = {}) {
  const profile = options.admin ? adminProfile : familyProfile;
  const fake = fakeSupabase({ userId: profile.id, profile, ...options });
  const view = render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider client={fake.client}>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
  return { ...fake, ...view };
}

const base = { group_id: "g1", source_message_ids: ["m1"], confidence: 0.95, rationale: "Uzasadnienie.", status: "active" };

export const fixtures = {
  groups: [{ id: "g1", wa_name: "Motylki 2026/27", display_name: "Motylki", tracked: true }],
  event: (o: Record<string, unknown> = {}) => ({ ...base, id: "e1", title: "Bal", starts_at: "2026-10-08T22:00:00.000Z", ends_at: null, all_day: true, location: null, ...o }),
  bring: (o: Record<string, unknown> = {}) => ({ ...base, id: "b1", event_id: "e1", description: "przebranie", due_date: "2026-10-09", packed_by: null, packed_at: null, ...o }),
  payment: (o: Record<string, unknown> = {}) => ({ ...base, id: "p1", description: "teatrzyk", amount_pln: 10, due_date: "2026-10-09", paid_by: null, paid_at: null, ...o }),
  action: (o: Record<string, unknown> = {}) => ({ ...base, id: "a1", question: "Zgoda na wycieczkę", due_date: "2026-10-12", resolved_by: null, resolved_at: null, ...o }),
  closure: (o: Record<string, unknown> = {}) => ({ ...base, id: "c1", date_from: "2026-10-12", date_to: "2026-10-12", reason: "dzień nauczyciela", ...o }),
};
