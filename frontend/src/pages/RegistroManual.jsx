import { useState, useEffect, useMemo, useCallback } from 'react';
import { obtenerGrados, obtenerEstudiantesPorGrado, obtenerAsistenciaDia, registrarManualLote } from '../services/api';

const ESTADOS = ['Asistió', 'Tardanza', 'Falta'];

const estadoStyle = {
  'Asistió': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'Asistióó': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'Tardanza': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'Falta': 'bg-red-500/10 text-red-400 border-red-500/20',
  'Justificado': 'bg-violet-500/10 text-violet-400 border-violet-500/20',
};

function getEstadoClass(estado) {
  if (!estado) return 'bg-slate-700/30 text-slate-400 border-slate-600/30';
  if (estado.includes('Asisti')) return estadoStyle['Asistió'];
  return estadoStyle[estado] || 'bg-slate-700/30 text-slate-400 border-slate-600/30';
}

export default function RegistroManual() {
  const [grados, setGrados] = useState([]);
  const [gradoSeleccionado, setGradoSeleccionado] = useState('');
  const [fecha, setFecha] = useState(() => {
    const hoy = new Date();
    return hoy.toISOString().split('T')[0];
  });
  const [estudiantes, setEstudiantes] = useState([]);
  const [registrados, setRegistrados] = useState({});
  const [cambios, setCambios] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadingGrados, setLoadingGrados] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  // Cargar grados al montar
  useEffect(() => {
    setLoadingGrados(true);
    obtenerGrados()
      .then(res => {
        if (res.success) setGrados(res.grados || []);
      })
      .catch(() => {})
      .finally(() => setLoadingGrados(false));
  }, []);

  // Cargar estudiantes y asistencia cuando cambia grado/fecha
  useEffect(() => {
    if (!gradoSeleccionado || !fecha) return;
    setLoading(true);
    setMensaje(null);
    setCambios({});

    const [y, m, d] = fecha.split('-');
    const fechaFormatted = `${d}/${m}/${y}`;

    Promise.all([
      obtenerEstudiantesPorGrado(gradoSeleccionado),
      obtenerAsistenciaDia(fechaFormatted),
    ])
      .then(([estRes, asistRes]) => {
        if (estRes.success) setEstudiantes(estRes.estudiantes || []);
        if (asistRes.success) setRegistrados(asistRes.registrados || {});
      })
      .catch(e => setMensaje({ tipo: 'error', texto: e.message }))
      .finally(() => setLoading(false));
  }, [gradoSeleccionado, fecha]);

  // Contar estados
  const resumen = useMemo(() => {
    const total = estudiantes.length;
    let yaRegistrados = 0;
    let pendientes = 0;
    let conCambios = 0;

    estudiantes.forEach(est => {
      const yaReg = registrados[est.dni];
      const cambio = cambios[est.dni];
      if (yaReg) {
        yaRegistrados++;
      } else if (cambio) {
        conCambios++;
      } else {
        pendientes++;
      }
    });

    return { total, yaRegistrados, pendientes, conCambios };
  }, [estudiantes, registrados, cambios]);

  const handleEstadoChange = useCallback((dni, estado) => {
    setCambios(prev => ({ ...prev, [dni]: estado }));
  }, []);

  const marcarTodosComo = useCallback((estado) => {
    const nuevosCambios = {};
    estudiantes.forEach(est => {
      if (!registrados[est.dni]) {
        nuevosCambios[est.dni] = estado;
      }
    });
    setCambios(nuevosCambios);
  }, [estudiantes, registrados]);

  const guardar = useCallback(async () => {
    const registrosParaGuardar = Object.entries(cambios)
      .filter(([, estado]) => estado)
      .map(([dni, estado]) => ({ dni, estado }));

    if (!registrosParaGuardar.length) {
      setMensaje({ tipo: 'warn', texto: 'No hay cambios para guardar.' });
      return;
    }

    const [y, m, d] = fecha.split('-');
    const fechaFormatted = `${d}/${m}/${y}`;

    setSaving(true);
    setMensaje(null);
    try {
      const res = await registrarManualLote(registrosParaGuardar, fechaFormatted);
      if (res.success) {
        setMensaje({
          tipo: 'success',
          texto: res.message + (res.errores?.length ? ` | Errores: ${res.errores.join(', ')}` : ''),
        });
        // Refrescar datos
        const asistRes = await obtenerAsistenciaDia(fechaFormatted);
        if (asistRes.success) setRegistrados(asistRes.registrados || {});
        setCambios({});
      } else {
        setMensaje({ tipo: 'error', texto: res.message });
      }
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e.message });
    } finally {
      setSaving(false);
    }
  }, [cambios, fecha]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-8">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-blue-400">Control de Asistencia</span>
          <h1 className="mt-1 text-3xl font-black text-white md:text-4xl">Registro Manual</h1>
          <p className="mt-2 text-slate-400">Registre la asistencia de los alumnos que no portaron su QR.</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-400 ml-1">Fecha</label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-2.5 text-sm text-white shadow-inner focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-400 ml-1">Grado / Sección</label>
          {loadingGrados ? (
            <div className="rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-2.5 text-sm text-slate-500">
              Cargando grados...
            </div>
          ) : (
            <select
              value={gradoSeleccionado}
              onChange={(e) => setGradoSeleccionado(e.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-2.5 text-sm text-white shadow-inner focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            >
              <option value="">-- Seleccionar --</option>
              {grados.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Mensaje */}
      {mensaje && (
        <div className={`mb-6 rounded-2xl border p-4 text-sm font-medium ${
          mensaje.tipo === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' :
          mensaje.tipo === 'warn' ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' :
          'bg-red-500/10 border-red-500/30 text-red-300'
        }`}>
          {mensaje.texto}
        </div>
      )}

      {/* Contenido principal */}
      {!gradoSeleccionado ? (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-12 text-center shadow-xl">
          <div className="text-5xl mb-4">📋</div>
          <h3 className="text-lg font-bold text-white">Seleccione un grado</h3>
          <p className="text-slate-400 mt-2">Elija la fecha y el grado para ver la lista de alumnos.</p>
        </div>
      ) : loading ? (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-12 text-center shadow-xl">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-blue-600" />
          <p className="mt-4 text-slate-400 font-semibold">Cargando lista de alumnos...</p>
        </div>
      ) : (
        <>
          {/* Barra de resumen y acciones rápidas */}
          <div className="flex flex-col sm:flex-row gap-4 mb-4 items-start sm:items-center justify-between">
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1 text-slate-300">
                <span className="font-bold text-white">{resumen.total}</span> Total
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-emerald-400">
                <span className="font-bold">{resumen.yaRegistrados}</span> Registrados
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 px-3 py-1 text-amber-400">
                <span className="font-bold">{resumen.pendientes}</span> Pendientes
              </span>
              {resumen.conCambios > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 px-3 py-1 text-blue-400">
                  <span className="font-bold">{resumen.conCambios}</span> Por guardar
                </span>
              )}
            </div>

            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => marcarTodosComo('Asistió')}
                className="rounded-lg border border-emerald-600/50 bg-emerald-600/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-600/20 transition"
              >
                ✅ Marcar todos Asistió
              </button>
              <button
                onClick={() => marcarTodosComo('Falta')}
                className="rounded-lg border border-red-600/50 bg-red-600/10 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-600/20 transition"
              >
                ❌ Marcar todos Falta
              </button>
              <button
                onClick={() => setCambios({})}
                className="rounded-lg border border-slate-600/50 bg-slate-700/30 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:bg-slate-700/50 transition"
              >
                🔄 Limpiar cambios
              </button>
            </div>
          </div>

          {/* Tabla */}
          <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/50 shadow-xl backdrop-blur-sm">
            <div className="overflow-auto max-h-[60vh] custom-scrollbar">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-800/80 text-slate-400 sticky top-0 z-10 backdrop-blur-sm">
                  <tr>
                    <th className="px-4 py-4 font-semibold w-12">#</th>
                    <th className="px-4 py-4 font-semibold">DNI</th>
                    <th className="px-4 py-4 font-semibold">Estudiante</th>
                    <th className="px-4 py-4 font-semibold">Estado Actual</th>
                    <th className="px-4 py-4 font-semibold text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {estudiantes.map((est, i) => {
                    const yaRegistrado = registrados[est.dni];
                    const cambioLocal = cambios[est.dni];
                    const estadoActual = yaRegistrado
                      ? yaRegistrado.estado
                      : cambioLocal || null;

                    return (
                      <tr
                        key={est.dni}
                        className={`transition-colors ${
                          yaRegistrado
                            ? 'bg-slate-900/30 text-slate-400'
                            : cambioLocal
                            ? 'bg-blue-900/10 text-slate-200'
                            : 'bg-slate-900/50 text-slate-300'
                        }`}
                      >
                        <td className="px-4 py-3 text-slate-500 text-xs">{i + 1}</td>
                        <td className="px-4 py-3 font-mono text-xs">{est.dni}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{est.nombre}</div>
                          {yaRegistrado && (
                            <div className="text-xs text-slate-500 mt-0.5">
                              {yaRegistrado.hora === 'Manual' ? '📝 Registro manual' : `📷 QR a las ${yaRegistrado.hora}`}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {estadoActual ? (
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getEstadoClass(estadoActual)}`}>
                              {estadoActual}
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-yellow-500/10 border border-yellow-500/20 px-2.5 py-0.5 text-xs font-semibold text-yellow-400">
                              ⚠️ Sin registro
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {yaRegistrado ? (
                            <span className="text-xs text-slate-600">—</span>
                          ) : (
                            <div className="inline-flex gap-1">
                              {ESTADOS.map(estado => (
                                <button
                                  key={estado}
                                  onClick={() => handleEstadoChange(est.dni, estado)}
                                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition border ${
                                    cambioLocal === estado
                                      ? estado === 'Asistió'
                                        ? 'bg-emerald-600 text-white border-emerald-500'
                                        : estado === 'Tardanza'
                                        ? 'bg-amber-600 text-white border-amber-500'
                                        : 'bg-red-600 text-white border-red-500'
                                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                                  }`}
                                >
                                  {estado === 'Asistió' ? '✅' : estado === 'Tardanza' ? '⏰' : '❌'}
                                  <span className="ml-1 hidden sm:inline">{estado}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {estudiantes.length === 0 && (
                    <tr>
                      <td colSpan="5" className="px-6 py-10 text-center text-slate-500">
                        No se encontraron estudiantes para este grado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Botón Guardar */}
          {Object.keys(cambios).length > 0 && (
            <div className="mt-6 flex justify-end">
              <button
                onClick={guardar}
                disabled={saving}
                className="rounded-xl bg-blue-600 px-8 py-3 text-sm font-bold text-white shadow-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Guardando...
                  </>
                ) : (
                  <>💾 Guardar {Object.keys(cambios).length} registro(s)</>
                )}
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
