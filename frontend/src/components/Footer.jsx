import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="border-t border-blue-900/50 bg-slate-950/60">
      <div className="mx-auto max-w-6xl px-4 py-6 text-center text-sm text-slate-400">
        <strong className="text-white">IEP MILLENIUM</strong><br />
        29 de agosto N° 169 - Bagua - Capital — quintanahumanluis@gmail.com<br />
        <div className="mt-2 flex flex-wrap justify-center items-center gap-3 text-xs sm:text-sm">
          <a 
            className="text-blue-400 hover:underline" 
            href="http://facebook.com/p/Colegio-Particular-Millenium-100094040687291/" 
            target="_blank" 
            rel="noreferrer"
          >
            Facebook institucional
          </a>
          <span>•</span>
          <Link to="/generador" className="text-blue-400 hover:underline">
            Generar QR de Estudiante
          </Link>
          <span>•</span>
          <Link to="/docentes" className="text-indigo-400 hover:underline flex items-center gap-1 font-semibold">
            <span>📝</span> Portal de Docentes
          </Link>
          <span>•</span>
          <Link to="/padres" className="text-emerald-400 hover:underline flex items-center gap-1 font-semibold">
            <span>👨‍👩‍👧</span> Portal de Padres
          </Link>
        </div>
      </div>
    </footer>
  );
}
