import { NavLink, Outlet } from "react-router";

const tab = ({ isActive }: { isActive: boolean }) =>
  `flex-1 rounded-lg py-2 text-center text-sm font-medium ${isActive ? "bg-white text-brand-700 shadow-sm" : "text-slate-600"}`;

export function AdminLayout() {
  return (
    <div className="space-y-4">
      <nav aria-label="Panel admina" className="flex gap-1 rounded-xl bg-brand-100 p-1">
        <NavLink to="/admin" end className={tab}>
          Rodzina
        </NavLink>
        <NavLink to="/admin/urzadzenia" className={tab}>
          Urządzenia
        </NavLink>
        <NavLink to="/admin/grupy" className={tab}>
          Grupy
        </NavLink>
      </nav>
      <Outlet />
    </div>
  );
}
