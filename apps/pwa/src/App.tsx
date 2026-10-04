import { Navigate, Route, Routes } from "react-router";
import { useAuth } from "./auth/AuthProvider";
import { Layout } from "./components/Layout";
import { AdminLayout } from "./pages/admin/AdminLayout";
import { AllowedEmailsPage } from "./pages/admin/AllowedEmailsPage";
import { DevicesPage } from "./pages/admin/DevicesPage";
import { GroupsPage } from "./pages/admin/GroupsPage";
import { CalendarPage } from "./pages/CalendarPage";
import { EventPage } from "./pages/EventPage";
import { LoginPage } from "./pages/LoginPage";
import { NoAccessPage } from "./pages/NoAccessPage";
import { SourcePage } from "./pages/SourcePage";
import { TodayPage } from "./pages/TodayPage";

export function App() {
  const { state, refreshProfile } = useAuth();

  switch (state.status) {
    case "loading":
      return <p className="p-8 text-center text-slate-500">Wczytywanie…</p>;
    case "signed_out":
      return <LoginPage />;
    case "no_access":
      return <NoAccessPage message={state.message} />;
    case "error":
      return (
        <div className="p-8 text-center">
          <p role="alert">{state.message}</p>
          <button type="button" className="mt-4 underline" onClick={() => void refreshProfile()}>
            Spróbuj ponownie
          </button>
        </div>
      );
    case "ready":
      return (
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<TodayPage />} />
            <Route path="kalendarz" element={<CalendarPage />} />
            <Route path="kalendarz/wydarzenie/:id" element={<EventPage />} />
            <Route path="zrodlo/:kind/:id" element={<SourcePage />} />
            {state.profile.role === "admin" && (
              <Route path="admin" element={<AdminLayout />}>
                <Route index element={<AllowedEmailsPage />} />
                <Route path="urzadzenia" element={<DevicesPage />} />
                <Route path="grupy" element={<GroupsPage />} />
              </Route>
            )}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      );
  }
}
