import { NavLink } from 'react-router-dom';

export default function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-blue-900/50 bg-[#0f172a]/50 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-4 text-center md:flex-row md:text-left">
        <div>
          <div className="text-xl font-black tracking-tight text-white">IEP MILLENIUM</div>
          <div className="text-xs text-slate-400">29 de agosto N° 169 - Bagua - Capital</div>
          <div className="text-xs text-slate-400">quintanahumanluis@gmail.com</div>
        </div>
        <nav className="flex gap-2 flex-wrap justify-center">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `rounded-xl px-4 py-2 text-sm font-semibold ${
                isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-blue-900/50'
              }`
            }
          >
            Escáner
          </NavLink>
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `rounded-xl px-4 py-2 text-sm font-semibold ${
                isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-blue-900/50'
              }`
            }
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/registro-manual"
            className={({ isActive }) =>
              `rounded-xl px-4 py-2 text-sm font-semibold ${
                isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-blue-900/50'
              }`
            }
          >
            Registro Manual
          </NavLink>
          <NavLink
            to="/justificaciones"
            className={({ isActive }) =>
              `rounded-xl px-4 py-2 text-sm font-semibold ${
                isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-blue-900/50'
              }`
            }
          >
            Permisos
          </NavLink>
        </nav>
      </div>
    </header>
  );
}