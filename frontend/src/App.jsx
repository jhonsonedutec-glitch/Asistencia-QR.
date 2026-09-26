import {useState} from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import Scanner from './pages/Scanner';
import Dashboard from './pages/Dashboard';
import Generator from './pages/Generator';
import Justificaciones from './pages/Justificaciones';
import ConsultaPadres from './pages/ConsultaPadres';

export default function App() {
  const [view, setView] = useState(() => {
    // Si entran directo al enlace /padres, renderizamos la vista de padres
    if (window.location.pathname.includes('/padres')) {
      return 'consulta_padres';
    }
    return 'scanner';
  });

  // Si es la vista de padres, ocultamos el Header y Footer administrativo
  if (view === 'consulta_padres') {
    return (
      <div className="flex min-h-screen flex-col">
        <ConsultaPadres />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header view={view} setView={setView}/>
      <div className="flex-1">
        {view === 'scanner' ? <Scanner/> :
         view === 'dashboard' ? <Dashboard/> :
         view === 'justificaciones' ? <Justificaciones/> :
         <Generator/>}
      </div>
      <Footer view={view} setView={setView}/>
    </div>
  );
}