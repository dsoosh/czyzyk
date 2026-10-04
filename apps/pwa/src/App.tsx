import { Navigate, Route, Routes } from "react-router";
import { useAuth } from "./auth/AuthProvider";
import { Layout } from "./components/Layout";
import { AllowedEmailsPage } from "./pages/admin/AllowedEmailsPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { NoAccessPage } from "./pages/NoAccessPage";

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
            <Route index element={<HomePage />} />
            {state.profile.role === "admin" && <Route path="admin" element={<AllowedEmailsPage />} />}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      );
  }
}
