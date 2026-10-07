import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import Scanner from './pages/Scanner';
import Dashboard from './pages/Dashboard';
import Generator from './pages/Generator';
import Justificaciones from './pages/Justificaciones';
import ConsultaPadres from './pages/ConsultaPadres';

// Layout para el área administrativa (con Header y Footer)
const AdminLayout = ({ children }) => (
  <>
    <Header />
    <div className="flex-1">
      {children}
    </div>
    <Footer />
  </>
);

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen flex-col">
        <Routes>
          {/* Ruta pública para padres (sin Header ni Footer) */}
          <Route path="/padres" element={<ConsultaPadres />} />
          
          {/* Rutas administrativas */}
          <Route path="/" element={<AdminLayout><Scanner /></AdminLayout>} />
          <Route path="/dashboard" element={<AdminLayout><Dashboard /></AdminLayout>} />
          <Route path="/justificaciones" element={<AdminLayout><Justificaciones /></AdminLayout>} />
          <Route path="/generador" element={<AdminLayout><Generator /></AdminLayout>} />
          
          {/* Redirección por defecto */}
          <Route path="*" element={<AdminLayout><Scanner /></AdminLayout>} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}