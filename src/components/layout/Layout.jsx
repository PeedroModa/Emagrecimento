import { NavLink, Outlet } from "react-router-dom";
import { Weight, TrendingDown, Flame, Settings } from "lucide-react";

const NAV = [
  { to: "/", label: "Hoje", icon: Weight, end: true },
  { to: "/evolucao", label: "Evolução", icon: TrendingDown },
  { to: "/nutricao", label: "Nutrição", icon: Flame },
  { to: "/ajustes", label: "Ajustes", icon: Settings },
];

function NavItems({ compactIcons = false }) {
  return NAV.map(({ to, label, icon: Icon, end }) => (
    <NavLink
      key={to}
      to={to}
      end={end}
      className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}
      aria-label={label}
    >
      <Icon size={compactIcons ? 20 : 19} />
      <span className="nav-label">{label}</span>
    </NavLink>
  ));
}

export default function Layout() {
  return (
    <div className="app-shell">
      <nav className="sidebar" aria-label="Navegação principal">
        <div className="sidebar-logo" aria-hidden="true">
          <Weight size={20} />
        </div>
        <NavItems />
      </nav>
      <main className="main">
        <Outlet />
      </main>
      <nav className="bottom-nav" aria-label="Navegação principal">
        <NavItems compactIcons />
      </nav>
    </div>
  );
}
