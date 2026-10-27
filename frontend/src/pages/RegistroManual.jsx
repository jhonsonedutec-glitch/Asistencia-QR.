import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { obtenerEstudiantes, obtenerDashboard, registrarAsistencia, justificarFalta, registrarManualLote } from '../services/api';

const ESTADOS = [
  { valor: 'Asistió', label: 'Asistió', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  { valor: 'Tardanza', label: 'Tardanza', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  { valor: 'Falta', label: 'Falta', color: 'bg-red-500/10 text-red-400 border-red-500/30' },
  { valor: 'Justificado', label: 'Justificado', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
];

function getBadgeClass(estado) {
  if (!estado) return 'bg-red-500/10 text-red-400 border-red-500/30';
  if (estado.includes('Asisti')) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
  if (estado === 'Tardanza') return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
  if (estado === 'Falta') return 'bg-red-500/10 text-red-400 border-red-500/30';
  if (estado === 'Justificado') return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
  return 'bg-slate-700/30 text-slate-400 border-slate-600/30';
}

export default function RegistroManual() {
  const [fecha, setFecha] = useState(() => {
    const hoy = new Date();
    return hoy.toISOString().split('T')[0];
  });
  const [busqueda, setBusqueda] = useState('');
  const [gradoFiltro, setGradoFiltro] = useState('TODOS');
  const [estadoFiltro, setEstadoFiltro] = useState('FALTA'); // Por defecto 'FALTA' a petición del usuario

  const [estudiantes, setEstudiantes] = useState([]);
  const [dashboardData, setDashboardData] = useState(null);
  const [cambios, setCambios] = useState({}); // { [dni]: nuevoEstado }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  // Formato dd/MM/yyyy para cruzar con Google Sheets
  const fechaFormatted = useMemo(() => {
    if (!fecha) return '';
    const [y, m, d] = fecha.split('-');
    return `${d}/${m}/${y}`;
  }, [fecha]);

  // Cargar estudiantes y dashboard inicial
  const cargarDatos = useCallback(async () => {
    setLoading(true);
    setMensaje(null);
    try {
      const [estRes, dashRes] = await Promise.all([
        obtenerEstudiantes(),
        obtenerDashboard(1)
      ]);

      let listaEst = [];
      const nombresSet = new Set();
      const dnisValidosSet = new Set();

      const norm = (str) => String(str || '').toLowerCase().replace(/[,.\s]+/g, ' ').trim();

      // 1. Tomar los estudiantes devueltos por el backend
      if (estRes.success && Array.isArray(estRes.estudiantes)) {
        estRes.estudiantes.forEach((e, idx) => {
          if (e.nombre && e.nombre.trim()) {
            const nomNorm = norm(e.nombre);
            nombresSet.add(nomNorm);
            const dniValido = e.dni && /^\d{8}$/.test(String(e.dni).trim()) ? String(e.dni).trim() : null;
            if (dniValido) dnisValidosSet.add(dniValido);

            listaEst.push({
              ...e,
              dni: dniValido || `PEND-${idx + 1}`,
              dniOriginal: dniValido || (e.dni || 'Pendiente')
            });
          }
        });
      }

      // 2. Si hay alumnos en el Dashboard que quedaron fuera por tener DNI "Pendiente" duplicado en Sheets, recuperarlos
      if (dashRes.success && Array.isArray(dashRes.registros)) {
        dashRes.registros.forEach(r => {
          if (r.nombre && r.nombre.trim()) {
            const nomNorm = norm(r.nombre);
            const dniValido = r.dni && /^\d{8}$/.test(String(r.dni).trim()) ? String(r.dni).trim() : null;

            if (dniValido && dnisValidosSet.has(dniValido)) return;
            if (nombresSet.has(nomNorm)) return;

            nombresSet.add(nomNorm);
            if (dniValido) dnisValidosSet.add(dniValido);

            listaEst.push({
              nombre: r.nombre.trim(),
              dni: dniValido || `PEND-${listaEst.length + 1}`,
              dniOriginal: dniValido || (r.dni || 'Pendiente'),
              grado: r.grado || '2do',
              nivel: r.nivel || 'Secundaria',
              celular: ''
            });
          }
        });
      }

      setEstudiantes(listaEst);
      if (dashRes.success) {
        setDashboardData(dashRes);
      }
    } catch (e) {
      setMensaje({ tipo: 'error', texto: 'Error al cargar datos: ' + e.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // Extraer lista de grados únicos de los estudiantes
  const gradosDisponibles = useMemo(() => {
    const set = new Set();
    estudiantes.forEach(e => {
      if (e.grado) {
        const item = e.nivel ? `${e.grado} - ${e.nivel}` : e.grado;
        set.add(item);
      }
    });
    return Array.from(set).sort();
  }, [estudiantes]);

  // Mapa de estado de cada estudiante para la fecha seleccionada
  const estadosPorDni = useMemo(() => {
    const map = {};
    if (dashboardData && Array.isArray(dashboardData.registros)) {
      dashboardData.registros.forEach(r => {
        if (r.fecha === fechaFormatted) {
          if (r.dni && /^\d{8}$/.test(String(r.dni).trim())) {
            map[String(r.dni).trim()] = {
              estado: r.estado,
              hora: r.hora
            };
          }
          if (r.nombre) {
            const nomKey = String(r.nombre).toLowerCase().replace(/[,.\s]+/g, ' ').trim();
            map['nom_' + nomKey] = {
              estado: r.estado,
              hora: r.hora
            };
          }
        }
      });
    }
    return map;
  }, [dashboardData, fechaFormatted]);

  // Lista combinada de estudiantes con su estado calculado
  const listaProcesada = useMemo(() => {
    return estudiantes.map(est => {
      const nomKey = String(est.nombre).toLowerCase().replace(/[,.\s]+/g, ' ').trim();
      const registroExistente = estadosPorDni[est.dni] || estadosPorDni['nom_' + nomKey];
      const cambioLocal = cambios[est.dni];

      let estadoActual = 'Falta'; // Si no hay registro para el día, se considera Falta/Sin registrar
      let hora = '--:--';
      let registradoPreviamente = false;

      if (registroExistente) {
        estadoActual = registroExistente.estado;
        hora = registroExistente.hora;
        registradoPreviamente = true;
      }

      if (cambioLocal) {
        estadoActual = cambioLocal;
      }

      const gradoCompleto = est.nivel ? `${est.grado} - ${est.nivel}` : est.grado;

      return {
        ...est,
        gradoCompleto,
        estadoActual,
        hora,
        registradoPreviamente,
        conCambio: Boolean(cambioLocal)
      };
    });
  }, [estudiantes, estadosPorDni, cambios]);

  // Filtrado reactivo por: Búsqueda (DNI / Nombre / Apellido), Grado y Estado
  const listaFiltrada = useMemo(() => {
    return listaProcesada.filter(item => {
      // Filtro de grado
      if (gradoFiltro !== 'TODOS' && item.gradoCompleto !== gradoFiltro && item.grado !== gradoFiltro) {
        return false;
      }

      // Filtro de estado
      if (estadoFiltro === 'FALTA') {
        if (item.estadoActual !== 'Falta') return false;
      } else if (estadoFiltro === 'ASISTIO') {
        if (!item.estadoActual.includes('Asisti')) return false;
      } else if (estadoFiltro === 'TARDANZA') {
        if (item.estadoActual !== 'Tardanza') return false;
      } else if (estadoFiltro === 'JUSTIFICADO') {
        if (item.estadoActual !== 'Justificado') return false;
      }

      // Filtro de búsqueda por texto (DNI, Nombre o Apellido)
      if (busqueda.trim()) {
        const query = busqueda.toLowerCase().trim();
        const coincideDni = item.dni.includes(query);
        const coincideNombre = item.nombre.toLowerCase().includes(query);
        if (!coincideDni && !coincideNombre) return false;
      }

      return true;
    });
  }, [listaProcesada, gradoFiltro, estadoFiltro, busqueda]);

  // Contadores para métricas rápidas
  const conteos = useMemo(() => {
    let asistencias = 0;
    let tardanzas = 0;
    let faltas = 0;
    let justificados = 0;

    listaProcesada.forEach(item => {
      if (item.estadoActual.includes('Asisti')) asistencias++;
      else if (item.estadoActual === 'Tardanza') tardanzas++;
      else if (item.estadoActual === 'Falta') faltas++;
      else if (item.estadoActual === 'Justificado') justificados++;
    });

    return { total: listaProcesada.length, asistencias, tardanzas, faltas, justificados };
  }, [listaProcesada]);

  // Cambiar estado individual
  const handleCambiarEstado = (dni, nuevoEstado) => {
    setCambios(prev => ({
      ...prev,
      [dni]: nuevoEstado
    }));
  };

  // Marcar masivamente a los que están actualmente visibles
  const handleMarcarVisibles = (estado) => {
    const nuevosCambios = { ...cambios };
    listaFiltrada.forEach(item => {
      nuevosCambios[item.dni] = estado;
    });
    setCambios(nuevosCambios);
  };

  // Guardar cambios
  const handleGuardar = async () => {
    const dnisModificados = Object.keys(cambios);
    if (dnisModificados.length === 0) {
      setMensaje({ tipo: 'warn', texto: 'No hay cambios pendientes por guardar.' });
      return;
    }

    setSaving(true);
    setMensaje(null);

    const registrosAGuardar = dnisModificados.map(dni => ({
      dni,
      estado: cambios[dni]
    }));

    try {
      // Intentar primero con el endpoint en lote
      let res = await registrarManualLote(registrosAGuardar, fechaFormatted).catch(() => null);

      // Si el endpoint en lote no está disponible (GAS versión previa), usar fallback individual
      if (!res || !res.success) {
        let exitosos = 0;
        for (const reg of registrosAGuardar) {
          try {
            if (reg.estado === 'Justificado') {
              await justificarFalta(reg.dni, fechaFormatted, 'Justificado desde Registro Manual');
              exitosos++;
            } else if (reg.estado === 'Asistió' || reg.estado === 'Tardanza') {
              await registrarAsistencia(reg.dni);
              exitosos++;
            }
          } catch (err) {
            console.error('Error al guardar DNI:', reg.dni, err);
          }
        }
        res = {
          success: true,
          message: `Se actualizaron ${exitosos} de ${registrosAGuardar.length} estudiantes.`
        };
      }

      setMensaje({ tipo: 'success', texto: res.message || 'Cambios guardados con éxito.' });
      setCambios({});
      // Recargar datos
      await cargarDatos();
    } catch (err) {
      setMensaje({ tipo: 'error', texto: 'Error al guardar: ' + err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-blue-400">Control de Asistencia</span>
          <h1 className="mt-1 text-3xl font-black text-white md:text-4xl">Registro de Faltas y Asistencia</h1>
          <p className="mt-1 text-slate-400">Busca alumnos y actualiza su estado (Asistió, Tardanza, Falta, Justificado).</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-900/90 px-4 py-2.5 text-sm text-white font-semibold shadow-inner focus:border-blue-500 outline-none"
          />
        </div>
      </div>

      {/* Tarjetas de métricas rápidas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div 
          onClick={() => setEstadoFiltro('FALTA')}
          className={`cursor-pointer rounded-2xl border p-4 transition-all ${
            estadoFiltro === 'FALTA' 
              ? 'bg-red-500/20 border-red-500 ring-2 ring-red-500/50' 
              : 'bg-slate-900/60 border-slate-800 hover:border-red-900/50'
          }`}
        >
          <div className="text-xs font-bold text-red-400 uppercase tracking-wider">Faltas</div>
          <div className="text-3xl font-black text-white mt-1">{conteos.faltas}</div>
        </div>
        <div 
          onClick={() => setEstadoFiltro('ASISTIO')}
          className={`cursor-pointer rounded-2xl border p-4 transition-all ${
            estadoFiltro === 'ASISTIO' 
              ? 'bg-emerald-500/20 border-emerald-500 ring-2 ring-emerald-500/50' 
              : 'bg-slate-900/60 border-slate-800 hover:border-emerald-900/50'
          }`}
        >
          <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Asistieron</div>
          <div className="text-3xl font-black text-white mt-1">{conteos.asistencias}</div>
        </div>
        <div 
          onClick={() => setEstadoFiltro('TARDANZA')}
          className={`cursor-pointer rounded-2xl border p-4 transition-all ${
            estadoFiltro === 'TARDANZA' 
              ? 'bg-amber-500/20 border-amber-500 ring-2 ring-amber-500/50' 
              : 'bg-slate-900/60 border-slate-800 hover:border-amber-900/50'
          }`}
        >
          <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">Tardanzas</div>
          <div className="text-3xl font-black text-white mt-1">{conteos.tardanzas}</div>
        </div>
        <div 
          onClick={() => setEstadoFiltro('JUSTIFICADO')}
          className={`cursor-pointer rounded-2xl border p-4 transition-all ${
            estadoFiltro === 'JUSTIFICADO' 
              ? 'bg-purple-500/20 border-purple-500 ring-2 ring-purple-500/50' 
              : 'bg-slate-900/60 border-slate-800 hover:border-purple-900/50'
          }`}
        >
          <div className="text-xs font-bold text-purple-400 uppercase tracking-wider">Justificados</div>
          <div className="text-3xl font-black text-white mt-1">{conteos.justificados}</div>
        </div>
      </div>

      {/* Barra de Filtros Inteligentes */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 mb-6 shadow-xl flex flex-col md:flex-row gap-3 items-stretch md:items-center">
        {/* Buscador inteligente por DNI / Nombre / Apellido */}
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="🔍 Buscar por DNI, Nombre o Apellido..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 outline-none"
          />
          {busqueda && (
            <button 
              onClick={() => setBusqueda('')} 
              className="absolute right-3 top-2.5 text-slate-500 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>

        {/* Selector de Grado */}
        <div className="w-full md:w-56">
          <select
            value={gradoFiltro}
            onChange={(e) => setGradoFiltro(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white focus:border-blue-500 outline-none"
          >
            <option value="TODOS">Todos los grados ({estudiantes.length})</option>
            {gradosDisponibles.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>

        {/* Filtro de Estado */}
        <div className="w-full md:w-48">
          <select
            value={estadoFiltro}
            onChange={(e) => setEstadoFiltro(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white focus:border-blue-500 outline-none"
          >
            <option value="FALTA">🔴 Solo Faltas ({conteos.faltas})</option>
            <option value="ASISTIO">🟢 Solo Asistieron ({conteos.asistencias})</option>
            <option value="TARDANZA">🟡 Tardanzas ({conteos.tardanzas})</option>
            <option value="JUSTIFICADO">🟣 Justificados ({conteos.justificados})</option>
            <option value="TODOS">⚪ Ver Todos ({conteos.total})</option>
          </select>
        </div>
      </div>

      {/* Alerta / Mensaje */}
      {mensaje && (
        <div className={`mb-6 rounded-2xl border p-4 text-sm font-semibold flex items-center justify-between ${
          mensaje.tipo === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' :
          mensaje.tipo === 'warn' ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' :
          'bg-red-500/10 border-red-500/30 text-red-300'
        }`}>
          <span>{mensaje.texto}</span>
          <button onClick={() => setMensaje(null)} className="text-xs opacity-70 hover:opacity-100">Cerrar</button>
        </div>
      )}

      {/* Acciones masivas rápidas sobre los alumnos filtrados */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4 items-start sm:items-center justify-between">
        <div className="text-xs font-semibold text-slate-400">
          Mostrando <span className="text-white font-bold">{listaFiltrada.length}</span> estudiantes
          {Object.keys(cambios).length > 0 && (
            <span className="ml-2 text-blue-400 font-bold">({Object.keys(cambios).length} cambios pendientes)</span>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => handleMarcarVisibles('Asistió')}
            className="rounded-lg border border-emerald-600/40 bg-emerald-600/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-600/20 transition"
          >
            ✅ Marcar Asistió a todos los mostrados
          </button>
          <button
            onClick={() => handleMarcarVisibles('Justificado')}
            className="rounded-lg border border-purple-600/40 bg-purple-600/10 px-3 py-1.5 text-xs font-semibold text-purple-400 hover:bg-purple-600/20 transition"
          >
            🟣 Justificar a todos los mostrados
          </button>
          {Object.keys(cambios).length > 0 && (
            <button
              onClick={() => setCambios({})}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:bg-slate-700 transition"
            >
              🔄 Deshacer
            </button>
          )}
        </div>
      </div>

      {/* Tabla Principal */}
      <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/50 shadow-2xl backdrop-blur-sm">
        {loading ? (
          <div className="py-20 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-blue-500" />
            <p className="mt-4 text-slate-400 text-sm font-semibold">Cargando base de datos de estudiantes...</p>
          </div>
        ) : listaFiltrada.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <div className="text-4xl mb-2">🔍</div>
            <p className="text-base font-bold text-white">No se encontraron estudiantes</p>
            <p className="text-xs text-slate-500 mt-1">Prueba cambiando el filtro de grado o de búsqueda.</p>
          </div>
        ) : (
          <div className="overflow-auto max-h-[60vh] custom-scrollbar">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-800/90 text-slate-400 sticky top-0 z-10 backdrop-blur-md">
                <tr>
                  <th className="px-4 py-3.5 font-semibold w-10">#</th>
                  <th className="px-4 py-3.5 font-semibold">DNI</th>
                  <th className="px-4 py-3.5 font-semibold">Estudiante</th>
                  <th className="px-4 py-3.5 font-semibold">Grado</th>
                  <th className="px-4 py-3.5 font-semibold">Estado</th>
                  <th className="px-4 py-3.5 font-semibold text-right">Cambiar a (Submenú)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {listaFiltrada.map((item, idx) => {
                  return (
                    <tr
                      key={item.dni}
                      className={`transition-colors ${
                        item.conCambio 
                          ? 'bg-blue-950/20 hover:bg-blue-950/30' 
                          : 'hover:bg-slate-800/40 bg-slate-900/30'
                      }`}
                    >
                      <td className="px-4 py-3 text-xs text-slate-500">{idx + 1}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-300 font-semibold">
                        {item.dniOriginal && item.dniOriginal !== item.dni ? (
                          <span className="text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                            {item.dniOriginal}
                          </span>
                        ) : (
                          item.dni
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-white">{item.nombre}</div>
                        {item.hora && item.hora !== '--:--' && (
                          <div className="text-xs text-slate-500">Hora: {item.hora}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400 font-medium">
                        {item.gradoCompleto}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${getBadgeClass(item.estadoActual)}`}>
                          {item.estadoActual}
                        </span>
                        {item.conCambio && (
                          <span className="ml-1.5 text-xs text-blue-400 font-semibold">• Pendiente</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {/* Submenú de Estados (Asistió, Tardanza, Falta, Justificado) */}
                        <div className="inline-flex gap-1.5">
                          {ESTADOS.map(est => {
                            const seleccionado = item.estadoActual === est.valor;
                            return (
                              <button
                                key={est.valor}
                                onClick={() => handleCambiarEstado(item.dni, est.valor)}
                                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition border ${
                                  seleccionado
                                    ? est.valor === 'Asistió'
                                      ? 'bg-emerald-600 text-white border-emerald-500 shadow'
                                      : est.valor === 'Tardanza'
                                      ? 'bg-amber-600 text-white border-amber-500 shadow'
                                      : est.valor === 'Justificado'
                                      ? 'bg-purple-600 text-white border-purple-500 shadow'
                                      : 'bg-red-600 text-white border-red-500 shadow'
                                    : 'bg-slate-800 text-slate-400 border-slate-700/80 hover:bg-slate-700/80 hover:text-white'
                                }`}
                              >
                                {est.valor === 'Asistió' ? '✅' : est.valor === 'Tardanza' ? '⏰' : est.valor === 'Justificado' ? '🟣' : '❌'}
                                <span className="ml-1 hidden md:inline">{est.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Botón flotante para Guardar Cambios */}
      {Object.keys(cambios).length > 0 && (
        <div className="sticky bottom-6 mt-6 flex justify-end animate-bounce-subtle z-20">
          <button
            onClick={handleGuardar}
            disabled={saving}
            className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-4 text-base font-black text-white shadow-2xl hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 transition flex items-center gap-3 border border-blue-400/30"
          >
            {saving ? (
              <>
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Guardando cambios...
              </>
            ) : (
              <>
                💾 Guardar {Object.keys(cambios).length} cambio(s)
              </>
            )}
          </button>
        </div>
      )}
    </main>
  );
}
