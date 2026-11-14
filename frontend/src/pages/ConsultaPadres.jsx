import React, { useState, useEffect, useMemo } from 'react';
import { 
  obtenerHistorialPadre, 
  obtenerTareas, 
  obtenerComunicados, 
  obtenerProductosCafeteria, 
  obtenerHistorialEstudianteCafeteria, 
  reportarRecargaYape, 
  registrarPedidoPadre, 
  CATEGORIAS_CAFETERIA,
  getFechaHoyLocal, 
  normalizarFecha, 
  calcularEstadoTarea 
} from '../services/api';

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

  // Estados de Cafetería y Lonchera
  const [cafeteriaHistorial, setCafeteriaHistorial] = useState(null);
  const [loadingCafeteria, setLoadingCafeteria] = useState(false);
  const [menuHoy, setMenuHoy] = useState([]);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [categoriaMenuPadre, setCategoriaMenuPadre] = useState('TODAS');
  const [carritoPadre, setCarritoPadre] = useState([]);
  const [turnoPedido, setTurnoPedido] = useState('RECREO'); // RECREO | ALMUERZO
  const [notaPedido, setNotaPedido] = useState('');
  const [enviandoPedido, setEnviandoPedido] = useState(false);
  const [modalRecargaYape, setModalRecargaYape] = useState(false);
  const [montoYape, setMontoYape] = useState('');
  const [codigoOpYape, setCodigoOpYape] = useState('');
  const [celularYape, setCelularYape] = useState('');
  const [comprobanteYapeFile, setComprobanteYapeFile] = useState(null);
  const [enviandoRecarga, setEnviandoRecarga] = useState(false);
  const [toastCafeteria, setToastCafeteria] = useState(null);
  const [subTabMovimientos, setSubTabMovimientos] = useState('consumos'); // consumos | recargas | pedidos

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

          // Cargar datos de Cafetería (billetera, saldo, consumos y recargas)
          setLoadingCafeteria(true);
          obtenerHistorialEstudianteCafeteria(dniAConsultar).then(cafRes => {
            if (cafRes && cafRes.success) {
              setCafeteriaHistorial(cafRes);
            }
          }).finally(() => {
            setLoadingCafeteria(false);
          });

          // Cargar menú del día disponible
          setLoadingMenu(true);
          obtenerProductosCafeteria(true).then(pRes => {
            if (pRes && pRes.success && Array.isArray(pRes.productos)) {
              const norm = pRes.productos.map(p => ({
                ...p,
                idProducto: p.idProducto || p.id,
                id: p.id || p.idProducto,
                imagenUrl: p.imagenUrl || p.fotoUrl || '',
                fotoUrl: p.fotoUrl || p.imagenUrl || ''
              }));
              setMenuHoy(norm);
            }
          }).finally(() => {
            setLoadingMenu(false);
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
    setCafeteriaHistorial(null);
    setCarritoPadre([]);
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

  const showCafeteriaToast = (mensaje, tipo = 'success') => {
    setToastCafeteria({ mensaje, tipo });
    setTimeout(() => setToastCafeteria(null), 4500);
  };

  const recargarDatosCafeteria = async (dniConsultar) => {
    if (!dniConsultar) return;
    const res = await obtenerHistorialEstudianteCafeteria(dniConsultar);
    if (res && res.success) {
      setCafeteriaHistorial(res);
    }
  };

  // Carrito de compras del padre
  const agregarAlCarritoPadre = (prod) => {
    setCarritoPadre(prev => {
      const idx = prev.findIndex(item => item.idProducto === prod.idProducto);
      if (idx !== -1) {
        const clon = [...prev];
        clon[idx].cantidad += 1;
        clon[idx].subtotal = Number((clon[idx].cantidad * clon[idx].precio).toFixed(2));
        return clon;
      } else {
        return [...prev, {
          idProducto: prod.idProducto,
          nombre: prod.nombre,
          precio: Number(prod.precio || 0),
          cantidad: 1,
          subtotal: Number(prod.precio || 0)
        }];
      }
    });
    showCafeteriaToast(`Agregado al pedido: ${prod.nombre}`);
  };

  const modificarCantidadCarritoPadre = (idProducto, delta) => {
    setCarritoPadre(prev => {
      return prev.map(item => {
        if (item.idProducto === idProducto) {
          const nuevaCant = item.cantidad + delta;
          if (nuevaCant <= 0) return null;
          return {
            ...item,
            cantidad: nuevaCant,
            subtotal: Number((nuevaCant * item.precio).toFixed(2))
          };
        }
        return item;
      }).filter(Boolean);
    });
  };

  const totalCarritoPadre = useMemo(() => {
    return Number(carritoPadre.reduce((acc, it) => acc + (it.subtotal || 0), 0).toFixed(2));
  }, [carritoPadre]);

  // Enviar pedido anticipado del padre
  const handleConfirmarPedidoPadre = async () => {
    if (!data || !data.estudiante) return;
    if (carritoPadre.length === 0) {
      showCafeteriaToast('El pedido está vacío. Elige productos del menú.', 'error');
      return;
    }

    const saldoActual = Number(cafeteriaHistorial?.saldo?.saldoActual || 0);
    if (saldoActual < totalCarritoPadre) {
      showCafeteriaToast(`Saldo insuficiente. Tu saldo es S/ ${saldoActual.toFixed(2)} y el pedido suma S/ ${totalCarritoPadre.toFixed(2)}. Por favor recarga por Yape.`, 'error');
      return;
    }

    if (!confirm(`¿Confirmas el pedido de S/ ${totalCarritoPadre.toFixed(2)} para el ${turnoPedido} de tu hijo/a? El monto se descontará de su billetera escolar.`)) {
      return;
    }

    setEnviandoPedido(true);
    try {
      const hoyISO = getFechaHoyLocal();
      const res = await registrarPedidoPadre({
        dni: data.estudiante.dni,
        nombres: data.estudiante.nombre,
        grado: data.estudiante.grado,
        fechaEntrega: hoyISO,
        turnoEntrega: turnoPedido,
        items: carritoPadre,
        total: totalCarritoPadre,
        notaPadre: notaPedido.trim()
      });

      if (res && res.success) {
        showCafeteriaToast('¡Pedido recibido por la cafetería! La cocina lo preparará para la hora indicada.');
        setCarritoPadre([]);
        setNotaPedido('');
        recargarDatosCafeteria(data.estudiante.dni);
      } else {
        showCafeteriaToast(res.message || 'No se pudo enviar el pedido.', 'error');
      }
    } catch (err) {
      showCafeteriaToast('Error al enviar pedido: ' + err.message, 'error');
    } finally {
      setEnviandoPedido(false);
    }
  };

  // Reportar Recarga Yape desde el portal
  const handleEnviarRecargaYapeSubmit = async (e) => {
    e.preventDefault();
    if (!data || !data.estudiante) return;

    const montoNum = parseFloat(montoYape);
    if (isNaN(montoNum) || montoNum <= 0) {
      showCafeteriaToast('Ingresa un monto válido mayor a 0', 'error');
      return;
    }

    if (!codigoOpYape.trim()) {
      showCafeteriaToast('El código de operación de Yape es necesario para validar tu pago.', 'error');
      return;
    }

    setEnviandoRecarga(true);
    try {
      let comprobanteBase64 = '';
      let comprobanteNombre = '';
      let comprobanteMime = '';

      if (comprobanteYapeFile) {
        if (comprobanteYapeFile.size > 4 * 1024 * 1024) {
          showCafeteriaToast('El comprobante no debe superar los 4MB.', 'error');
          setEnviandoRecarga(false);
          return;
        }

        const base64Data = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.split(',')[1]);
          reader.readAsDataURL(comprobanteYapeFile);
        });
        comprobanteBase64 = base64Data;
        comprobanteNombre = comprobanteYapeFile.name;
        comprobanteMime = comprobanteYapeFile.type;
      }

      const res = await reportarRecargaYape({
        dni: data.estudiante.dni,
        nombres: data.estudiante.nombre,
        grado: data.estudiante.grado,
        monto: montoNum,
        codigoOperacion: codigoOpYape.trim(),
        telefonoOrigen: celularYape.trim(),
        comprobanteBase64,
        comprobanteNombre,
        comprobanteMime,
        registradoPor: 'Padre de Familia (Portal)'
      });

      if (res && res.success) {
        showCafeteriaToast('¡Comprobante enviado con éxito! La cafetería revisará el abono y actualizará el saldo de tu hijo/a.');
        setModalRecargaYape(false);
        setMontoYape('');
        setCodigoOpYape('');
        setCelularYape('');
        setComprobanteYapeFile(null);
        recargarDatosCafeteria(data.estudiante.dni);
      } else {
        showCafeteriaToast(res.message || 'No se pudo reportar la recarga.', 'error');
      }
    } catch (err) {
      showCafeteriaToast('Error al enviar comprobante: ' + err.message, 'error');
    } finally {
      setEnviandoRecarga(false);
    }
  };

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

            {/* Pestañas de Navegación: Asistencia, Tareas, Comunicados, Cafetería */}
            <div className="flex border-b border-gray-200 bg-gray-50/90 px-2 sm:px-6 pt-2.5 gap-1 sm:gap-2 overflow-x-auto no-scrollbar scroll-smooth">
              <button
                type="button"
                onClick={() => setPestanaActiva('asistencia')}
                className={`pb-2.5 sm:pb-3 px-2.5 sm:px-4 font-bold text-xs sm:text-sm flex items-center gap-1.5 border-b-2 transition-all whitespace-nowrap shrink-0 ${
                  pestanaActiva === 'asistencia'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <span>📅</span>
                <span>Asistencia<span className="hidden sm:inline"> y Salidas</span></span>
              </button>

              <button
                type="button"
                onClick={() => setPestanaActiva('tareas')}
                className={`pb-2.5 sm:pb-3 px-2.5 sm:px-4 font-bold text-xs sm:text-sm flex items-center gap-1.5 border-b-2 transition-all whitespace-nowrap shrink-0 ${
                  pestanaActiva === 'tareas'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <span>📚</span>
                <span>Tareas<span className="hidden sm:inline"> Escolares</span></span>
                {tareasActivas.length > 0 && (
                  <span className="rounded-full bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.2">
                    {tareasActivas.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setPestanaActiva('comunicados')}
                className={`pb-2.5 sm:pb-3 px-2.5 sm:px-4 font-bold text-xs sm:text-sm flex items-center gap-1.5 border-b-2 transition-all whitespace-nowrap shrink-0 ${
                  pestanaActiva === 'comunicados'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <span>📢</span>
                <span>Comunicados</span>
                {comunicadosActivos.length > 0 && (
                  <span className="rounded-full bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.2">
                    {comunicadosActivos.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setPestanaActiva('cafeteria')}
                className={`pb-2.5 sm:pb-3 px-2.5 sm:px-4 font-bold text-xs sm:text-sm flex items-center gap-1.5 border-b-2 transition-all whitespace-nowrap shrink-0 ${
                  pestanaActiva === 'cafeteria'
                    ? 'border-amber-500 text-amber-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <span>🍽️</span>
                <span>Cafetería<span className="hidden sm:inline"> y Lonchera</span></span>
                {cafeteriaHistorial?.saldo?.saldoActual !== undefined && (
                  <span className="rounded-full bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-black px-1.5 py-0.2">
                    S/ {Number(cafeteriaHistorial.saldo.saldoActual).toFixed(2)}
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

            {/* CONTENIDO 4: CAFETERÍA Y LONCHERA ESCOLAR */}
            {pestanaActiva === 'cafeteria' && (
              <div className="p-4 sm:p-6 animate-in fade-in duration-150 space-y-6">

                {/* Toast de confirmación de cafetería */}
                {toastCafeteria && (
                  <div className={`p-4 rounded-xl text-sm font-semibold flex items-center gap-2.5 shadow-lg ${
                    toastCafeteria.tipo === 'error'
                      ? 'bg-rose-50 text-rose-800 border border-rose-200'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  }`}>
                    <span>{toastCafeteria.tipo === 'error' ? '⚠️' : '✅'}</span>
                    <span>{toastCafeteria.mensaje}</span>
                  </div>
                )}

                {/* TARJETA HERO: BILLETERA DIGITAL ESCOLAR */}
                <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 rounded-3xl p-5 sm:p-6 text-white shadow-xl relative overflow-hidden">
                  <div className="absolute -right-6 -bottom-6 w-36 h-36 bg-white/10 rounded-full blur-2xl"></div>
                  
                  <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-amber-100 text-xs font-black uppercase tracking-wider">
                        <span>💳 Billetera Digital Escolar</span>
                        <span>·</span>
                        <span>IEP Millenium</span>
                      </div>
                      <div className="mt-2 text-4xl sm:text-5xl font-black font-mono tracking-tight drop-shadow-sm">
                        S/ {Number(cafeteriaHistorial?.saldo?.saldoActual || 0).toFixed(2)}
                      </div>
                      <p className="text-amber-100 text-xs mt-1">
                        Saldo disponible para consumos en cafetería y pedidos de lonchera.
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 sm:items-end w-full sm:w-auto">
                      <button
                        onClick={() => setModalRecargaYape(true)}
                        className="bg-white hover:bg-amber-50 text-amber-900 font-extrabold px-5 py-3 rounded-2xl text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 w-full sm:w-auto"
                      >
                        <span className="text-lg">📱</span>
                        <span>Recargar con Yape</span>
                      </button>

                      <button
                        onClick={() => recargarDatosCafeteria(data.estudiante.dni)}
                        className="text-white/80 hover:text-white text-xs font-semibold flex items-center justify-center gap-1 self-center sm:self-end pt-1"
                      >
                        <span>🔄</span>
                        <span>Actualizar saldo</span>
                      </button>
                    </div>
                  </div>

                  {/* Resumen de totales */}
                  <div className="mt-5 pt-4 border-t border-white/20 grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-black/10 rounded-xl p-2.5 backdrop-blur-sm">
                      <span className="text-amber-200 block text-[10px] font-bold uppercase">Total Recargado</span>
                      <strong className="text-white text-sm font-mono">
                        S/ {Number(cafeteriaHistorial?.saldo?.totalRecargado || 0).toFixed(2)}
                      </strong>
                    </div>
                    <div className="bg-black/10 rounded-xl p-2.5 backdrop-blur-sm">
                      <span className="text-amber-200 block text-[10px] font-bold uppercase">Total Consumido</span>
                      <strong className="text-white text-sm font-mono">
                        S/ {Number(cafeteriaHistorial?.saldo?.totalConsumido || 0).toFixed(2)}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* MENÚ ESCOLAR DEL DÍA: CATÁLOGO */}
                <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <div>
                      <h4 className="font-extrabold text-gray-900 text-base flex items-center gap-2">
                        <span>🥪</span>
                        <span>Menú del Día en Cafetería</span>
                      </h4>
                      <p className="text-xs text-gray-500">
                        Alimentos frescos disponibles hoy para el recreo o almuerzo.
                      </p>
                    </div>

                    {/* Filtro categoría */}
                    <select
                      value={categoriaMenuPadre}
                      onChange={(e) => setCategoriaMenuPadre(e.target.value)}
                      className="bg-gray-50 border border-gray-300 rounded-xl px-3 py-1.5 text-xs text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="TODAS">Todas las categorías</option>
                      {CATEGORIAS_CAFETERIA.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* Grid de productos del menú */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {menuHoy
                      .filter(p => categoriaMenuPadre === 'TODAS' || p.categoria === categoriaMenuPadre)
                      .map(prod => {
                        const itemEnPedido = carritoPadre.find(it => it.idProducto === prod.idProducto);
                        const cantEnPedido = itemEnPedido ? itemEnPedido.cantidad : 0;
                        const seleccionado = cantEnPedido > 0;

                        return (
                          <div
                            key={prod.idProducto}
                            className={`rounded-2xl p-3 flex flex-col justify-between transition-all relative ${
                              seleccionado
                                ? 'bg-amber-50/80 border-2 border-amber-500 shadow-md ring-1 ring-amber-400'
                                : 'bg-white border border-gray-200 hover:border-amber-400 hover:shadow-md'
                            }`}
                          >
                            {/* Badge flotante de cantidad en lonchera */}
                            {seleccionado && (
                              <div className="absolute -top-2 -right-2 z-20 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[11px] font-black px-2.5 py-0.5 rounded-full shadow-md border border-white flex items-center gap-1 animate-in zoom-in-75">
                                <span>🧺</span>
                                <span>{cantEnPedido} en lonchera</span>
                              </div>
                            )}

                            <div>
                              {/* Imagen o Placeholder */}
                              <div className={`w-full h-28 rounded-xl overflow-hidden mb-2 relative flex items-center justify-center ${
                                seleccionado ? 'bg-amber-100/50' : 'bg-gray-100'
                              }`}>
                                {prod.imagenUrl ? (
                                  <img
                                    src={prod.imagenUrl}
                                    alt={prod.nombre}
                                    className="w-full h-full object-cover"
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                  />
                                ) : (
                                  <span className="text-3xl opacity-60">🥪</span>
                                )}
                                <span className="absolute bottom-1.5 right-1.5 bg-gray-900/80 backdrop-blur text-white text-[10px] font-black px-2 py-0.5 rounded-lg">
                                  S/ {Number(prod.precio || 0).toFixed(2)}
                                </span>
                              </div>

                              <div className={`font-bold text-xs line-clamp-1 ${
                                seleccionado ? 'text-amber-950 font-black' : 'text-gray-900'
                              }`}>
                                {prod.nombre}
                              </div>
                              <div className="text-[10px] text-gray-400 truncate">{prod.categoria}</div>
                              {prod.descripcion && (
                                <p className="text-[11px] text-gray-600 line-clamp-2 mt-1">{prod.descripcion}</p>
                              )}
                            </div>

                            {/* Controles de cantidad o botón agregar */}
                            {seleccionado ? (
                              <div className="mt-3 flex items-center justify-between bg-white border border-amber-400 rounded-xl p-1 shadow-sm">
                                <button
                                  type="button"
                                  onClick={() => modificarCantidadCarritoPadre(prod.idProducto, -1)}
                                  className="w-8 h-7 rounded-lg bg-gray-100 hover:bg-rose-100 text-gray-700 hover:text-rose-700 font-black text-sm flex items-center justify-center transition-colors"
                                  title="Quitar 1"
                                >
                                  -
                                </button>
                                <span className="text-xs font-mono font-black text-amber-900 px-2">
                                  {cantEnPedido} en lonchera
                                </span>
                                <button
                                  type="button"
                                  onClick={() => agregarAlCarritoPadre(prod)}
                                  className="w-8 h-7 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-black text-sm flex items-center justify-center transition-colors shadow-sm"
                                  title="Agregar otro"
                                >
                                  +
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => agregarAlCarritoPadre(prod)}
                                className="mt-3 w-full bg-amber-50 hover:bg-amber-500 text-amber-800 hover:text-white border border-amber-300 hover:border-amber-500 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                              >
                                <span>+</span>
                                <span>Pedir para Lonchera</span>
                              </button>
                            )}
                          </div>
                        );
                      })}

                    {menuHoy.length === 0 && (
                      <div className="col-span-full py-8 text-center text-gray-400 text-xs">
                        No hay productos marcados en el menú de hoy en este momento.
                      </div>
                    )}
                  </div>
                </div>

                {/* CARRITO DE PEDIDO DEL PADRE (Si hay items agregados) */}
                {carritoPadre.length > 0 && (
                  <div className="bg-amber-50/80 border-2 border-amber-400 rounded-3xl p-5 shadow-lg space-y-4 animate-in slide-in-from-bottom-2">
                    <div className="flex items-center justify-between pb-3 border-b border-amber-200">
                      <div className="font-black text-amber-950 text-base flex items-center gap-2">
                        <span>🛒</span>
                        <span>Tu Pedido para Hoy</span>
                      </div>
                      <button
                        onClick={() => setCarritoPadre([])}
                        className="text-xs text-rose-600 hover:text-rose-800 font-bold"
                      >
                        Vaciar
                      </button>
                    </div>

                    <div className="space-y-2 divide-y divide-amber-200/60">
                      {carritoPadre.map(item => (
                        <div key={item.idProducto} className="pt-2 flex items-center justify-between text-xs">
                          <div className="flex-1">
                            <span className="font-bold text-gray-900">{item.nombre}</span>
                            <span className="text-gray-500 block text-[11px]">S/ {item.precio.toFixed(2)} c/u</span>
                          </div>

                          <div className="flex items-center gap-2 bg-white border border-amber-300 rounded-lg px-2 py-0.5">
                            <button
                              onClick={() => modificarCantidadCarritoPadre(item.idProducto, -1)}
                              className="font-black text-amber-800 px-1 hover:text-amber-950"
                            >
                              -
                            </button>
                            <span className="font-bold text-amber-900 w-4 text-center">{item.cantidad}</span>
                            <button
                              onClick={() => modificarCantidadCarritoPadre(item.idProducto, 1)}
                              className="font-black text-amber-800 px-1 hover:text-amber-950"
                            >
                              +
                            </button>
                          </div>

                          <span className="font-mono font-black text-gray-900 min-w-[55px] text-right">
                            S/ {item.subtotal.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Selector de Turno de Entrega */}
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setTurnoPedido('RECREO')}
                        className={`py-2 rounded-xl text-xs font-black border transition-all ${
                          turnoPedido === 'RECREO'
                            ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        ☀️ Para la hora de Recreo
                      </button>

                      <button
                        type="button"
                        onClick={() => setTurnoPedido('ALMUERZO')}
                        className={`py-2 rounded-xl text-xs font-black border transition-all ${
                          turnoPedido === 'ALMUERZO'
                            ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        🍲 Para la hora de Almuerzo
                      </button>
                    </div>

                    {/* Nota o indicación especial */}
                    <input
                      type="text"
                      placeholder="Indicación para cafetería (ej: sin mayonesa, jugo caliente...)"
                      value={notaPedido}
                      onChange={(e) => setNotaPedido(e.target.value)}
                      className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />

                    {/* Total y botón confirmar */}
                    <div className="pt-2 flex items-center justify-between gap-4">
                      <div>
                        <span className="text-[10px] text-gray-500 uppercase font-bold block">Total del Pedido</span>
                        <span className="text-2xl font-black font-mono text-amber-950">
                          S/ {totalCarritoPadre.toFixed(2)}
                        </span>
                      </div>

                      <button
                        onClick={handleConfirmarPedidoPadre}
                        disabled={enviandoPedido}
                        className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-black py-3 rounded-2xl text-xs sm:text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {enviandoPedido ? (
                          <span>Enviando Pedido...</span>
                        ) : (
                          <>
                            <span>✅</span>
                            <span>Confirmar Pedido (S/ {totalCarritoPadre.toFixed(2)})</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* HISTORIAL TRANSPARENTE: CONSUMOS Y RECARGAS */}
                <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-200">
                    <div>
                      <h4 className="font-extrabold text-gray-900 text-sm sm:text-base flex items-center gap-2">
                        <span>📜</span>
                        <span>Historial de Movimientos</span>
                      </h4>
                      <p className="text-[11px] sm:text-xs text-gray-500">Trazabilidad de recargas, consumos y lonchera</p>
                    </div>

                    {/* Sub-selector 100% adaptable a móvil */}
                    <div className="grid grid-cols-3 sm:flex items-center gap-1 bg-gray-100 p-1 rounded-xl text-xs font-bold w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => setSubTabMovimientos('consumos')}
                        className={`py-1.5 px-2 sm:px-3 rounded-lg transition-all text-center whitespace-nowrap ${
                          subTabMovimientos === 'consumos' ? 'bg-white text-gray-900 shadow-sm font-black' : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        🍽️ Consumos
                      </button>
                      <button
                        type="button"
                        onClick={() => setSubTabMovimientos('recargas')}
                        className={`py-1.5 px-2 sm:px-3 rounded-lg transition-all text-center whitespace-nowrap ${
                          subTabMovimientos === 'recargas' ? 'bg-white text-gray-900 shadow-sm font-black' : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        💳 Recargas
                      </button>
                      <button
                        type="button"
                        onClick={() => setSubTabMovimientos('pedidos')}
                        className={`py-1.5 px-2 sm:px-3 rounded-lg transition-all text-center whitespace-nowrap ${
                          subTabMovimientos === 'pedidos' ? 'bg-white text-gray-900 shadow-sm font-black' : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        📋 Pedidos
                      </button>
                    </div>
                  </div>

                  {/* Sub-Tab 1: Consumos en Cafetería */}
                  {subTabMovimientos === 'consumos' && (
                    <div className="space-y-2.5">
                      {cafeteriaHistorial && cafeteriaHistorial.ventas && cafeteriaHistorial.ventas.length > 0 ? (
                        cafeteriaHistorial.ventas.map((v, i) => (
                          <div key={i} className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between gap-3 text-xs">
                            <div className="space-y-0.5">
                              <div className="font-bold text-gray-900">
                                {v.items && v.items.length > 0 
                                  ? v.items.map(it => `${it.cantidad}x ${it.nombre}`).join(', ') 
                                  : 'Consumo en Cafetería'}
                              </div>
                              <div className="text-[11px] text-gray-500">
                                📅 {v.fecha} {v.hora || ''} · Método: <span className="font-semibold">{v.metodoPago === 'SALDO_ESTUDIANTE' ? 'Billetera Digital' : v.metodoPago}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="font-black font-mono text-sm text-rose-600 block">
                                - S/ {Number(v.total || 0).toFixed(2)}
                              </span>
                              {v.saldoRestante !== undefined && (
                                <span className="text-[10px] text-gray-400 font-mono">
                                  Quedó: S/ {Number(v.saldoRestante).toFixed(2)}
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="py-8 text-center text-gray-400 text-xs">
                          Aún no hay consumos registrados en cafetería para este estudiante.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Sub-Tab 2: Recargas Yape */}
                  {subTabMovimientos === 'recargas' && (
                    <div className="space-y-2.5">
                      {cafeteriaHistorial && cafeteriaHistorial.recargas && cafeteriaHistorial.recargas.length > 0 ? (
                        cafeteriaHistorial.recargas.map((r, i) => (
                          <div key={i} className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between gap-3 text-xs">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-gray-900">Recarga por Yape</span>
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                                  r.estado === 'APROBADA'
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                    : r.estado === 'PENDIENTE'
                                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                                    : 'bg-rose-100 text-rose-800 border-rose-300'
                                }`}>
                                  {r.estado}
                                </span>
                              </div>
                              <div className="text-[11px] text-gray-500">
                                📅 {r.fecha} {r.hora || ''} · Cód. Op: <span className="font-mono font-bold text-gray-700">{r.codigoOperacion || 'N/A'}</span>
                              </div>
                              {r.motivoRechazo && (
                                <div className="text-[11px] text-rose-600 font-semibold mt-1">
                                  Motivo: {r.motivoRechazo}
                                </div>
                              )}
                            </div>
                            <div className="text-right">
                              <span className="font-black font-mono text-sm text-emerald-600">
                                + S/ {Number(r.monto || 0).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="py-8 text-center text-gray-400 text-xs">
                          No se han enviado recargas de Yape aún.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Sub-Tab 3: Pedidos */}
                  {subTabMovimientos === 'pedidos' && (
                    <div className="space-y-2.5">
                      {cafeteriaHistorial && cafeteriaHistorial.pedidos && cafeteriaHistorial.pedidos.length > 0 ? (
                        cafeteriaHistorial.pedidos.map((p, i) => (
                          <div key={i} className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between gap-3 text-xs">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-gray-900">
                                  {p.items ? p.items.map(it => `${it.cantidad}x ${it.nombre}`).join(', ') : 'Pedido de Lonchera'}
                                </span>
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                                  {p.turnoEntrega}
                                </span>
                              </div>
                              <div className="text-[11px] text-gray-500">
                                📅 Fecha de entrega: {p.fechaEntrega} · Estado: <strong className="text-gray-800">{p.estado}</strong>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="font-black font-mono text-sm text-gray-900">
                                S/ {Number(p.total || 0).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="py-8 text-center text-gray-400 text-xs">
                          No has realizado pedidos anticipados aún.
                        </div>
                      )}
                    </div>
                  )}
                </div>
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

      {/* Modal: Recargar Saldo con Yape */}
      {modalRecargaYape && (
        <div 
          onClick={() => setModalRecargaYape(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-md w-full bg-white rounded-3xl p-5 sm:p-6 shadow-2xl overflow-y-auto max-h-[92vh]"
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">📱</span>
                <div>
                  <h3 className="font-extrabold text-gray-900 text-base">Recargar Billetera por Yape</h3>
                  <p className="text-xs text-gray-500">Cafetería Escolar · IEP Millenium</p>
                </div>
              </div>
              <button
                onClick={() => setModalRecargaYape(false)}
                className="text-gray-400 hover:text-gray-600 font-black p-1 text-sm"
              >
                ✕
              </button>
            </div>

            {/* QR Oficial de Yape */}
            <div className="bg-[#6B1E87] rounded-2xl p-4 text-white text-center shadow-md mb-4 flex flex-col items-center">
              <div className="text-xs font-bold uppercase tracking-wider text-purple-200 mb-1">
                Escanea el código QR desde tu app Yape
              </div>
              <div className="bg-white p-2.5 rounded-2xl shadow-inner my-2 inline-block max-w-[200px]">
                <img 
                  src="/qr-yape.jpg" 
                  alt="Código QR de Yape - Juan Fernando Elias Medina" 
                  className="w-full h-auto rounded-xl object-contain shadow-sm"
                />
              </div>
              <div className="mt-1">
                <div className="text-xs text-purple-200">Titular de la cuenta:</div>
                <div className="font-extrabold text-sm text-white">Juan Fernando Elias Medina</div>
              </div>
              <a
                href="/qr-yape.jpg"
                download="qr-yape-cafeteria-millenium.jpg"
                className="mt-2 text-[11px] bg-white/20 hover:bg-white/30 text-white font-bold px-3 py-1 rounded-full transition-all inline-flex items-center gap-1"
              >
                <span>📥</span> Descargar QR a mi teléfono
              </a>
            </div>

            <form onSubmit={handleEnviarRecargaYapeSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Monto Transferido (S/) *</label>
                <input
                  type="number"
                  step="0.50"
                  min="1"
                  required
                  placeholder="Ej: 20.00"
                  value={montoYape}
                  onChange={(e) => setMontoYape(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Código de Operación Yape (6 a 8 dígitos) *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: 849201"
                  value={codigoOpYape}
                  onChange={(e) => setCodigoOpYape(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Tu Número de Celular Yape (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ej: 987654321"
                  value={celularYape}
                  onChange={(e) => setCelularYape(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Foto o Captura de la Constancia Yape *</label>
                <input
                  type="file"
                  accept="image/*"
                  required
                  onChange={(e) => setComprobanteYapeFile(e.target.files[0] || null)}
                  className="w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-purple-100 file:text-purple-800 hover:file:bg-purple-200"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalRecargaYape(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={enviandoRecarga}
                  className="px-5 py-2.5 bg-[#6B1E87] hover:bg-[#581770] text-white font-extrabold rounded-xl text-xs shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {enviandoRecarga ? 'Enviando...' : 'Enviar Comprobante a Cafetería'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConsultaPadres;
