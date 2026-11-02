import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { verificarDocente, obtenerTareas, registrarTarea, finalizarTarea, eliminarTarea } from '../services/api';

const STORAGE_KEY_DOCENTE = 'sesion_dni_docente';
const STORAGE_KEY_DOCENTE_DATA = 'sesion_data_docente';

const CURSOS_PREDETERMINADOS = [
  'Matemáticas',
  'Comunicación',
  'Ciencia y Tecnología',
  'Ciencias Sociales',
  'Desarrollo Personal (DPCC)',
  'Inglés',
  'Educación Física',
  'Arte y Cultura',
  'Educación Religiosa',
  'Educación para el Trabajo',
  'Tutoría',
  'Otro curso...'
];

const GRADOS_PRIMARIA = [
  '1ro - Primaria',
  '2do - Primaria',
  '3ro - Primaria',
  '4to - Primaria',
  '5to - Primaria',
  '6to - Primaria'
];

const GRADOS_SECUNDARIA = [
  '1ro - Secundaria',
  '2do - Secundaria',
  '3ro - Secundaria',
  '4to - Secundaria',
  '5to - Secundaria'
];

export default function TareasDocentes() {
  const [docente, setDocente] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DOCENTE_DATA);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [dniInput, setDniInput] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_DOCENTE) || '';
    } catch {
      return '';
    }
  });

  const [loadingLogin, setLoadingLogin] = useState(false);
  const [loginError, setLoginError] = useState(null);

  // Estados del Formulario de Tarea
  const [grado, setGrado] = useState('1ro - Primaria');
  const [cursoSelect, setCursoSelect] = useState('Matemáticas');
  const [cursoOtro, setCursoOtro] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fechaEntrega, setFechaEntrega] = useState(() => {
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    const y = manana.getFullYear();
    const m = String(manana.getMonth() + 1).padStart(2, '0');
    const d = String(manana.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });

  const [submitting, setSubmitting] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  // Lista de tareas publicadas
  const [tareas, setTareas] = useState([]);
  const [loadingTareas, setLoadingTareas] = useState(false);

  // Soporte PWA: Instalación independiente
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [instalable, setInstalable] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  // Configurar PWA dinámica para el módulo Docentes
  useEffect(() => {
    document.title = 'Agenda Docente | IEP Millenium';
    
    // Cambiar dinámicamente manifest y apple-touch-icon para que apunte a Tareas
    let manifestLink = document.querySelector("link[rel='manifest']");
    const originalManifest = manifestLink ? manifestLink.getAttribute('href') : '/manifest.json';
    if (manifestLink) {
      manifestLink.setAttribute('href', '/manifest-docentes.json');
    }

    let appleIcon = document.querySelector("link[rel='apple-touch-icon']");
    const originalIcon = appleIcon ? appleIcon.getAttribute('href') : '/app-icon.png';
    if (appleIcon) {
      appleIcon.setAttribute('href', '/tareas.png');
    }

    // Detectar soporte de instalación PWA en Android / Chrome
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setInstalable(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Detectar iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    const isInStandaloneMode = ('standalone' in window.navigator) && window.navigator.standalone;
    if (isIosDevice && !isInStandaloneMode) {
      setIsIOS(true);
    }

    return () => {
      if (manifestLink && originalManifest) manifestLink.setAttribute('href', originalManifest);
      if (appleIcon && originalIcon) appleIcon.setAttribute('href', originalIcon);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);


  // Cargar tareas al tener sesión de docente activa
  const cargarTareas = useCallback(async () => {
    if (!docente) return;
    setLoadingTareas(true);
    try {
      const res = await obtenerTareas('', docente.dni);
      if (res && res.success && Array.isArray(res.tareas)) {
        setTareas(res.tareas);
      }
    } catch (e) {
      console.error('Error cargando tareas:', e);
    } finally {
      setLoadingTareas(false);
    }
  }, [docente]);

  useEffect(() => {
    if (docente) {
      cargarTareas();
    }
  }, [docente, cargarTareas]);

  // Manejar Login de Docente por DNI
  const handleLogin = async (e) => {
    e.preventDefault();
    const dniLimpio = dniInput.replace(/\D/g, '').trim();
    if (dniLimpio.length !== 8) {
      setLoginError('El DNI debe contener 8 dígitos numéricos.');
      return;
    }

    setLoadingLogin(true);
    setLoginError(null);

    try {
      const res = await verificarDocente(dniLimpio);
      if (res && res.success && res.docente) {
        setDocente(res.docente);
        localStorage.setItem(STORAGE_KEY_DOCENTE, dniLimpio);
        localStorage.setItem(STORAGE_KEY_DOCENTE_DATA, JSON.stringify(res.docente));
      } else {
        setLoginError(res.message || 'No se encontró el DNI en el padrón de docentes.');
      }
    } catch (err) {
      setLoginError('Error de conexión al verificar docente. Intente nuevamente.');
    } finally {
      setLoadingLogin(false);
    }
  };

  const handleCerrarSesion = () => {
    setDocente(null);
    setDniInput('');
    localStorage.removeItem(STORAGE_KEY_DOCENTE);
    localStorage.removeItem(STORAGE_KEY_DOCENTE_DATA);
  };

  // Publicar Tarea
  const handleSubmitTarea = async (e) => {
    e.preventDefault();
    if (!docente) return;

    const cursoFinal = cursoSelect === 'Otro curso...' ? cursoOtro.trim() : cursoSelect;
    if (!grado || !cursoFinal || !descripcion.trim()) {
      setMensaje({ tipo: 'error', texto: 'Por favor complete el grado, materia y descripción de la tarea.' });
      return;
    }

    // Formatear fecha entrega a dd/MM/yyyy
    let fEntregaFormateada = '';
    if (fechaEntrega) {
      const [y, m, d] = fechaEntrega.split('-');
      fEntregaFormateada = `${d}/${m}/${y}`;
    }

    setSubmitting(true);
    setMensaje(null);

    try {
      const res = await registrarTarea({
        dniDocente: docente.dni,
        nombreDocente: docente.nombre,
        grado: grado,
        curso: cursoFinal,
        descripcion: descripcion.trim(),
        fechaEntrega: fEntregaFormateada
      });

      if (res && res.success) {
        setMensaje({ tipo: 'success', texto: `✅ Tarea de ${cursoFinal} publicada para ${grado}.` });
        setDescripcion('');
        if (cursoSelect === 'Otro curso...') setCursoOtro('');
        await cargarTareas();
      } else {
        setMensaje({ tipo: 'error', texto: res.message || 'No se pudo publicar la tarea.' });
      }
    } catch (err) {
      setMensaje({ tipo: 'error', texto: 'Error al enviar tarea: ' + err.message });
    } finally {
      setSubmitting(false);
    }
  };

  // Marcar como Finalizada
  const handleFinalizar = async (idTarea) => {
    if (!window.confirm('¿Deseas marcar esta tarea como finalizada / concluida?')) return;
    try {
      await finalizarTarea(idTarea, docente.dni);
      cargarTareas();
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  // Eliminar Tarea
  const handleEliminar = async (idTarea) => {
    if (!window.confirm('¿Estás seguro de eliminar esta tarea?')) return;
    try {
      await eliminarTarea(idTarea, docente.dni);
      cargarTareas();
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  // Disparar instalación PWA
  const handleInstalarApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setInstalable(false);
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowIosGuide(true);
    }
  };

  // ==========================================
  // PANTALLA 1: LOGIN CON DNI DEL DOCENTE
  // ==========================================
  if (!docente) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-[#0b132b] px-4 py-12 flex flex-col items-center justify-center font-sans">
        
        {/* Banner de Instalación Rápida */}
        {(instalable || isIOS) && (
          <div className="mb-6 w-full max-w-md bg-gradient-to-r from-blue-600/30 via-indigo-600/20 to-slate-900 border border-blue-500/40 rounded-2xl p-3.5 flex items-center justify-between shadow-xl">
            <div className="flex items-center gap-3">
              <img src="/tareas.png" alt="Icono Tareas" className="w-10 h-10 rounded-xl shadow border border-white/20 object-cover" />
              <div>
                <p className="text-xs font-bold text-white">Instalar App de Docentes</p>
                <p className="text-[11px] text-slate-300">Accede directamente desde tu pantalla</p>
              </div>
            </div>
            <button
              onClick={handleInstalarApp}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow transition"
            >
              📲 Instalar
            </button>
          </div>
        )}

        <div className="w-full max-w-md rounded-3xl border border-blue-900/40 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-md">
          <div className="text-center">
            <img 
              src="/tareas.png" 
              alt="Icono Tareas Docente" 
              className="mx-auto h-20 w-20 rounded-2xl shadow-xl border-2 border-blue-500/30 object-cover"
            />
            <span className="mt-4 inline-block rounded-full bg-blue-600/20 border border-blue-500/40 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-300">
              Módulo de Docentes
            </span>
            <h1 className="mt-2 text-2xl font-black text-white">Agenda y Tareas Escolares</h1>
            <p className="mt-1 text-xs text-slate-400">IEP MILLENIUM — Control Académico</p>
          </div>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 ml-1">
                Ingresa tu DNI de Docente (8 dígitos)
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ej. 42360611"
                  maxLength={8}
                  value={dniInput}
                  onChange={(e) => setDniInput(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  disabled={loadingLogin}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white font-mono text-base placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  autoFocus
                />
                {dniInput && (
                  <button
                    type="button"
                    onClick={() => setDniInput('')}
                    className="absolute right-3 top-3 text-slate-500 hover:text-white"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {loginError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/15 p-3 text-xs text-red-200">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={loadingLogin || dniInput.length !== 8}
              className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3.5 font-bold text-white shadow-lg shadow-blue-900/30 hover:from-blue-500 hover:to-indigo-500 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loadingLogin ? (
                <>
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Verificando credenciales...
                </>
              ) : (
                <>
                  <span>🔐</span>
                  <span>Ingresar al Sistema</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-slate-800 pt-4 text-center">
            <p className="text-[11px] text-slate-500">
              💡 Tu DNI queda grabado en este teléfono para que no tengas que escribirlo cada vez.
            </p>
          </div>
        </div>

        {/* Guía modal para usuarios de iOS Safari */}
        {showIosGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-3xl border border-slate-700 bg-slate-900 p-6 text-center text-white shadow-2xl">
              <img src="/tareas.png" alt="Tareas" className="w-16 h-16 rounded-2xl mx-auto mb-3 shadow" />
              <h3 className="font-bold text-lg">Instalar en tu iPhone / iPad</h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                1. Toca el botón <strong>Compartir</strong> (ícono con flecha 📤 en la barra inferior de Safari).<br />
                2. Desliza hacia abajo y selecciona <strong>"Agregar a pantalla de inicio" ➕</strong>.<br />
                3. ¡Listo! Tendrás la app de Tareas en tu pantalla con su icono oficial.
              </p>
              <button
                onClick={() => setShowIosGuide(false)}
                className="mt-5 w-full rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-500"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </main>
    );
  }

  // ==========================================
  // PANTALLA 2: PANEL DE GESTIÓN DE TAREAS
  // ==========================================
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 font-sans text-slate-100">
      <div className="mx-auto max-w-4xl">
        
        {/* Barra superior del Docente */}
        <div className="rounded-3xl border border-blue-900/40 bg-gradient-to-r from-slate-900 via-slate-900 to-blue-950/40 p-5 shadow-2xl mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <img 
              src="/tareas.png" 
              alt="Tareas" 
              className="w-14 h-14 rounded-2xl shadow-lg border border-blue-500/30 object-cover"
            />
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400">Docente Autenticado</span>
              <h1 className="text-xl font-black text-white">{docente.nombre}</h1>
              <p className="text-xs text-slate-400 font-mono">DNI: {docente.dni} {docente.nivel && `· ${docente.nivel}`}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {(instalable || isIOS) && (
              <button
                onClick={handleInstalarApp}
                className="rounded-xl border border-blue-500/40 bg-blue-600/20 px-3 py-2 text-xs font-semibold text-blue-300 hover:bg-blue-600/30 transition flex items-center gap-1.5"
                title="Instalar como app en tu teléfono"
              >
                <span>📲</span>
                <span className="hidden sm:inline">Instalar App</span>
              </button>
            )}
            <button
              onClick={handleCerrarSesion}
              className="rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition"
            >
              Cerrar Sesión
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
          
          {/* Formulario de Publicación de Tarea (Columna Izquierda / Superior) */}
          <section className="lg:col-span-5 rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl backdrop-blur-md h-fit">
            <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
              <span className="text-xl">✍️</span>
              <h2 className="text-lg font-bold text-white">Publicar Nueva Tarea</h2>
            </div>

            <form onSubmit={handleSubmitTarea} className="space-y-4">
              
              {/* Selector de Grado */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1 ml-1">Grado / Nivel</label>
                <select
                  value={grado}
                  onChange={(e) => setGrado(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white focus:border-blue-500 outline-none font-medium"
                >
                  <optgroup label="── ☀️ NIVEL PRIMARIA ──">
                    {GRADOS_PRIMARIA.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </optgroup>
                  <optgroup label="── 🌅 NIVEL SECUNDARIA ──">
                    {GRADOS_SECUNDARIA.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* Selector de Curso */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1 ml-1">Curso / Asignatura</label>
                <select
                  value={cursoSelect}
                  onChange={(e) => setCursoSelect(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white focus:border-blue-500 outline-none"
                >
                  {CURSOS_PREDETERMINADOS.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                {cursoSelect === 'Otro curso...' && (
                  <input
                    type="text"
                    placeholder="Escribe el nombre del curso"
                    value={cursoOtro}
                    onChange={(e) => setCursoOtro(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 outline-none"
                    autoFocus
                  />
                )}
              </div>

              {/* Fecha de Entrega */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1 ml-1">Fecha de Entrega / Presentación</label>
                <input
                  type="date"
                  value={fechaEntrega}
                  onChange={(e) => setFechaEntrega(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                />
              </div>

              {/* Descripción de la Tarea en Solo Texto */}
              <div>
                <div className="flex justify-between items-center mb-1 ml-1">
                  <label className="text-xs font-semibold text-slate-400">Indicaciones de la Tarea</label>
                  <span className="text-[11px] text-slate-500">{descripcion.length} caracteres</span>
                </div>
                <textarea
                  rows={4}
                  placeholder="Ej: Resolver los ejercicios 1 al 8 de la página 45 del cuaderno de trabajo. Traer en el cuaderno el viernes."
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white placeholder-slate-500 focus:border-blue-500 outline-none resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || !descripcion.trim()}
                className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 font-bold text-white shadow-lg hover:from-blue-500 hover:to-indigo-500 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Publicando tarea...
                  </>
                ) : (
                  <>
                    <span>📢</span>
                    <span>Publicar Tarea para los Alumnos</span>
                  </>
                )}
              </button>
            </form>
          </section>

          {/* Listado de Tareas Publicadas (Columna Derecha) */}
          <section className="lg:col-span-7 rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl backdrop-blur-md flex flex-col">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">📚</span>
                <h2 className="text-lg font-bold text-white">Tareas Registradas</h2>
                <span className="rounded-full bg-blue-600/30 border border-blue-500/40 px-2 py-0.5 text-xs font-bold text-blue-300">
                  {tareas.length}
                </span>
              </div>
              <button
                onClick={cargarTareas}
                disabled={loadingTareas}
                className="text-xs text-blue-400 hover:text-blue-300 font-semibold"
              >
                {loadingTareas ? 'Cargando...' : '🔄 Actualizar'}
              </button>
            </div>

            {loadingTareas && (
              <div className="py-12 text-center text-slate-400 text-sm animate-pulse">
                Consultando tareas publicadas...
              </div>
            )}

            {!loadingTareas && tareas.length === 0 && (
              <div className="py-16 text-center text-slate-500">
                <div className="text-4xl mb-2">📝</div>
                <p className="font-bold text-white text-base">No hay tareas publicadas aún</p>
                <p className="text-xs text-slate-400 mt-1">Usa el formulario para publicar la primera tarea para tus alumnos.</p>
              </div>
            )}

            {!loadingTareas && tareas.length > 0 && (
              <div className="space-y-3.5 overflow-y-auto max-h-[550px] pr-1 custom-scrollbar">
                {tareas.map((t) => {
                  const esActiva = t.estado === 'Activa';
                  return (
                    <div
                      key={t.id}
                      className={`rounded-2xl border p-4 transition-all ${
                        esActiva 
                          ? 'border-slate-700/80 bg-slate-900/80 hover:border-slate-600 shadow-md' 
                          : 'border-slate-800/50 bg-slate-950/40 opacity-70'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="rounded-lg bg-blue-600/20 border border-blue-500/40 px-2.5 py-0.5 text-xs font-bold text-blue-300">
                            {t.curso}
                          </span>
                          <span className="rounded-lg bg-slate-800 border border-slate-700 px-2 py-0.5 text-xs text-slate-300 font-semibold">
                            🏫 {t.grado}
                          </span>
                        </div>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold border ${
                          esActiva 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                            : 'bg-slate-700/30 text-slate-400 border-slate-600/30'
                        }`}>
                          {esActiva ? '🟢 Vigente' : '✓ Finalizada'}
                        </span>
                      </div>

                      <p className="text-sm text-slate-200 whitespace-pre-line leading-relaxed my-2 font-normal bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                        {t.descripcion}
                      </p>

                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mt-3 pt-2 border-t border-slate-800/60 text-xs text-slate-400">
                        <div className="flex items-center gap-3">
                          <span className="text-amber-300 font-semibold">
                            ⏰ Entrega: <strong>{t.fechaEntrega}</strong>
                          </span>
                          <span>•</span>
                          <span>Publicado: {t.fechaRegistro}</span>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          {esActiva && (
                            <button
                              onClick={() => handleFinalizar(t.id)}
                              className="text-xs bg-emerald-600/15 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-lg hover:bg-emerald-600/25 transition"
                              title="Marcar como concluida"
                            >
                              ✓ Finalizar
                            </button>
                          )}
                          <button
                            onClick={() => handleEliminar(t.id)}
                            className="text-xs bg-red-600/15 text-red-400 border border-red-500/30 px-2.5 py-1 rounded-lg hover:bg-red-600/25 transition"
                            title="Eliminar tarea"
                          >
                            🗑️
                          </button>
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
    </main>
  );
}
