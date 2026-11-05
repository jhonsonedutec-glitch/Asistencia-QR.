import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  justificarFalta, 
  eliminarJustificacion,
  obtenerJustificaciones, 
  buscarEstudiantePorDni, 
  getFechaHoyLocal, 
  normalizarFecha 
} from '../services/api';

export default function Justificaciones() {
  const [dni, setDni] = useState('');
  const [estudiante, setEstudiante] = useState(null);
  const [fecha, setFecha] = useState(() => getFechaHoyLocal());
  const [tipoPermiso, setTipoPermiso] = useState('Enfermedad');
  const [detalles, setDetalles] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Lista de justificaciones registradas
  const [justificaciones, setJustificaciones] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('TODOS');
  const [deletingId, setDeletingId] = useState(null);

  // Cargar lista de justificaciones
  const cargarJustificaciones = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await obtenerJustificaciones();
      if (res && res.success && Array.isArray(res.justificaciones)) {
        setJustificaciones(res.justificaciones);
      }
    } catch (e) {
      console.error('Error cargando justificaciones:', e);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    cargarJustificaciones();
  }, [cargarJustificaciones]);

  // Búsqueda automática cuando se completan los 8 dígitos
  useEffect(() => {
    const dniLimpio = dni.replace(/\D/g, '').trim();
    if (dniLimpio.length === 8) {
      let isMounted = true;
      buscarEstudiantePorDni(dniLimpio).then(res => {
        if (!isMounted) return;
        if (res && res.success && res.estudiante) {
          setEstudiante(res.estudiante);
          setMessage(null);
        } else {
          setEstudiante(null);
        }
      }).catch(() => {});
      return () => { isMounted = false; };
    } else {
      setEstudiante(null);
    }
  }, [dni]);

  const handleBuscar = async () => {
    if (dni.length !== 8) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await buscarEstudiantePorDni(dni);
      if (res && res.success && res.estudiante) {
        setEstudiante(res.estudiante);
      } else {
        setEstudiante(null);
        setMessage({ type: 'error', text: res?.message || 'No se encontró el estudiante con este DNI.' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Error de conexión al buscar estudiante.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!estudiante) {
      setMessage({ type: 'error', text: 'Primero debe buscar un estudiante válido ingresando su DNI.' });
      return;
    }
    
    // Format date from YYYY-MM-DD to DD/MM/YYYY
    const [y, m, d] = fecha.split('-');
    const formattedDate = `${d}/${m}/${y}`;
    const motivoCompleto = detalles.trim() ? `${tipoPermiso}: ${detalles.trim()}` : `${tipoPermiso}:`;

    setLoading(true);
    setMessage(null);
    try {
      const res = await justificarFalta(dni, formattedDate, motivoCompleto);
      if (res && res.success) {
        setMessage({ type: 'success', text: `✅ Permiso registrado exitosamente para ${estudiante.nombre} el ${formattedDate}.` });
        setDni('');
        setEstudiante(null);
        setDetalles('');
        // Recargar la lista en tiempo real
        await cargarJustificaciones();
      } else {
        setMessage({ type: 'error', text: res?.message || 'No se pudo guardar la justificación.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Error de conexión al registrar justificación.' });
    } finally {
      setLoading(false);
    }
  };

  const handleEliminar = async (item) => {
    if (!window.confirm(`¿Estás seguro de eliminar la justificación del estudiante ${item.nombre} para el día ${item.fecha}?`)) {
      return;
    }
    setDeletingId(item.id);
    try {
      const res = await eliminarJustificacion(item.dni, item.fecha);
      if (res && res.success) {
        setMessage({ type: 'success', text: `Justificación del ${item.fecha} eliminada correctamente.` });
        await cargarJustificaciones();
      } else {
        setMessage({ type: 'error', text: res?.message || 'No se pudo eliminar de la hoja.' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Error al eliminar: ' + e.message });
    } finally {
      setDeletingId(null);
    }
  };

  // Filtrado reactivo de las justificaciones
  const justificacionesFiltradas = useMemo(() => {
    let list = justificaciones;
    if (filtroTipo !== 'TODOS') {
      list = list.filter(j => j.motivo.toLowerCase().includes(filtroTipo.toLowerCase()));
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(j => 
        j.dni.includes(q) ||
        (j.nombre && j.nombre.toLowerCase().includes(q)) ||
        (j.fecha && j.fecha.includes(q)) ||
        (j.motivo && j.motivo.toLowerCase().includes(q)) ||
        (j.gradoCompleto && j.gradoCompleto.toLowerCase().includes(q))
      );
    }
    return list;
  }, [justificaciones, filtroTipo, searchTerm]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 font-sans">
      <div className="mb-8 text-center">
        <span className="inline-block rounded-full bg-violet-500/10 border border-violet-500/30 px-3 py-1 text-xs font-bold uppercase tracking-widest text-violet-400 mb-2">
          Administración Escolar
        </span>
        <h1 className="text-3xl font-black text-white shadow-sm">Módulo de Permisos y Justificaciones</h1>
        <p className="mt-2 text-slate-400 text-sm">Registra y visualiza en tiempo real las inasistencias justificadas y permisos médicos o familiares.</p>
      </div>

      {message && (
        <div className={`mx-auto max-w-5xl mb-6 rounded-2xl border p-4 text-sm font-semibold flex items-center justify-between ${
          message.type === 'error' ? 'border-red-500/30 bg-red-500/15 text-red-300' : 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
        }`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-xs opacity-75 hover:opacity-100">✕</button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12 items-start">
        
        {/* Columna Izquierda: Formulario de Registro (lg:col-span-5) */}
        <section className="lg:col-span-5 rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
            <span className="text-xl">✍️</span>
            <h2 className="text-lg font-bold text-white">Nuevo Permiso</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1 ml-1">DNI del Estudiante (8 dígitos)</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={dni}
                  onChange={e => setDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="Ej. 62423377"
                  maxLength={8}
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white font-mono placeholder-slate-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none"
                  autoFocus
                />
                <button 
                  type="button"
                  onClick={handleBuscar}
                  disabled={dni.length !== 8 || loading}
                  className="rounded-xl bg-violet-600/30 border border-violet-500/40 px-4 py-2 text-xs font-bold text-violet-300 hover:bg-violet-600/50 disabled:opacity-50 transition"
                >
                  {loading ? '...' : '🔍 Buscar'}
                </button>
              </div>
            </div>

            {estudiante && (
              <div className="rounded-2xl border border-violet-500/40 bg-violet-600/15 p-3.5 shadow">
                <div className="flex items-center gap-2">
                  <span className="text-base">🎓</span>
                  <div>
                    <p className="font-bold text-white text-sm leading-tight">{estudiante.nombre}</p>
                    <p className="text-xs text-violet-300 font-medium mt-0.5">
                      🏫 {estudiante.grado} {estudiante.nivel && `· ${estudiante.nivel}`}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1 ml-1">Fecha del Permiso</label>
              <input 
                type="date" 
                value={fecha}
                onChange={e => setFecha(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-violet-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1 ml-1">Tipo de Motivo</label>
              <select 
                value={tipoPermiso}
                onChange={e => setTipoPermiso(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-violet-500 outline-none font-medium"
              >
                <option value="Enfermedad">🤒 Enfermedad (Salud / Reposo)</option>
                <option value="Cita Médica">🏥 Cita Médica / Consulta</option>
                <option value="Emergencia">🚨 Emergencia Familiar</option>
                <option value="Viaje">✈️ Viaje Familiar</option>
                <option value="Otros">📝 Otros (Especificar detalle)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1 ml-1">Detalles Adicionales (Opcional)</label>
              <textarea 
                value={detalles}
                onChange={e => setDetalles(e.target.value)}
                placeholder="Ej. Presenta cólicos menstruales, fiebre, dolor de cabeza, etc."
                rows="3"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white placeholder-slate-500 focus:border-violet-500 outline-none resize-none"
              />
            </div>

            <button 
              type="submit"
              disabled={!estudiante || loading}
              className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-3 text-sm font-bold text-white shadow-lg shadow-violet-900/30 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Guardando en la nube...
                </>
              ) : (
                <>
                  <span>📋</span>
                  <span>Registrar Permiso</span>
                </>
              )}
            </button>
          </form>

          {/* Tarjeta Explicativa */}
          <div className="mt-6 border-t border-slate-800 pt-4 text-xs text-slate-400 leading-relaxed">
            <p className="flex items-center gap-1.5 font-semibold text-violet-400 mb-1">
              <span>💡</span> Efecto automático en el sistema:
            </p>
            <p>
              El estudiante quedará marcado con estado <strong className="text-violet-300">Justificado</strong> en el Dashboard, en el Registro Manual y en el Portal de Padres, protegiendo su porcentaje de asistencia.
            </p>
          </div>
        </section>

        {/* Columna Derecha: Listado de Justificaciones Registradas (lg:col-span-7) */}
        <section className="lg:col-span-7 rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl backdrop-blur-md flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">📋</span>
              <h2 className="text-lg font-bold text-white">Justificaciones Registradas</h2>
              <span className="rounded-full bg-violet-600/30 border border-violet-500/40 px-2.5 py-0.5 text-xs font-bold text-violet-300">
                {justificaciones.length}
              </span>
            </div>
            <button
              onClick={cargarJustificaciones}
              disabled={loadingList}
              className="text-xs text-violet-400 hover:text-violet-300 font-semibold flex items-center gap-1"
            >
              {loadingList ? 'Cargando...' : '🔄 Actualizar'}
            </button>
          </div>

          {/* Buscador y Filtros */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 mb-4">
            <div className="sm:col-span-7">
              <input 
                type="text"
                placeholder="🔍 Buscar por nombre, DNI o fecha..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-violet-500 outline-none"
              />
            </div>
            <div className="sm:col-span-5">
              <select
                value={filtroTipo}
                onChange={e => setFiltroTipo(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-violet-500 outline-none"
              >
                <option value="TODOS">Todos los motivos</option>
                <option value="Enfermedad">🤒 Enfermedad</option>
                <option value="Cita">🏥 Cita Médica</option>
                <option value="Emergencia">🚨 Emergencia</option>
                <option value="Viaje">✈️ Viaje</option>
                <option value="Otros">📝 Otros</option>
              </select>
            </div>
          </div>

          {/* Estado de Carga */}
          {loadingList && (
            <div className="py-16 text-center text-slate-400 text-sm animate-pulse">
              Consultando justificaciones registradas en la nube...
            </div>
          )}

          {/* Estado Vacío */}
          {!loadingList && justificacionesFiltradas.length === 0 && (
            <div className="py-16 text-center text-slate-500">
              <div className="text-4xl mb-2">📑</div>
              <p className="font-bold text-white text-base">
                {searchTerm || filtroTipo !== 'TODOS' ? 'No se encontraron resultados' : 'No hay justificaciones registradas'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {searchTerm || filtroTipo !== 'TODOS' 
                  ? 'Prueba modificando los filtros de búsqueda.' 
                  : 'Usa el formulario de la izquierda para registrar la primera justificación.'}
              </p>
            </div>
          )}

          {/* Lista de Justificaciones */}
          {!loadingList && justificacionesFiltradas.length > 0 && (
            <div className="space-y-3 overflow-y-auto max-h-[580px] pr-1 custom-scrollbar">
              {justificacionesFiltradas.map((item) => {
                const esEnfermedad = item.motivo.toLowerCase().includes('enfermedad');
                const esCita = item.motivo.toLowerCase().includes('cita');
                const esOtros = item.motivo.toLowerCase().includes('otro');

                const icono = esEnfermedad ? '🤒' : esCita ? '🏥' : esOtros ? '📝' : '📌';

                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 hover:border-slate-700 transition shadow"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="rounded-lg bg-violet-600/20 border border-violet-500/40 px-2.5 py-0.5 text-xs font-bold text-violet-300">
                          📅 {item.fecha}
                        </span>
                        {item.gradoCompleto && (
                          <span className="rounded-lg bg-slate-800 border border-slate-700 px-2 py-0.5 text-xs text-slate-300 font-semibold">
                            🏫 {item.gradoCompleto}
                          </span>
                        )}
                      </div>
                      <span className="rounded-full px-2.5 py-0.5 text-xs font-bold border bg-violet-500/10 text-violet-400 border-violet-500/30">
                        🟣 Justificado
                      </span>
                    </div>

                    <div className="my-1.5">
                      <h3 className="text-sm font-bold text-white">
                        {item.nombre}
                      </h3>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">
                        DNI: {item.dni}
                      </p>
                    </div>

                    <div className="mt-2.5 rounded-xl border border-slate-800/80 bg-slate-950/70 p-2.5 text-xs text-slate-200 flex items-start gap-2">
                      <span className="text-base">{icono}</span>
                      <p className="flex-1 leading-relaxed">
                        <strong className="text-violet-300">Motivo: </strong>
                        {item.motivo}
                      </p>
                    </div>

                    <div className="flex justify-end mt-2 pt-2 border-t border-slate-800/50">
                      <button
                        onClick={() => handleEliminar(item)}
                        disabled={deletingId === item.id}
                        className="text-[11px] text-red-400/80 hover:text-red-300 font-semibold flex items-center gap-1 transition disabled:opacity-50"
                        title="Eliminar este permiso"
                      >
                        {deletingId === item.id ? 'Eliminando...' : '🗑️ Eliminar permiso'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

      </div>
    </main>
  );
}
