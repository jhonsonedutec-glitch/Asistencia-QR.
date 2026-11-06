import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { obtenerComunicados, registrarComunicado, cambiarEstadoComunicado, eliminarComunicado } from '../services/api';

const GRADOS_DESTINO = [
  { valor: 'TODOS', label: '🏫 General (Todo el Colegio - Primaria y Secundaria)' },
  { valor: 'PRIMARIA', label: '☀️ Todo Nivel Primaria (1ro a 6to)' },
  { valor: 'SECUNDARIA', label: '🌅 Todo Nivel Secundaria (1ro a 5to)' },
  { valor: '1ro - Primaria', label: '☀️ 1ro de Primaria' },
  { valor: '2do - Primaria', label: '☀️ 2do de Primaria' },
  { valor: '3ro - Primaria', label: '☀️ 3ro de Primaria' },
  { valor: '4to - Primaria', label: '☀️ 4to de Primaria' },
  { valor: '5to - Primaria', label: '☀️ 5to de Primaria' },
  { valor: '6to - Primaria', label: '☀️ 6to de Primaria' },
  { valor: '1ro - Secundaria', label: '🌅 1ro de Secundaria' },
  { valor: '2do - Secundaria', label: '🌅 2do de Secundaria' },
  { valor: '3ro - Secundaria', label: '🌅 3ro de Secundaria' },
  { valor: '4to - Secundaria', label: '🌅 4to de Secundaria' },
  { valor: '5to - Secundaria', label: '🌅 5to de Secundaria' }
];

