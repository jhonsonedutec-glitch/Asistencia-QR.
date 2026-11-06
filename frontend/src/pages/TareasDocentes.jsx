import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  verificarDocente, 
  obtenerTareas, 
  registrarTarea, 
  finalizarTarea, 
  eliminarTarea,
  calcularEstadoTarea 
} from '../services/api';

const STORAGE_KEY_DOCENTE = 'sesion_dni_docente';
const STORAGE_KEY_DOCENTE_DATA = 'sesion_data_docente';

const CATEGORIAS_CURSOS = [
  {
    categoria: '📐 MATEMÁTICAS Y RAZONAMIENTO',
    cursos: [
      'Álgebra',
      'Aritmética',
      'Geometría',
      'Trigonometría',
      'Razonamiento Matemático',
      'Nivelación Matemática',
      'Matemática'
    ]
  },
  {
    categoria: '🔬 CIENCIAS NATURALES Y SALUD',
    cursos: [
      'Anatomía',
      'Biología',
      'Física',
      'Química',
      'Ciencia y Tecnología'
    ]
  },
  {
    categoria: '📖 COMUNICACIÓN Y LETRAS',
    cursos: [
      'Comunicación',
      'Comprensión Lectora',
      'Literatura',
      'Razonamiento Verbal',
      'Inglés'
    ]
  },
  {
    categoria: '🌍 CIENCIAS SOCIALES Y HUMANIDADES',
    cursos: [
      'Ciencias Sociales',
      'Historia',
      'Geopolítica',
      'Economía',
      'Educación Cívica',
      'Personal Social'
    ]
  },
  {
    categoria: '🎨 DESARROLLO Y FORMACIÓN INTEGRAL',
    cursos: [
      'Arte y Cultura',
      'Desarrollo Personal (DPCC)',
      'Educación Física',
      'Educación Religiosa',
      'Tutoría'
    ]
  }
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

const getFechaHoyISO = () => {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = String(hoy.getMonth() + 1).padStart(2, '0');
  const d = String(hoy.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getFechaMananaISO = () => {
  const m = new Date();
  m.setDate(m.getDate() + 1);
  const y = m.getFullYear();
  const mes = String(m.getMonth() + 1).padStart(2, '0');
  const d = String(m.getDate()).padStart(2, '0');
  return `${y}-${mes}-${d}`;
};

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
  const [cursoSelect, setCursoSelect] = useState('Álgebra');
  const [cursoOtro, setCursoOtro] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fechaInicio, setFechaInicio] = useState(getFechaHoyISO);
  const [fechaEntrega, setFechaEntrega] = useState(getFechaMananaISO);
  
  // Archivo PDF adjunto
  const [archivoPdf, setArchivoPdf] = useState(null);
  const fileInputRef = useRef(null);

  const [submitting, setSubmitting] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  // Lista de tareas publicadas
  const [tareas, setTareas] = useState([]);
  const [loadingTareas, setLoadingTareas] = useState(false);

  // Filtros del historial de tareas
  const [filtroEstado, setFiltroEstado] = useState('TODAS');
  const [busqueda, setBusqueda] = useState('');

  // Soporte PWA
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [instalable, setInstalable] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  // Configurar PWA dinámica para el módulo Docentes
  useEffect(() => {
    document.title = 'Agenda Docente | IEP Millenium';
    
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

    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setInstalable(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

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

  // Manejo de carga de PDF
  const handleArchivoChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setMensaje({ tipo: 'error', texto: 'Solo se permiten archivos en formato PDF (.pdf).' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Límite de 10 MB
    if (file.size > 10 * 1024 * 1024) {
      setMensaje({ tipo: 'error', texto: 'El archivo PDF supera el tamaño máximo permitido de 10 MB.' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setArchivoPdf({
        nombre: file.name,
        tamano: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
        base64: reader.result
      });
      setMensaje(null);
    };
    reader.onerror = () => {
      setMensaje({ tipo: 'error', texto: 'Error al leer el archivo PDF seleccionado.' });
    };
    reader.readAsDataURL(file);
  };

  const handleQuitarArchivo = () => {
    setArchivoPdf(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Publicar Tarea
  const handleSubmitTarea = async (e) => {
    e.preventDefault();
    if (!docente) return;

    const esOtro = cursoSelect === 'OTRO' || cursoSelect === 'Otro curso...';
    const cursoFinal = esOtro ? cursoOtro.trim() : cursoSelect;

    if (esOtro && !cursoOtro.trim()) {
      setMensaje({ tipo: 'error', texto: 'Por favor escribe el nombre del curso personalizado.' });
      return;
    }

    if (!grado || !cursoFinal || !descripcion.trim()) {
      setMensaje({ tipo: 'error', texto: 'Por favor complete el grado, materia y descripción de la tarea.' });
      return;
    }

    // Formatear fechas a dd/MM/yyyy
    let fInicioFormateada = '';
    if (fechaInicio) {
      const [y, m, d] = fechaInicio.split('-');
      fInicioFormateada = `${d}/${m}/${y}`;
    }

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
        fechaInicio: fInicioFormateada,
        fechaEntrega: fEntregaFormateada,
        archivo: archivoPdf ? {
          base64: archivoPdf.base64,
          nombre: archivoPdf.nombre,
          tipo: 'application/pdf'
        } : null
      });

      if (res && res.success) {
        const tieneAdjunto = Boolean(res.tarea?.urlAdjunto);
        setMensaje({ 
          tipo: 'success', 
          texto: `✅ Tarea de ${cursoFinal} publicada para ${grado}${tieneAdjunto ? ' con PDF adjunto.' : '.'}` 
        });
        setDescripcion('');
        handleQuitarArchivo();
        if (esOtro) setCursoOtro('');
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
    if (!window.confirm('¿Deseas marcar esta tarea como concluida / finalizada?')) return;
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

  // Procesar tareas con estados calculados
  const tareasConEstado = useMemo(() => {
    return tareas.map(t => ({
      ...t,
      infoEstado: t.infoEstado || calcularEstadoTarea(t)
    }));
  }, [tareas]);

  // Contadores por categoría de estado
  const contadores = useMemo(() => {
    const c = { TODAS: tareasConEstado.length, PROGRAMADA: 0, VIGENTE: 0, POR_VENCER: 0, VENCIDA: 0, FINALIZADA: 0 };
    tareasConEstado.forEach(t => {
      const cod = t.infoEstado?.codigo;
      if (cod && c[cod] !== undefined) c[cod]++;
    });
    return c;
  }, [tareasConEstado]);

  // Filtrado reactivo de tareas
  const tareasFiltradas = useMemo(() => {
    return tareasConEstado.filter(t => {
      if (filtroEstado !== 'TODAS' && t.infoEstado?.codigo !== filtroEstado) {
        return false;
      }
      if (busqueda.trim()) {
        const q = busqueda.toLowerCase();
        const enCurso = (t.curso || '').toLowerCase().includes(q);
        const enGrado = (t.grado || '').toLowerCase().includes(q);
        const enDesc = (t.descripcion || '').toLowerCase().includes(q);
        const enNombreAdj = (t.nombreAdjunto || '').toLowerCase().includes(q);
        return enCurso || enGrado || enDesc || enNombreAdj;
      }
      return true;
    });
  }, [tareasConEstado, filtroEstado, busqueda]);

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
      <div className="mx-auto max-w-6xl">
        
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
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white focus:border-blue-500 outline-none font-medium"
                >
                  {CATEGORIAS_CURSOS.map((cat) => (
                    <optgroup key={cat.categoria} label={`── ${cat.categoria} ──`}>
                      {cat.cursos.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </optgroup>
                  ))}
                  <optgroup label="── ✏️ PERSONALIZADO ──">
                    <option value="OTRO">Otro (especificar manualmente)...</option>
                  </optgroup>
                </select>

                {(cursoSelect === 'OTRO' || cursoSelect === 'Otro curso...') && (
                  <div className="mt-2.5">
                    <label className="block text-[11px] font-semibold text-blue-400 mb-1 ml-1">
                      ✏️ Especifica el nombre del curso:
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Robótica, Computación, Taller de Oratoria..."
                      value={cursoOtro}
                      onChange={(e) => setCursoOtro(e.target.value)}
                      className="w-full rounded-xl border border-blue-500/50 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none"
                      autoFocus
                    />
                  </div>
                )}
              </div>

              {/* Fechas de Programación y Entrega en 2 columnas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1 ml-1">
                    📅 Fecha de Inicio / Programación
                  </label>
                  <input
                    type="date"
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                  />
                  <p className="text-[10px] text-slate-500 mt-1 ml-1">
                    {fechaInicio > getFechaHoyISO() ? '🕒 Actividad que iniciará a futuro' : 'Asignada desde hoy'}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1 ml-1">
                    ⏰ Fecha de Entrega Límite
                  </label>
                  <input
                    type="date"
                    value={fechaEntrega}
                    min={fechaInicio || undefined}
                    onChange={(e) => setFechaEntrega(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                  />
                  <p className="text-[10px] text-slate-500 mt-1 ml-1">
                    Plazo de presentación
                  </p>
                </div>
              </div>

              {/* Adjuntar Ficha / Documento PDF */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1 ml-1">
                  📎 Adjuntar Documento o Ficha en PDF (Opcional)
                </label>
                
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  ref={fileInputRef}
                  onChange={handleArchivoChange}
                  className="hidden"
                  id="input-pdf-docente"
                />

                {!archivoPdf ? (
                  <label
                    htmlFor="input-pdf-docente"
                    className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 hover:border-blue-500 bg-slate-950/50 hover:bg-blue-950/20 rounded-2xl p-3.5 cursor-pointer transition text-center group"
                  >
                    <span className="text-2xl mb-1 group-hover:scale-110 transition">📄</span>
                    <span className="text-xs font-semibold text-slate-300 group-hover:text-blue-300">
                      Toca para adjuntar archivo PDF
                    </span>
                    <span className="text-[10px] text-slate-500 mt-0.5">
                      Fichas de trabajo, lecturas, separatas (Máx. 10 MB)
                    </span>
                  </label>
                ) : (
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-blue-950/40 border border-blue-500/40 shadow-inner">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <span className="text-2xl">📄</span>
                      <div className="truncate text-left">
                        <p className="text-xs font-bold text-blue-200 truncate">{archivoPdf.nombre}</p>
                        <p className="text-[10px] text-blue-400">{archivoPdf.tamano} • Listo para subir a Drive</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleQuitarArchivo}
                      className="ml-2 text-slate-400 hover:text-rose-400 bg-slate-900/80 hover:bg-rose-950/40 p-1.5 rounded-lg border border-slate-700 hover:border-rose-500/40 transition"
                      title="Quitar archivo"
                    >
                      ✕
                    </button>
                  </div>
                )}
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
                disabled={
                  submitting || 
                  !descripcion.trim() || 
                  ((cursoSelect === 'OTRO' || cursoSelect === 'Otro curso...') && !cursoOtro.trim())
                }
                className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 font-bold text-white shadow-lg hover:from-blue-500 hover:to-indigo-500 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    {archivoPdf ? 'Subiendo PDF y publicando tarea...' : 'Publicando tarea...'}
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">📚</span>
                <h2 className="text-lg font-bold text-white">Tareas Registradas</h2>
                <span className="rounded-full bg-blue-600/30 border border-blue-500/40 px-2 py-0.5 text-xs font-bold text-blue-300">
                  {tareas.length}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={cargarTareas}
                  disabled={loadingTareas}
                  className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800"
                >
                  <span>🔄</span>
                  <span>{loadingTareas ? 'Cargando...' : 'Actualizar'}</span>
                </button>
              </div>
            </div>

            {/* Pestañas de Filtros por Estado */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-3 text-xs [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {[
                { id: 'TODAS', label: 'Todas', cant: contadores.TODAS },
                { id: 'PROGRAMADA', label: '🕒 Programadas', cant: contadores.PROGRAMADA },
                { id: 'VIGENTE', label: '🟢 Vigentes', cant: contadores.VIGENTE },
                { id: 'POR_VENCER', label: '⚠️ Por Vencer', cant: contadores.POR_VENCER },
                { id: 'VENCIDA', label: '⌛ Vencidas', cant: contadores.VENCIDA },
                { id: 'FINALIZADA', label: '✓ Concluidas', cant: contadores.FINALIZADA }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setFiltroEstado(tab.id)}
                  className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition-all flex items-center gap-1.5 border ${
                    filtroEstado === tab.id
                      ? 'bg-blue-600 border-blue-500 text-white shadow-md'
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
            <div className="mb-3.5">
              <input
                type="text"
                placeholder="🔍 Filtrar por curso, grado, tema o archivo PDF..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-blue-500 outline-none"
              />
            </div>

            {loadingTareas && (
              <div className="py-12 text-center text-slate-400 text-sm animate-pulse">
                Consultando tareas publicadas...
              </div>
            )}

            {!loadingTareas && tareasFiltradas.length === 0 && (
              <div className="py-16 text-center text-slate-500">
                <div className="text-4xl mb-2">📝</div>
                <p className="font-bold text-white text-base">
                  {busqueda || filtroEstado !== 'TODAS' ? 'No hay tareas con ese filtro' : 'No hay tareas publicadas aún'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {busqueda || filtroEstado !== 'TODAS'
                    ? 'Intenta cambiar de pestaña o borrar el término de búsqueda.' 
                    : 'Usa el formulario para publicar la primera tarea para tus alumnos.'}
                </p>
              </div>
            )}

            {!loadingTareas && tareasFiltradas.length > 0 && (
              <div className="space-y-3.5 overflow-y-auto max-h-[550px] pr-1 custom-scrollbar">
                {tareasFiltradas.map((t) => {
                  const estadoInfo = t.infoEstado || calcularEstadoTarea(t);
                  const esFinalizada = t.estado === 'Finalizada';

                  return (
                    <div
                      key={t.id}
                      className={`rounded-2xl border p-4 transition-all ${
                        !esFinalizada 
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

                        {/* Badge de Estado Dinámico */}
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold border flex items-center gap-1 ${estadoInfo.badgeClass}`}>
                          <span>{estadoInfo.icono}</span>
                          <span>{estadoInfo.label}</span>
                        </span>
                      </div>

                      <p className="text-sm text-slate-200 whitespace-pre-line leading-relaxed my-2 font-normal bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                        {t.descripcion}
                      </p>

                      {/* Botón de Enlace al Documento PDF Adjunto si existe */}
                      {t.urlAdjunto && (
                        <div className="mb-2.5 pt-1">
                          <a
                            href={t.urlAdjunto}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-900/40 to-indigo-900/40 hover:from-blue-800/50 hover:to-indigo-800/50 border border-blue-500/40 px-3 py-1.5 text-xs font-semibold text-blue-200 shadow transition group"
                          >
                            <span className="text-base group-hover:scale-110 transition">📄</span>
                            <span className="truncate max-w-[220px]">
                              {t.nombreAdjunto || 'Ver Documento PDF'}
                            </span>
                            <span className="text-[10px] text-blue-400 group-hover:translate-x-0.5 transition">↗ Abrir</span>
                          </a>
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mt-3 pt-2 border-t border-slate-800/60 text-xs text-slate-400">
                        <div className="flex items-center gap-2 flex-wrap">
                          {t.fechaInicio && (
                            <span className="text-slate-300 font-medium bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                              📅 Inicio: {t.fechaInicio}
                            </span>
                          )}
                          <span className="text-amber-300 font-semibold bg-amber-950/30 px-2 py-0.5 rounded border border-amber-800/40">
                            ⏰ Entrega: <strong>{t.fechaEntrega}</strong>
                          </span>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          {!esFinalizada && (
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
