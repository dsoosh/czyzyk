import { NavLink, Outlet, useOutletContext } from "react-router";

const tab = ({ isActive }: { isActive: boolean }) =>
  `flex-1 rounded-lg px-2 py-2 text-center text-sm font-medium whitespace-nowrap ${isActive ? "bg-white text-brand-700 shadow-sm" : "text-slate-600"}`;

export function AdminLayout() {
  // Forward the layout context (review counter) to admin pages.
  const context = useOutletContext();
  return (
    <div className="space-y-4">
      <nav aria-label="Panel admina" className="flex gap-1 overflow-x-auto rounded-xl bg-brand-100 p-1">
        <NavLink to="/admin" end className={tab}>
          Rodzina
        </NavLink>
        <NavLink to="/admin/urzadzenia" className={tab}>
          Urządzenia
        </NavLink>
        <NavLink to="/admin/grupy" className={tab}>
          Grupy
        </NavLink>
        <NavLink to="/admin/przeglad" className={tab}>
          Przegląd
        </NavLink>
        <NavLink to="/admin/import" className={tab}>
          Import
        </NavLink>
        <NavLink to="/admin/przedszkole" className={tab}>
          Przedszkole
        </NavLink>
        <NavLink to="/admin/prompty" className={tab}>
          Prompty
        </NavLink>
      </nav>
      <Outlet context={context} />
    </div>
  );
}