const getFechaHoyISO = () => {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = String(hoy.getMonth() + 1).padStart(2, '0');
  const d = String(hoy.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function Comunicados() {
  // Form states
  const [titulo, setTitulo] = useState('');
  const [dirigidoA, setDirigidoA] = useState('TODOS');
  const [fechaEvento, setFechaEvento] = useState(getFechaHoyISO);
  const [horaEvento, setHoraEvento] = useState('4:30 pm');
  const [lugar, setLugar] = useState('Patio Central - IEP Millenium');
  const [descripcion, setDescripcion] = useState('');

  // Banner image state
  const [bannerFile, setBannerFile] = useState(null);
  const fileInputRef = useRef(null);

  const [submitting, setSubmitting] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  // List of announcements
  const [comunicados, setComunicados] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filters & Search
  const [filtroEstado, setFiltroEstado] = useState('TODOS');
  const [busqueda, setBusqueda] = useState('');

  // Modal para ver banner ampliado
  const [modalBanner, setModalBanner] = useState(null);

  // Cargar comunicados
  const cargarComunicados = useCallback(async () => {
    setLoading(true);
    try {
      const res = await obtenerComunicados('');
      if (res && res.success && Array.isArray(res.comunicados)) {
        setComunicados(res.comunicados);
      }
    } catch (err) {
      console.error('Error al cargar comunicados:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarComunicados();
  }, [cargarComunicados]);

  // Manejar selección de imagen/banner
  const handleBannerChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setMensaje({ tipo: 'error', texto: 'Por favor seleccione un archivo de imagen válido (JPG, PNG, WEBP).' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setMensaje({ tipo: 'error', texto: 'La imagen supera el límite de 8 MB. Seleccione una imagen más liviana.' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setBannerFile({
        nombre: file.name,
        tipo: file.type,
        tamano: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
        preview: reader.result,
        base64: reader.result
      });
      setMensaje(null);
    };
    reader.onerror = () => {
      setMensaje({ tipo: 'error', texto: 'No se pudo leer la imagen seleccionada.' });
    };
    reader.readAsDataURL(file);
  };

  const handleQuitarBanner = () => {
    setBannerFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Enviar formulario
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!titulo.trim()) {
      setMensaje({ tipo: 'error', texto: 'Debe ingresar el título de la reunión o comunicado.' });
      return;
    }

    let fEventoFormateada = '';
    if (fechaEvento) {
      const [y, m, d] = fechaEvento.split('-');
      fEventoFormateada = `${d}/${m}/${y}`;
    }

    setSubmitting(true);
    setMensaje(null);

    try {
      const res = await registrarComunicado({
        titulo: titulo.trim(),
        dirigidoA: dirigidoA,
        fechaEvento: fEventoFormateada,
        horaEvento: horaEvento,
        lugar: lugar.trim(),
        descripcion: descripcion.trim(),
        banner: bannerFile ? {
          base64: bannerFile.base64,
          nombre: bannerFile.nombre,
          tipo: bannerFile.tipo
        } : null
      });

      if (res && res.success) {
        setMensaje({ 
          tipo: 'success', 
          texto: `✅ Comunicado "${titulo.trim()}" publicado correctamente${bannerFile ? ' con banner gráfico' : ''}.` 
        });
        setTitulo('');
        setDescripcion('');
        handleQuitarBanner();
        await cargarComunicados();
      } else {
        setMensaje({ tipo: 'error', texto: res.message || 'No se pudo registrar el comunicado.' });
      }
    } catch (err) {
      setMensaje({ tipo: 'error', texto: 'Error al enviar comunicado: ' + err.message });
    } finally {
      setSubmitting(false);
    }
  };

  // Cambiar estado a Concluido o Reactivar
  const handleCambiarEstado = async (id, estadoActual) => {
    const nuevoEstado = estadoActual === 'Activo' ? 'Finalizado' : 'Activo';
    const accion = nuevoEstado === 'Finalizado' ? 'concluido' : 'reactivado';
    if (!window.confirm(`¿Deseas marcar este comunicado como ${accion}?`)) return;

    try {
      await cambiarEstadoComunicado(id, nuevoEstado);
      cargarComunicados();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // Eliminar comunicado
  const handleEliminar = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este comunicado de reuniones?')) return;
    try {
      await eliminarComunicado(id);
      cargarComunicados();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // Filtrado reactivo de comunicados
  const comunicadosFiltrados = useMemo(() => {
    return comunicados.filter(c => {
      if (filtroEstado === 'ACTIVOS' && c.estado !== 'Activo') return false;
      if (filtroEstado === 'FINALIZADOS' && c.estado !== 'Finalizado') return false;

      if (busqueda.trim()) {
        const q = busqueda.toLowerCase();
        const enTitulo = (c.titulo || '').toLowerCase().includes(q);
        const enDesc = (c.descripcion || '').toLowerCase().includes(q);
        const enLugar = (c.lugar || '').toLowerCase().includes(q);
        const enDirigido = (c.dirigidoA || '').toLowerCase().includes(q);
        return enTitulo || enDesc || enLugar || enDirigido;
      }
      return true;
    });
  }, [comunicados, filtroEstado, busqueda]);

  const contadores = useMemo(() => {
    const c = { TODOS: comunicados.length, ACTIVOS: 0, FINALIZADOS: 0 };
    comunicados.forEach(item => {
      if (item.estado === 'Activo') c.ACTIVOS++;
      if (item.estado === 'Finalizado') c.FINALIZADOS++;
    });
    return c;
  }, [comunicados]);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 font-sans text-slate-100">
      <div className="mx-auto max-w-7xl">
        
        {/* Cabecera del Módulo */}
        <div className="rounded-3xl border border-blue-900/40 bg-gradient-to-r from-slate-900 via-slate-900 to-blue-950/40 p-6 shadow-2xl mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600/20 border border-blue-500/40 text-2xl shadow-lg">
              📢
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                Gestión Institucional
              </span>
              <h1 className="text-2xl font-black text-white">Comunicados y Asambleas</h1>
              <p className="text-xs text-slate-400">
                Publica avisos, convocatorias y reuniones con banners gráficos para el Portal de Padres.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={cargarComunicados}
              disabled={loading}
              className="rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition flex items-center gap-1.5"
            >
              <span>🔄</span>
              <span>{loading ? 'Actualizando...' : 'Actualizar'}</span>
            </button>
          </div>
        </div>

        {/* Alerta de Mensaje */}
        {mensaje && (
          <div className={`mb-6 rounded-2xl border p-4 text-sm font-semibold flex items-center justify-between ${
            mensaje.tipo === 'success' 
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' 
              : 'bg-red-500/15 border-red-500/30 text-red-300'
          }`}>
            <span>{mensaje.texto}</span>
            <button onClick={() => setMensaje(null)} className="text-xs opacity-75 hover:opacity-100">✕</button>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-12">
          
          {/* Formulario de Publicación de Comunicado (Columna Izquierda) */}
          <section className="lg:col-span-5 rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl backdrop-blur-md h-fit">
            <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
              <span className="text-xl">✍️</span>
              <h2 className="text-lg font-bold text-white">Crear Nuevo Comunicado</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Título de la Reunión */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1 ml-1">
                  Título del Comunicado / Reunión *
                </label>
                <input
                  type="text"
                  placeholder="Ej: 1ra Asamblea General de Padres de Familia"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 outline-none"
                  required
                />
              </div>

              {/* Dirigido A */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1 ml-1">
                  Dirigido a:
                </label>
                <select
                  value={dirigidoA}
                  onChange={(e) => setDirigidoA(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white focus:border-blue-500 outline-none font-medium"
                >
                  {GRADOS_DESTINO.map(g => (
                    <option key={g.valor} value={g.valor}>{g.label}</option>
                  ))}
                </select>
              </div>

              {/* Fecha y Hora en 2 columnas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1 ml-1">
                    📅 Fecha de la Reunión
                  </label>
                  <input
                    type="date"
                    value={fechaEvento}
                    onChange={(e) => setFechaEvento(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1 ml-1">
                    ⏰ Hora de la Reunión
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: 4:30 pm o Primaria 4:30 pm / Sec. 5:30 pm"
                    value={horaEvento}
                    onChange={(e) => setHoraEvento(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* Lugar o Modalidad */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1 ml-1">
                  📍 Lugar / Modalidad
                </label>
                <input
                  type="text"
                  placeholder="Ej: Patio Central de la IEP / Aula de 4to Secundaria"
                  value={lugar}
                  onChange={(e) => setLugar(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 outline-none"
                />
              </div>

              {/* Subir Banner / Afiche */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1 ml-1">
                  🖼️ Subir Banner o Afiche Gráfico (Imagen)
                </label>
                
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  ref={fileInputRef}
                  onChange={handleBannerChange}
                  className="hidden"
                  id="input-banner-comunicado"
                />

                {!bannerFile ? (
                  <label
                    htmlFor="input-banner-comunicado"
                    className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 hover:border-blue-500 bg-slate-950/50 hover:bg-blue-950/20 rounded-2xl p-4 cursor-pointer transition text-center group"
                  >
                    <span className="text-3xl mb-1 group-hover:scale-110 transition">🖼️</span>
                    <span className="text-xs font-semibold text-slate-300 group-hover:text-blue-300">
                      Toca para seleccionar el Banner o Afiche
                    </span>
                    <span className="text-[10px] text-slate-500 mt-0.5">
                      JPG, PNG o WEBP (Diseño del volante o flyer)
                    </span>
                  </label>
                ) : (
                  <div className="rounded-2xl border border-blue-500/40 bg-blue-950/30 p-3 overflow-hidden shadow-inner">
                    <div className="relative group rounded-xl overflow-hidden mb-2 max-h-48 border border-slate-800">
                      <img 
                        src={bannerFile.preview} 
                        alt="Previsualización banner" 
                        className="w-full h-full object-cover rounded-xl"
                      />
                      <button
                        type="button"
                        onClick={handleQuitarBanner}
                        className="absolute top-2 right-2 bg-red-600/90 hover:bg-red-500 text-white p-1.5 rounded-full shadow-lg transition"
                        title="Quitar imagen"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-xs text-blue-300 px-1">
                      <span className="truncate max-w-[200px] font-mono">{bannerFile.nombre}</span>
                      <span className="font-semibold">{bannerFile.tamano} • Listo</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Indicaciones / Agenda */}
              <div>
                <div className="flex justify-between items-center mb-1 ml-1">
                  <label className="text-xs font-semibold text-slate-400">
                    Agenda / Puntos a Tratar / Indicaciones
                  </label>
                  <span className="text-[11px] text-slate-500">{descripcion.length} caracteres</span>
                </div>
                <textarea
                  rows={4}
                  placeholder="Ej: 1. Informe de rendimiento académico del 3er bimestre.&#10;2. Elección de la directiva de padres.&#10;Se ruega puntual asistencia y portar DNI."
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white placeholder-slate-500 focus:border-blue-500 outline-none resize-none leading-relaxed"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || !titulo.trim()}
                className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3.5 font-bold text-white shadow-lg hover:from-blue-500 hover:to-indigo-500 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    <span>{bannerFile ? 'Subiendo banner a Drive y publicando...' : 'Publicando comunicado...'}</span>
                  </>
                ) : (
                  <>
                    <span>📢</span>
                    <span>Publicar Comunicado para los Padres</span>
                  </>
                )}
              </button>
            </form>
          </section>

          {/* Listado de Comunicados Registrados (Columna Derecha) */}
          <section className="lg:col-span-7 rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl backdrop-blur-md flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">📋</span>
                <h2 className="text-lg font-bold text-white">Historial de Comunicados</h2>
                <span className="rounded-full bg-blue-600/30 border border-blue-500/40 px-2 py-0.5 text-xs font-bold text-blue-300">
                  {comunicados.length}
                </span>
              </div>
            </div>

            {/* Pestañas de Filtros */}
            <div className="flex items-center gap-2 mb-3.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {[
                { id: 'TODOS', label: 'Todos', cant: contadores.TODOS },
                { id: 'ACTIVOS', label: '🟢 Próximos / Vigentes', cant: contadores.ACTIVOS },
                { id: 'FINALIZADOS', label: '✓ Concluidos', cant: contadores.FINALIZADOS }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setFiltroEstado(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 border ${
                    filtroEstado === tab.id
                      ? 'bg-blue-600 border-blue-500 text-white shadow'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    filtroEstado === tab.id ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {tab.cant}
                  </span>
                </button>
              ))}
            </div>

            {/* Barra de Búsqueda Rápida */}
            <div className="mb-4">
              <input
                type="text"
                placeholder="🔍 Buscar por título, fecha, lugar o público..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-blue-500 outline-none"
              />
            </div>

            {loading && (
              <div className="py-12 text-center text-slate-400 text-sm animate-pulse">
                Consultando comunicados registrados...
              </div>
            )}

            {!loading && comunicadosFiltrados.length === 0 && (
              <div className="py-16 text-center text-slate-500">
                <div className="text-4xl mb-2">📢</div>
                <p className="font-bold text-white text-base">
                  {busqueda || filtroEstado !== 'TODOS' ? 'No hay comunicados con ese filtro' : 'No hay comunicados publicados aún'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Usa el formulario para convocar a la primera reunión de padres de familia.
                </p>
              </div>
            )}

            {!loading && comunicadosFiltrados.length > 0 && (
              <div className="space-y-4 overflow-y-auto max-h-[600px] pr-1 custom-scrollbar">
                {comunicadosFiltrados.map((item) => {
                  const esActivo = item.estado === 'Activo';

                  return (
                    <div
                      key={item.id}
                      className={`rounded-2xl border transition-all overflow-hidden ${
                        esActivo 
                          ? 'border-slate-700/80 bg-slate-900/80 hover:border-slate-600 shadow-md' 
                          : 'border-slate-800/50 bg-slate-950/40 opacity-70'
                      }`}
                    >
                      {/* Banner Image Preview Header si existe */}
                      {item.urlBanner && (
                        <div 
                          onClick={() => setModalBanner(item.urlBanner)}
                          className="relative cursor-pointer group h-44 w-full overflow-hidden bg-slate-950 border-b border-slate-800"
                        >
                          <img 
                            src={item.urlBanner} 
                            alt={item.titulo} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
                          <div className="absolute bottom-2 right-2 bg-slate-900/90 text-white text-[11px] px-2.5 py-1 rounded-lg border border-slate-700 flex items-center gap-1 shadow">
                            <span>🔍</span>
                            <span>Toca para ampliar afiche</span>
                          </div>
                        </div>
                      )}

                      <div className="p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border ${
                            item.dirigidoA === 'TODOS'
                              ? 'bg-blue-600/20 text-blue-300 border-blue-500/40'
                              : 'bg-purple-600/20 text-purple-300 border-purple-500/40'
                          }`}>
                            {item.dirigidoA === 'TODOS' ? '🏫 Todo el Colegio' : `☀️ ${item.dirigidoA}`}
                          </span>

                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                            esActivo 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                              : 'bg-slate-700/30 text-slate-400 border-slate-600/30'
                          }`}>
                            {esActivo ? '🟢 Convocatoria Activa' : '✓ Realizada / Concluida'}
                          </span>
                        </div>

                        <h3 className="text-base font-bold text-white mb-2 leading-snug">
                          {item.titulo}
                        </h3>

                        {/* Ficha de Detalles: Fecha, Hora, Lugar */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-2.5 text-xs text-slate-300 bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                          <div className="flex items-center gap-2">
                            <span className="text-amber-400">📅 Fecha:</span>
                            <strong className="text-white">{item.fechaEvento}</strong>
                          </div>
                          {item.horaEvento && (
                            <div className="flex items-center gap-2">
                              <span className="text-amber-400">⏰ Hora:</span>
                              <strong className="text-white">{item.horaEvento}</strong>
                            </div>
                          )}
                          <div className="sm:col-span-2 flex items-center gap-2 truncate">
                            <span className="text-blue-400">📍 Lugar:</span>
                            <span className="text-slate-200 truncate">{item.lugar}</span>
                          </div>
                        </div>

                        {/* Descripción / Agenda */}
                        {item.descripcion && (
                          <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed my-2.5 p-3 rounded-xl bg-slate-950/40 border border-slate-800/60">
                            {item.descripcion}
                          </p>
                        )}

                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-800/60 text-xs text-slate-400">
                          <span className="text-[11px]">
                            Publicado el: {item.fechaRegistro}
                          </span>

                          <div className="flex items-center gap-2 self-end sm:self-auto">
                            <button
                              onClick={() => handleCambiarEstado(item.id, item.estado)}
                              className={`text-xs px-2.5 py-1 rounded-lg border transition ${
                                esActivo
                                  ? 'bg-emerald-600/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-600/25'
                                  : 'bg-blue-600/15 text-blue-400 border-blue-500/30 hover:bg-blue-600/25'
                              }`}
                            >
                              {esActivo ? '✓ Marcar Concluida' : '↺ Reactivar'}
                            </button>
                            <button
                              onClick={() => handleEliminar(item.id)}
                              className="text-xs bg-red-600/15 text-red-400 border border-red-500/30 px-2.5 py-1 rounded-lg hover:bg-red-600/25 transition"
                              title="Eliminar comunicado"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

        </div>
      </div>

      {/* Modal para ver Afiche/Banner en Grande */}
      {modalBanner && (
        <div 
          onClick={() => setModalBanner(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-3xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-3xl p-3 shadow-2xl overflow-hidden flex flex-col items-center"
          >
            <div className="w-full flex justify-between items-center pb-2 px-2 border-b border-slate-800 mb-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>🖼️</span> Afiche Oficial de la Reunión
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={modalBanner}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded-lg transition"
                >
                  Abrir original ↗
                </a>
                <button
                  onClick={() => setModalBanner(null)}
                  className="text-slate-400 hover:text-white bg-slate-800 p-1 rounded-lg text-xs"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <img 
              src={modalBanner} 
              alt="Afiche ampliado" 
              className="max-h-[75vh] w-auto object-contain rounded-2xl shadow-lg"
            />
          </div>
        </div>
      )}
    </main>
  );
}
