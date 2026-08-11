import { useState } from 'react';
import { justificarFalta, buscarEstudiantePorDni } from '../services/api';

export default function Justificaciones() {
  const [dni, setDni] = useState('');
  const [estudiante, setEstudiante] = useState(null);
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [tipoPermiso, setTipoPermiso] = useState('Enfermedad');
  const [detalles, setDetalles] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const handleBuscar = async () => {
    if (dni.length !== 8) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await buscarEstudiantePorDni(dni);
      if (res.success) {
        setEstudiante(res.estudiante);
      } else {
        setEstudiante(null);
        setMessage({ type: 'error', text: res.message });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Error de conexión' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!estudiante) {
      setMessage({ type: 'error', text: 'Primero debe buscar un estudiante válido.' });
      return;
    }
    
    // Format date from YYYY-MM-DD to DD/MM/YYYY to match backend
    const [y, m, d] = fecha.split('-');
    const formattedDate = `${d}/${m}/${y}`;
    const motivoCompleto = `${tipoPermiso}: ${detalles}`.trim();

    setLoading(true);
    setMessage(null);
    try {
      const res = await justificarFalta(dni, formattedDate, motivoCompleto);
      if (res.success) {
        setMessage({ type: 'success', text: res.message });
        setDni('');
        setEstudiante(null);
        setDetalles('');
      } else {
        setMessage({ type: 'error', text: res.message });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 text-center">
        <span className="inline-block rounded-full bg-violet-500/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-violet-400 mb-2">Administración</span>
        <h1 className="text-3xl font-black text-white shadow-sm">Módulo de Permisos</h1>
        <p className="mt-2 text-slate-400">Registra justificaciones para inasistencias o permisos especiales.</p>
      </div>

      <div className="mx-auto flex w-full flex-col gap-6" style={{ maxWidth: '500px' }}>
        <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-xl backdrop-blur-sm">
          <h2 className="mb-4 font-bold text-white text-lg">Nuevo Registro</h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-400 ml-1">DNI del Estudiante</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={dni}
                  onChange={e => setDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="Ej. 12345678"
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-2.5 text-sm text-white shadow-inner focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none"
                />
                <button 
                  type="button"
                  onClick={handleBuscar}
                  disabled={dni.length !== 8 || loading}
                  className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50 transition"
                >
                  Buscar
                </button>
              </div>
            </div>

            {estudiante && (
              <div className="rounded-xl border border-violet-900/40 bg-violet-500/10 p-4">
                <p className="font-bold text-violet-300">{estudiante.nombre}</p>
                <p className="text-sm text-violet-400/80 mt-1">{estudiante.grado} · {estudiante.nivel}</p>
              </div>
            )}

            <div className="flex flex-col gap-1 mt-2">
              <label className="text-xs font-semibold text-slate-400 ml-1">Fecha del Permiso</label>
              <input 
                type="date" 
                value={fecha}
                onChange={e => setFecha(e.target.value)}
                required
                className="rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-2.5 text-sm text-white shadow-inner focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none w-full"
              />
            </div>

            <div className="flex flex-col gap-1 mt-2">
              <label className="text-xs font-semibold text-slate-400 ml-1">Tipo de Permiso</label>
              <select 
                value={tipoPermiso}
                onChange={e => setTipoPermiso(e.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-2.5 text-sm text-white shadow-inner focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none w-full"
              >
                <option value="Enfermedad">Enfermedad 🤒</option>
                <option value="Viaje">Viaje Familiar ✈️</option>
                <option value="Emergencia">Emergencia 🚨</option>
                <option value="Cita Médica">Cita Médica 🏥</option>
                <option value="Otros">Otros (Especificar abajo)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1 mt-2">
              <label className="text-xs font-semibold text-slate-400 ml-1">Detalles Adicionales</label>
              <textarea 
                value={detalles}
                onChange={e => setDetalles(e.target.value)}
                placeholder="Escribe más detalles sobre el motivo..."
                rows="3"
                className="rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-2.5 text-sm text-white shadow-inner focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none resize-none w-full"
              />
            </div>

            <button 
              type="submit"
              disabled={!estudiante || loading}
              className="mt-4 rounded-xl bg-violet-600 py-3 text-sm font-bold text-white shadow-lg hover:bg-violet-700 disabled:opacity-50 transition w-full"
            >
              {loading ? 'Procesando...' : 'Registrar Permiso'}
            </button>

            {message && (
              <div className={`mt-2 rounded-xl p-3 text-center text-sm font-semibold border ${message.type === 'error' ? 'border-red-900/50 bg-red-500/10 text-red-400' : 'border-emerald-900/50 bg-emerald-500/10 text-emerald-400'}`}>
                {message.text}
              </div>
            )}
          </form>
        </div>

        <div className="w-full flex flex-col gap-4">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-xl backdrop-blur-sm text-sm text-slate-300">
            <h3 className="font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-violet-400">ℹ️</span> ¿Cómo funciona esto?
            </h3>
            <p className="mb-4 leading-relaxed">
              Al registrar un permiso para un estudiante, el Dashboard automáticamente actualizará su registro. 
            </p>
            <div className="rounded-xl bg-slate-800/50 p-4 border border-slate-700/50">
              <p className="leading-relaxed">
                Si el estudiante no asistió y el sistema le había asignado una <b className="text-red-400">Falta</b> virtual, su estado cambiará a <b className="text-violet-400">Justificado</b> y ya no perjudicará su porcentaje de asistencia.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
