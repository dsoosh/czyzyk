import { NavLink, Outlet } from "react-router";

const tab = ({ isActive }: { isActive: boolean }) =>
  `flex-1 rounded-lg px-1 py-2 text-center text-sm font-medium ${isActive ? "bg-white text-brand-700 shadow-sm" : "text-slate-600"}`;

export function ListsLayout() {
  return (
    <div className="space-y-4">
      <nav aria-label="Listy" className="flex gap-1 rounded-xl bg-brand-100 p-1">
        <NavLink to="/listy" end className={tab}>
          Przynieść
        </NavLink>
        <NavLink to="/listy/platnosci" className={tab}>
          Płatności
        </NavLink>
        <NavLink to="/listy/sprawy" className={tab}>
          Sprawy
        </NavLink>
        <NavLink to="/listy/dni-wolne" className={tab}>
          Dni wolne
        </NavLink>
      </nav>
      <Outlet />
    </div>
  );
}
