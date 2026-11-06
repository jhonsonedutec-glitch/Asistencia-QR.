import React, { useState, useEffect, useMemo } from 'react';
import { obtenerHistorialPadre, obtenerTareas, obtenerComunicados, getFechaHoyLocal, normalizarFecha, calcularEstadoTarea } from '../services/api';

const STORAGE_KEY = 'ultimo_dni_padre';

const ConsultaPadres = () => {
  const [dni, setDni] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  // Pestañas: 'asistencia' | 'tareas' | 'comunicados'
  const [pestanaActiva, setPestanaActiva] = useState('asistencia');
  const [tareas, setTareas] = useState([]);
  const [loadingTareas, setLoadingTareas] = useState(false);
  const [comunicados, setComunicados] = useState([]);
  const [loadingComunicados, setLoadingComunicados] = useState(false);
  const [modalBanner, setModalBanner] = useState(null);

  // Consultar automáticamente si ya hay un DNI guardado al cargar la página
  useEffect(() => {
    const savedDni = localStorage.getItem(STORAGE_KEY);
    if (savedDni && /^\d{8}$/.test(savedDni)) {
      realizarConsulta(savedDni);
    }
  }, []);

  const realizarConsulta = async (dniAConsultar) => {
    if (!dniAConsultar || dniAConsultar.length !== 8) {
      setError('El DNI debe tener 8 dígitos numéricos.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const result = await obtenerHistorialPadre(dniAConsultar);
      if (result.success) {
        setData(result);
        try {
          localStorage.setItem(STORAGE_KEY, dniAConsultar);
        } catch {}

        // Cargar tareas escolares para el grado de este estudiante
        if (result.estudiante && result.estudiante.grado) {
          const gradoBusqueda = result.estudiante.nivel 
            ? `${result.estudiante.grado} - ${result.estudiante.nivel}` 
            : result.estudiante.grado;
          
          setLoadingTareas(true);
          obtenerTareas(gradoBusqueda).then(tRes => {
            if (tRes && tRes.success && Array.isArray(tRes.tareas)) {
              setTareas(tRes.tareas);
            }
          }).finally(() => {
            setLoadingTareas(false);
          });

          // Cargar comunicados y reuniones para este grado o generales
          setLoadingComunicados(true);
          obtenerComunicados(gradoBusqueda).then(cRes => {
            if (cRes && cRes.success && Array.isArray(cRes.comunicados)) {
              setComunicados(cRes.comunicados);
            }
          }).finally(() => {
            setLoadingComunicados(false);
          });
        }
      } else {
        setError(result.message || 'No se encontró el historial para este DNI.');
      }
    } catch (err) {
      setError('Hubo un problema de conexión. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    realizarConsulta(dni);
  };

  const handleLimpiar = () => {
    setDni('');
    setData(null);
    setError(null);
    setTareas([]);
    setComunicados([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  const asistencias = data?.estadisticas?.asistencias ?? data?.historial?.filter(r => r.estado && r.estado.includes('Asisti')).length ?? 0;
  const tardanzas = data?.estadisticas?.tardanzas ?? data?.historial?.filter(r => r.estado === 'Tardanza').length ?? 0;
  const faltas = data?.estadisticas?.faltas ?? data?.historial?.filter(r => r.estado === 'Falta').length ?? 0;
  const justificados = data?.estadisticas?.justificados ?? data?.historial?.filter(r => r.estado === 'Justificado').length ?? 0;

  const tareasActivas = useMemo(() => {
    return tareas.filter(t => t.estado !== 'Finalizada');
  }, [tareas]);

  const comunicadosActivos = useMemo(() => {
    return comunicados.filter(c => c.estado === 'Activo');
  }, [comunicados]);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-2xl mx-auto">
        {/* Header con icono institucional */}
        <div className="text-center mb-8">
          <img 
            src="/app-icon.png" 
            alt="Logo IEP Millenium" 
            className="w-24 h-24 mx-auto mb-4 rounded-3xl shadow-lg border-2 border-white object-cover"
          />
          <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Portal de Padres</h2>
          <p className="text-gray-600">Consulta en tiempo real la asistencia, salida y tareas escolares de tu hijo/a.</p>
        </div>

        <div className="bg-white rounded-xl shadow-md overflow-hidden mb-8">
          <div className="p-6">
            <form onSubmit={handleSearch} className="flex gap-3 items-center">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Ingresar DNI (8 dígitos)"
                  className="w-full px-4 py-3 text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none font-mono"
                  value={dni}
                  onChange={(e) => setDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  maxLength={8}
                  disabled={loading}
                />
                {dni && (
                  <button
                    type="button"
                    onClick={handleLimpiar}
                    title="Borrar DNI guardado"
                    className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600 text-sm font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={loading || dni.length !== 8}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : 'Consultar'}
              </button>
            </form>

            {/* Aviso informativo de guardado */}
            {dni.length === 8 && (
              <p className="mt-2 text-xs text-gray-400 flex items-center gap-1">
                <span>💾 Este DNI queda grabado en este teléfono para consultas rápidas.</span>
              </p>
            )}

            {error && (
              <div className="mt-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded">
                <p>{error}</p>
              </div>
            )}
          </div>
        </div>

        {data && data.estudiante && (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden animate-fade-in-up border border-gray-100">
            {/* Cabecera del Estudiante */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-black">{data.estudiante.nombre}</h3>
                <p className="text-blue-100 text-sm mt-0.5">
                  DNI: {data.estudiante.dni} | <span className="font-semibold">{data.estudiante.grado} {data.estudiante.nivel && `· ${data.estudiante.nivel}`}</span>
                </p>
              </div>
              <div className="self-start sm:self-auto">
                <span className="bg-white/20 backdrop-blur-sm border border-white/30 text-white text-xs font-bold px-3 py-1.5 rounded-full">
                  🏫 Estudiante Regular
                </span>
              </div>
            </div>

            {/* Pestañas de Navegación: Asistencia vs Tareas */}
            <div className="flex border-b border-gray-200 bg-gray-50/80 px-4 sm:px-6 pt-3 gap-2">
              <button
                type="button"
                onClick={() => setPestanaActiva('asistencia')}
                className={`pb-3 px-3 sm:px-4 font-bold text-xs sm:text-sm flex items-center gap-1.5 border-b-2 transition-all ${
                  pestanaActiva === 'asistencia'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <span>📅</span>
                <span>Asistencia y Salidas</span>
              </button>

              <button
                type="button"
                onClick={() => setPestanaActiva('tareas')}
                className={`pb-3 px-3 sm:px-4 font-bold text-xs sm:text-sm flex items-center gap-1.5 border-b-2 transition-all ${
                  pestanaActiva === 'tareas'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <span>📚</span>
                <span>Tareas Escolares</span>
                {tareasActivas.length > 0 && (
                  <span className="rounded-full bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5">
                    {tareasActivas.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setPestanaActiva('comunicados')}
                className={`pb-3 px-3 sm:px-4 font-bold text-xs sm:text-sm flex items-center gap-1.5 border-b-2 transition-all ${
                  pestanaActiva === 'comunicados'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <span>📢</span>
                <span>Comunicados</span>
                {comunicadosActivos.length > 0 && (
                  <span className="rounded-full bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5">
                    {comunicadosActivos.length}
                  </span>
                )}
              </button>
            </div>

            {/* CONTENIDO 1: ASISTENCIA Y SALIDAS */}
            {pestanaActiva === 'asistencia' && (
              <div className="p-6 animate-in fade-in duration-150">
                {/* Tarjetas de estadísticas */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
                  <div className="bg-green-50 p-4 rounded-xl border border-green-100 text-center">
                    <div className="text-xs text-green-600 font-bold uppercase tracking-wider mb-1">Asistencias</div>
                    <div className="text-3xl font-extrabold text-green-700">{asistencias}</div>
                  </div>
                  <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 text-center">
                    <div className="text-xs text-yellow-600 font-bold uppercase tracking-wider mb-1">Tardanzas</div>
                    <div className="text-3xl font-extrabold text-yellow-700">{tardanzas}</div>
                  </div>
                  <div className="bg-red-50 p-4 rounded-xl border border-red-100 text-center">
                    <div className="text-xs text-red-600 font-bold uppercase tracking-wider mb-1">Faltas</div>
                    <div className="text-3xl font-extrabold text-red-700">{faltas}</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 text-center">
                    <div className="text-xs text-purple-600 font-bold uppercase tracking-wider mb-1">Justificadas</div>
                    <div className="text-3xl font-extrabold text-purple-700">{justificados}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-4 border-b pb-2">
                  <h4 className="font-bold text-gray-800 text-base">Historial y Trazabilidad de Asistencia</h4>
                </div>
                
                {(!data.historial || data.historial.length === 0) ? (
                  <p className="text-gray-500 text-center py-6">No hay registros de asistencia disponibles.</p>
                ) : (
                  <div className="space-y-3">
                    {data.historial.map((registro, idx) => {
                      let badgeColor = 'bg-gray-100 text-gray-800';
                      if (registro.estado.includes('Asisti')) badgeColor = 'bg-green-100 text-green-800 border border-green-200';
                      else if (registro.estado === 'Tardanza') badgeColor = 'bg-yellow-100 text-yellow-800 border border-yellow-200';
                      else if (registro.estado === 'Falta') badgeColor = 'bg-red-100 text-red-800 border border-red-200';
                      else if (registro.estado === 'Justificado') badgeColor = 'bg-purple-100 text-purple-800 border border-purple-200';

                      const tieneIngreso = registro.hora && registro.hora !== '--:--';
                      const tieneSalida = registro.horaSalida && registro.horaSalida !== '--:--';
                      const fechaHoyNorm = normalizarFecha(getFechaHoyLocal());
                      const esHoy = normalizarFecha(registro.fecha) === fechaHoyNorm;

                      return (
                        <div key={idx} className="flex justify-between items-center p-4 hover:bg-gray-50 border border-gray-100 rounded-xl transition-colors">
                          <div className="flex flex-col">
                            <span className="font-semibold text-gray-900">{registro.fecha}</span>
                            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-gray-600 mt-1">
                              <span className="flex items-center gap-1 font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                <span>🕒 Ingreso:</span> <span>{registro.hora || '--:--'}</span>
                              </span>
                              <span className="flex items-center gap-1 font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                <span>🚪 Salida:</span> 
                                <span className={tieneSalida ? 'font-bold text-blue-800' : 'text-amber-700 font-semibold'}>
                                  {tieneSalida 
                                    ? registro.horaSalida 
                                    : (esHoy && tieneIngreso && (registro.estado.includes('Asisti') || registro.estado === 'Tardanza')) 
                                      ? 'En el colegio' 
                                      : '--:--'}
                                </span>
                              </span>
                            </div>
                            {registro.motivo && (
                              <span className="text-xs text-purple-700 mt-1 italic">Motivo: {registro.motivo}</span>
                            )}
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs sm:text-sm font-semibold shrink-0 ml-2 ${badgeColor}`}>
                            {registro.estado}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* CONTENIDO 2: TAREAS ESCOLARES Y AGENDA */}
            {pestanaActiva === 'tareas' && (
              <div className="p-6 animate-in fade-in duration-150">
                <div className="flex items-center justify-between mb-4 border-b pb-2">
                  <div>
                    <h4 className="font-bold text-gray-800 text-base">Cuaderno de Tareas y Agenda</h4>
                    <p className="text-xs text-gray-500">Tareas asignadas por los docentes para {data.estudiante.grado}.</p>
                  </div>
                  {tareas.length > 0 && (
                    <span className="text-xs font-semibold text-gray-500">
                      Total: {tareas.length}
                    </span>
                  )}
                </div>

                {loadingTareas ? (
                  <div className="py-12 text-center text-gray-400 text-sm">
                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600 mb-2" />
                    Cargando tareas del salón...
                  </div>
                ) : tareas.length === 0 ? (
                  <div className="py-12 text-center text-gray-500">
                    <div className="text-4xl mb-2">🎉</div>
                    <p className="font-bold text-gray-800 text-base">¡Todo al día!</p>
                    <p className="text-xs text-gray-500 mt-1">
                      No hay tareas registradas para el salón de {data.estudiante.nombre} en este momento.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {tareas.map((t) => {
                      const esFinalizada = t.estado === 'Finalizada';
                      const estadoInfo = t.infoEstado || calcularEstadoTarea(t);

                      return (
                        <div 
                          key={t.id} 
                          className={`rounded-xl border p-4.5 transition-all ${
                            !esFinalizada 
                              ? 'bg-blue-50/40 border-blue-200/80 shadow-sm' 
                              : 'bg-gray-50 border-gray-200 opacity-75'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-blue-700 bg-blue-100/70 border border-blue-200 px-2.5 py-0.5 rounded-lg text-xs">
                                📖 {t.curso}
                              </span>
                              <span className="text-xs text-gray-600 font-medium">
                                {t.docente}
                              </span>
                            </div>

                            {/* Badge de Estado Dinámico */}
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border flex items-center gap-1 ${
                              estadoInfo.codigo === 'VENCIDA'
                                ? 'bg-rose-100 text-rose-800 border-rose-300'
                                : estadoInfo.codigo === 'POR_VENCER'
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : estadoInfo.codigo === 'PROGRAMADA'
                                ? 'bg-blue-100 text-blue-800 border-blue-300'
                                : estadoInfo.codigo === 'FINALIZADA'
                                ? 'bg-gray-200 text-gray-700 border-gray-300'
                                : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            }`}>
                              <span>{estadoInfo.icono}</span>
                              <span>{estadoInfo.label}</span>
                            </span>
                          </div>

                          <div className="my-2.5 p-3.5 bg-white rounded-lg border border-gray-200/80 text-gray-800 text-sm whitespace-pre-line leading-relaxed shadow-inner">
                            {t.descripcion}
                          </div>

                          {/* Botón de Descarga / Vista de Ficha PDF Adjunta */}
                          {t.urlAdjunto && (
                            <div className="my-3 p-3 bg-blue-50/70 rounded-xl border border-blue-200 flex flex-wrap items-center justify-between gap-2.5 shadow-sm">
                              <a
                                href={t.urlAdjunto}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold px-4 py-2 text-xs shadow-md hover:shadow-lg transition-all"
                              >
                                <span className="text-sm">📄</span>
                                <span>Descargar / Ver Ficha PDF</span>
                                <span>⬇</span>
                              </a>
                              <span className="text-[11px] text-gray-600 font-mono truncate max-w-[220px]">
                                📎 {t.nombreAdjunto || 'ficha_adjunta.pdf'}
                              </span>
                            </div>
                          )}

                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 pt-2 border-t border-gray-100">
                            <div className="flex items-center gap-2 flex-wrap">
                              {t.fechaInicio && (
                                <span className="text-gray-600 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                                  📅 Inicio: {t.fechaInicio}
                                </span>
                              )}
                              <span className="font-semibold text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                ⏰ Entrega límite: <strong>{t.fechaEntrega}</strong>
                              </span>
                            </div>
                            <span>Publicado el: {t.fechaRegistro}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* CONTENIDO 3: COMUNICADOS Y REUNIONES ESCOLARES */}
            {pestanaActiva === 'comunicados' && (
              <div className="p-6 animate-in fade-in duration-150">
                <div className="flex items-center justify-between mb-4 border-b pb-2">
                  <div>
                    <h4 className="font-bold text-gray-800 text-base">Reuniones y Comunicados Oficiales</h4>
                    <p className="text-xs text-gray-500">Convocatorias dirigidas a {data.estudiante.nombre} y familia.</p>
                  </div>
                  {comunicados.length > 0 && (
                    <span className="text-xs font-semibold text-gray-500">
                      Total: {comunicados.length}
                    </span>
                  )}
                </div>

                {loadingComunicados ? (
                  <div className="py-12 text-center text-gray-400 text-sm">
                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600 mb-2" />
                    Cargando comunicados escolares...
                  </div>
                ) : comunicados.length === 0 ? (
                  <div className="py-12 text-center text-gray-500">
                    <div className="text-4xl mb-2">🎉</div>
                    <p className="font-bold text-gray-800 text-base">¡Todo al día!</p>
                    <p className="text-xs text-gray-500 mt-1">
                      No hay reuniones o comunicados pendientes para el salón en este momento.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {comunicados.map((item) => {
                      const esActivo = item.estado === 'Activo';

                      return (
                        <div
                          key={item.id}
                          className={`rounded-2xl border transition-all overflow-hidden shadow-sm ${
                            esActivo ? 'border-blue-200 bg-white' : 'border-gray-200 bg-gray-50 opacity-75'
                          }`}
                        >
                          {/* Banner / Afiche Gráfico con visualización responsive */}
                          {item.urlBanner && (
                            <div 
                              onClick={() => setModalBanner(item.urlBanner)}
                              className="relative cursor-pointer group max-h-64 overflow-hidden bg-gray-900 border-b border-gray-200 flex items-center justify-center"
                            >
                              <img 
                                src={item.urlBanner} 
                                alt={item.titulo} 
                                className="w-full h-full max-h-64 object-cover group-hover:scale-105 transition-all duration-300"
                                loading="lazy"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                              <div className="absolute bottom-2.5 right-2.5 bg-black/75 backdrop-blur-sm text-white text-[11px] font-bold px-3 py-1 rounded-full shadow flex items-center gap-1.5">
                                <span>🔍</span>
                                <span>Toca para ver afiche completo</span>
                              </div>
                            </div>
                          )}

                          <div className="p-4 sm:p-5">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                              <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border ${
                                item.dirigidoA === 'TODOS'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : 'bg-purple-50 text-purple-700 border-purple-200'
                              }`}>
                                {item.dirigidoA === 'TODOS' ? '🏫 General - Todo el Colegio' : `☀️ ${item.dirigidoA}`}
                              </span>

                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                                esActivo
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : 'bg-gray-200 text-gray-700 border-gray-300'
                              }`}>
                                {esActivo ? '🟢 Convocatoria Activa' : '✓ Reunión Concluida'}
                              </span>
                            </div>

                            <h3 className="text-base font-bold text-gray-900 mb-2 leading-snug">
                              {item.titulo}
                            </h3>

                            {/* Datos clave: Fecha, Hora y Lugar */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-2.5 text-xs text-gray-700 bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-blue-900">📅 Fecha:</span>
                                <strong className="text-gray-900">{item.fechaEvento}</strong>
                              </div>
                              {item.horaEvento && (
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-blue-900">⏰ Hora:</span>
                                  <strong className="text-gray-900">{item.horaEvento}</strong>
                                </div>
                              )}
                              <div className="sm:col-span-2 flex items-center gap-2 truncate">
                                <span className="font-semibold text-blue-900">📍 Lugar:</span>
                                <span className="text-gray-800 truncate">{item.lugar}</span>
                              </div>
                            </div>

                            {item.descripcion && (
                              <div className="my-2.5 p-3.5 bg-gray-50 rounded-xl border border-gray-200 text-gray-800 text-xs sm:text-sm whitespace-pre-line leading-relaxed shadow-inner">
                                {item.descripcion}
                              </div>
                            )}

                            <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
                              <span>Publicado el: {item.fechaRegistro}</span>
                              {item.urlBanner && (
                                <a
                                  href={item.urlBanner}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1"
                                >
                                  <span>🖼️ Ver afiche completo</span>
                                  <span>↗</span>
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </div>

      {/* Modal Lightbox para ampliar Banner en el Portal de Padres */}
      {modalBanner && (
        <div 
          onClick={() => setModalBanner(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-3xl max-h-[90vh] bg-white rounded-3xl p-3 shadow-2xl overflow-hidden flex flex-col items-center"
          >
            <div className="w-full flex justify-between items-center pb-2 px-2 border-b border-gray-200 mb-2">
              <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                <span>🖼️</span> Afiche Oficial de la Convocatoria
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={modalBanner}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1 rounded-lg transition"
                >
                  Descargar original ⬇
                </a>
                <button
                  onClick={() => setModalBanner(null)}
                  className="text-gray-500 hover:text-gray-800 bg-gray-100 p-1 rounded-lg text-xs"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <img 
              src={modalBanner} 
              alt="Afiche ampliado" 
              className="max-h-[75vh] w-auto object-contain rounded-2xl shadow-md"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ConsultaPadres;
