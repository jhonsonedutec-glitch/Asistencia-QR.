import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  CATEGORIAS_CAFETERIA,
  obtenerProductosCafeteria,
  guardarProductoCafeteria,
  eliminarProductoCafeteria,
  toggleMenuHoyProducto,
  obtenerSaldosCafeteria,
  ajustarSaldoManual,
  obtenerRecargasCafeteria,
  procesarRecargaYape,
  registrarVentaCaja,
  obtenerPedidosCafeteria,
  cambiarEstadoPedido,
  obtenerReporteCafeteria,
  obtenerEstudiantes
} from '../services/api';
import QRScanner from '../components/QRScanner';

// Helper de audio para POS
const playSound = (type = 'success') => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.25);
      osc.stop(audioCtx.currentTime + 0.25);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.35);
      osc.stop(audioCtx.currentTime + 0.35);
    }
  } catch {}
};

const getFechaHoyISO = () => {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = String(hoy.getMonth() + 1).padStart(2, '0');
  const d = String(hoy.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function CafeteriaAdmin() {
  const [tabActiva, setTabActiva] = useState('pos'); // pos | pedidos | recargas | menu | reportes | saldos
  const [notificacion, setNotificacion] = useState(null);

  // Estados comunes
  const [loading, setLoading] = useState(false);
  const [estudiantes, setEstudiantes] = useState([]);
  const [saldosMap, setSaldosMap] = useState({});
  const [productos, setProductos] = useState([]);

  // Estados de POS (Caja)
  const [busquedaEstudiante, setBusquedaEstudiante] = useState('');
  const [estudianteSeleccionado, setEstudianteSeleccionado] = useState(null);
  const [carrito, setCarrito] = useState([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('TODAS');
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [metodoPago, setMetodoPago] = useState('SALDO_ESTUDIANTE'); // SALDO_ESTUDIANTE | EFECTIVO | YAPE_DIRECTO
  const [atendidoPor, setAtendidoPor] = useState('Caja 1');
  const [mostrarEscanerPOS, setMostrarEscanerPOS] = useState(false);
  const [procesandoVenta, setProcesandoVenta] = useState(false);

  // Estados de Pedidos
  const [pedidos, setPedidos] = useState([]);
  const [filtroTurnoPedido, setFiltroTurnoPedido] = useState('TODOS');
  const [filtroEstadoPedido, setFiltroEstadoPedido] = useState('TODOS');
  const [fechaPedidos, setFechaPedidos] = useState(getFechaHoyISO);

  // Estados de Recargas Yape
  const [recargas, setRecargas] = useState([]);
  const [filtroEstadoRecargas, setFiltroEstadoRecargas] = useState('PENDIENTE');
  const [modalComprobante, setModalComprobante] = useState(null);
  const [procesandoRecargaId, setProcesandoRecargaId] = useState(null);
  const [mostrarModalQRYape, setMostrarModalQRYape] = useState(false);

  // Estados de Menú y Productos
  const [modalProducto, setModalProducto] = useState(null); // null | { isEdit: bool, data: {...} }
  const [filtroCategoriaMenu, setFiltroCategoriaMenu] = useState('TODAS');
  const [busquedaMenu, setBusquedaMenu] = useState('');

  // Estados de Reportes
  const [periodoReporte, setPeriodoReporte] = useState('HOY');
  const [datosReporte, setDatosReporte] = useState(null);

  // Estados de Saldos y Ajustes
  const [saldosLista, setSaldosLista] = useState([]);
  const [busquedaSaldo, setBusquedaSaldo] = useState('');
  const [modalAjuste, setModalAjuste] = useState(null); // null | { dni, nombres, saldoActual }
  const [montoAjuste, setMontoAjuste] = useState('');
  const [tipoAjuste, setTipoAjuste] = useState('AUMENTAR');
  const [motivoAjuste, setMotivoAjuste] = useState('');
  const [autorizadoPor, setAutorizadoPor] = useState('Dirección');

  const showToast = (mensaje, tipo = 'success') => {
    setNotificacion({ mensaje, tipo });
    setTimeout(() => setNotificacion(null), 4000);
  };

  // Carga inicial
  const cargarDatosBase = useCallback(async () => {
    setLoading(true);
    try {
      const [estRes, saldosRes, prodRes] = await Promise.all([
        obtenerEstudiantes().catch(() => ({ success: false })),
        obtenerSaldosCafeteria().catch(() => ({ success: false })),
        obtenerProductosCafeteria(false).catch(() => ({ success: false }))
      ]);

      if (estRes && estRes.success && Array.isArray(estRes.estudiantes)) {
        setEstudiantes(estRes.estudiantes);
      }

      if (saldosRes && saldosRes.success && Array.isArray(saldosRes.saldos)) {
        setSaldosLista(saldosRes.saldos);
        const map = {};
        saldosRes.saldos.forEach(s => {
          map[String(s.dni).trim()] = s;
        });
        setSaldosMap(map);
      }

      if (prodRes && prodRes.success && Array.isArray(prodRes.productos)) {
        setProductos(prodRes.productos);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarDatosBase();
  }, [cargarDatosBase]);

  // Carga de pedidos al cambiar fecha o entrar a tab pedidos
  const cargarPedidos = useCallback(async () => {
    const res = await obtenerPedidosCafeteria(fechaPedidos, 'TODOS');
    if (res && res.success && Array.isArray(res.pedidos)) {
      setPedidos(res.pedidos);
    }
  }, [fechaPedidos]);

  useEffect(() => {
    if (tabActiva === 'pedidos') {
      cargarPedidos();
    }
  }, [tabActiva, cargarPedidos]);

  // Carga de recargas Yape
  const cargarRecargas = useCallback(async () => {
    const res = await obtenerRecargasCafeteria(filtroEstadoRecargas);
    if (res && res.success && Array.isArray(res.recargas)) {
      setRecargas(res.recargas);
    }
  }, [filtroEstadoRecargas]);

  useEffect(() => {
    if (tabActiva === 'recargas') {
      cargarRecargas();
    }
  }, [tabActiva, cargarRecargas]);

  // Carga de reportes
  const cargarReporte = useCallback(async () => {
    const res = await obtenerReporteCafeteria(periodoReporte);
    if (res && res.success) {
      setDatosReporte(res);
    }
  }, [periodoReporte]);

  useEffect(() => {
    if (tabActiva === 'reportes') {
      cargarReporte();
    }
  }, [tabActiva, cargarReporte]);

  // Selección de estudiante para POS
  const seleccionarEstudiante = (est) => {
    const dni = String(est.dni).trim();
    const saldoObj = saldosMap[dni];
    setEstudianteSeleccionado({
      ...est,
      saldoActual: saldoObj ? Number(saldoObj.saldoActual || 0) : 0
    });
    setBusquedaEstudiante('');
    setMostrarEscanerPOS(false);
  };

  // Manejador de escaneo QR en POS
  const handleScanQR = (code) => {
    if (!code) return;
    const clean = String(code).trim();
    // Buscar estudiante por DNI exacto o contenido
    const encontrado = estudiantes.find(e => String(e.dni).trim() === clean);
    if (encontrado) {
      seleccionarEstudiante(encontrado);
      playSound('success');
      showToast(`Estudiante identificado: ${encontrado.nombres}`);
    } else {
      playSound('error');
      showToast(`No se encontró estudiante con código: ${clean}`, 'error');
    }
  };

  // Filtrado de estudiantes para el autocompletado en POS
  const estudiantesFiltradosPOS = useMemo(() => {
    const q = busquedaEstudiante.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    return estudiantes.filter(e => 
      (e.nombres && e.nombres.toLowerCase().includes(q)) ||
      (e.dni && String(e.dni).includes(q))
    ).slice(0, 8);
  }, [busquedaEstudiante, estudiantes]);

  // Agregar al carrito
  const agregarAlCarrito = (prod) => {
    setCarrito(prev => {
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
    playSound('success');
  };

  const modificarCantidadCarrito = (idProducto, delta) => {
    setCarrito(prev => {
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

  const totalCarrito = useMemo(() => {
    return Number(carrito.reduce((acc, it) => acc + (it.subtotal || 0), 0).toFixed(2));
  }, [carrito]);

  // Ejecutar Cobro en Caja
  const handleCobrarVenta = async () => {
    if (!estudianteSeleccionado) {
      playSound('error');
      showToast('Selecciona o escanea primero el carnet del estudiante.', 'error');
      return;
    }
    if (carrito.length === 0) {
      playSound('error');
      showToast('El ticket de venta está vacío.', 'error');
      return;
    }

    if (metodoPago === 'SALDO_ESTUDIANTE') {
      const saldoDisponible = estudianteSeleccionado.saldoActual || 0;
      if (saldoDisponible < totalCarrito) {
        playSound('error');
        showToast(`Saldo insuficiente. Saldo disponible: S/ ${saldoDisponible.toFixed(2)} - Total: S/ ${totalCarrito.toFixed(2)}`, 'error');
        return;
      }
    }

    setProcesandoVenta(true);
    try {
      const itemsPayload = carrito.map(it => ({
        idProducto: it.idProducto,
        nombre: it.nombre,
        cantidad: it.cantidad,
        precioUnitario: it.precio,
        subtotal: it.subtotal
      }));

      const res = await registrarVentaCaja({
        dni: estudianteSeleccionado.dni,
        items: itemsPayload,
        total: totalCarrito,
        metodoPago,
        atendidoPor,
        observaciones: 'Venta presencial en cafetería'
      });

      if (res && res.success) {
        playSound('success');
        showToast(`¡Venta realizada con éxito! Ticket: ${res.idVenta || ''}`);
        
        // Actualizar saldo del estudiante localmente
        const nuevoSaldo = Number(res.nuevoSaldo !== undefined ? res.nuevoSaldo : (estudianteSeleccionado.saldoActual - (metodoPago === 'SALDO_ESTUDIANTE' ? totalCarrito : 0)));
        setEstudianteSeleccionado(prev => ({
          ...prev,
          saldoActual: nuevoSaldo
        }));

        setSaldosMap(prev => ({
          ...prev,
          [estudianteSeleccionado.dni]: {
            ...prev[estudianteSeleccionado.dni],
            saldoActual: nuevoSaldo
          }
        }));

        // Limpiar ticket
        setCarrito([]);
      } else {
        playSound('error');
        showToast(res.message || 'Error al procesar la venta.', 'error');
      }
    } catch (err) {
      playSound('error');
      showToast('Error de red al registrar venta: ' + err.message, 'error');
    } finally {
      setProcesandoVenta(false);
    }
  };

  // Toggle Menú Hoy
  const handleToggleMenuHoy = async (prod) => {
    const nuevoEstado = !prod.enMenuHoy;
    // Actualización optimista
    setProductos(prev => prev.map(p => p.idProducto === prod.idProducto ? { ...p, enMenuHoy: nuevoEstado } : p));
    try {
      const res = await toggleMenuHoyProducto(prod.idProducto, nuevoEstado);
      if (res && res.success) {
        showToast(`"${prod.nombre}" ahora está ${nuevoEstado ? 'DISPONIBLE EN EL MENÚ' : 'OCULTO'}`);
      } else {
        // Revertir
        setProductos(prev => prev.map(p => p.idProducto === prod.idProducto ? { ...p, enMenuHoy: !nuevoEstado } : p));
        showToast('No se pudo actualizar el menú', 'error');
      }
    } catch {
      setProductos(prev => prev.map(p => p.idProducto === prod.idProducto ? { ...p, enMenuHoy: !nuevoEstado } : p));
      showToast('Error de conexión', 'error');
    }
  };

  // Procesar Recarga Yape (Aprobar / Rechazar)
  const handleProcesarRecarga = async (idRecarga, accion) => {
    let motivo = '';
    if (accion === 'RECHAZAR') {
      const razon = prompt('Ingresa el motivo del rechazo del comprobante Yape:');
      if (razon === null) return; // cancelado
      motivo = razon.trim() || 'Comprobante no válido';
    } else {
      if (!confirm('¿Confirmas que el dinero ha ingresado a la cuenta Yape y deseas abonar el saldo al estudiante?')) {
        return;
      }
    }

    setProcesandoRecargaId(idRecarga);
    try {
      const res = await procesarRecargaYape(idRecarga, accion, atendidoPor, motivo);
      if (res && res.success) {
        playSound('success');
        showToast(accion === 'APROBAR' ? '¡Recarga aprobada y saldo abonado al estudiante!' : 'Recarga rechazada correctamente.');
        cargarRecargas();
        cargarDatosBase();
      } else {
        playSound('error');
        showToast(res.message || 'No se pudo procesar la recarga.', 'error');
      }
    } catch (err) {
      playSound('error');
      showToast('Error de conexión: ' + err.message, 'error');
    } finally {
      setProcesandoRecargaId(null);
    }
  };

  // Cambiar Estado de Pedido
  const handleCambiarEstadoPedido = async (idPedido, nuevoEstado) => {
    try {
      const res = await cambiarEstadoPedido(idPedido, nuevoEstado, atendidoPor);
      if (res && res.success) {
        showToast(`Pedido actualizado a: ${nuevoEstado}`);
        cargarPedidos();
      } else {
        showToast(res.message || 'Error al actualizar pedido', 'error');
      }
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  };

  // Ajuste manual de saldo
  const handleGuardarAjusteManual = async (e) => {
    e.preventDefault();
    if (!modalAjuste) return;
    const montoNum = parseFloat(montoAjuste);
    if (isNaN(montoNum) || montoNum <= 0) {
      showToast('Ingresa un monto válido mayor a 0', 'error');
      return;
    }
    if (!motivoAjuste.trim()) {
      showToast('El motivo del ajuste es obligatorio para auditoría', 'error');
      return;
    }

    try {
      const res = await ajustarSaldoManual({
        dni: modalAjuste.dni,
        tipoAjuste,
        monto: montoNum,
        motivo: motivoAjuste.trim(),
        autorizadoPor: autorizadoPor.trim() || 'Dirección'
      });

      if (res && res.success) {
        playSound('success');
        showToast(`Ajuste aplicado con éxito. Nuevo saldo: S/ ${res.nuevoSaldo !== undefined ? Number(res.nuevoSaldo).toFixed(2) : ''}`);
        setModalAjuste(null);
        setMontoAjuste('');
        setMotivoAjuste('');
        cargarDatosBase();
      } else {
        playSound('error');
        showToast(res.message || 'Error al procesar ajuste', 'error');
      }
    } catch (err) {
      playSound('error');
      showToast('Error: ' + err.message, 'error');
    }
  };

  // Modal Guardar Producto
  const handleGuardarProductoSubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const nombre = form.nombre.value.trim();
    const categoria = form.categoria.value;
    const precio = parseFloat(form.precio.value);
    const descripcion = form.descripcion.value.trim();
    const unidad = form.unidad.value.trim() || 'Unidad';
    const enMenuHoy = form.enMenuHoy.checked;

    if (!nombre || isNaN(precio) || precio < 0) {
      showToast('Nombre y precio válido son obligatorios', 'error');
      return;
    }

    let imagenBase64 = '';
    let imagenNombre = '';
    let imagenMime = '';
    const file = form.imagen.files[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) {
        showToast('La imagen no debe superar 4MB', 'error');
        return;
      }
      const base64Data = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(file);
      });
      imagenBase64 = base64Data;
      imagenNombre = file.name;
      imagenMime = file.type;
    }

    try {
      const payload = {
        idProducto: modalProducto && modalProducto.data ? modalProducto.data.idProducto : '',
        nombre,
        categoria,
        precio,
        unidad,
        descripcion,
        enMenuHoy,
        imagenBase64,
        imagenNombre,
        imagenMime,
        imagenUrl: modalProducto && modalProducto.data ? modalProducto.data.imagenUrl : ''
      };

      const res = await guardarProductoCafeteria(payload);
      if (res && res.success) {
        showToast('¡Producto guardado exitosamente!');
        setModalProducto(null);
        cargarDatosBase();
      } else {
        showToast(res.message || 'Error al guardar producto', 'error');
      }
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  };

  const handleEliminarProducto = async (prod) => {
    if (!confirm(`¿Estás seguro de eliminar el producto "${prod.nombre}"?`)) return;
    try {
      const res = await eliminarProductoCafeteria(prod.idProducto);
      if (res && res.success) {
        showToast('Producto eliminado');
        setProductos(prev => prev.filter(p => p.idProducto !== prod.idProducto));
      } else {
        showToast(res.message || 'Error al eliminar', 'error');
      }
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  };

  // Recargas pendientes count
  const recargasPendientesCount = useMemo(() => {
    return recargas.filter(r => r.estado === 'PENDIENTE').length;
  }, [recargas]);

  // Pedidos activos count
  const pedidosPendientesCount = useMemo(() => {
    return pedidos.filter(p => p.estado === 'PENDIENTE' || p.estado === 'EN_PREPARACION').length;
  }, [pedidos]);

  return (
    <div className="min-h-screen bg-[#0b1120] text-slate-100 flex flex-col font-sans">
      {/* Toast Notificación */}
      {notificacion && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-sm font-semibold transition-all ${
          notificacion.tipo === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
        }`}>
          <span>{notificacion.tipo === 'error' ? '⚠️' : '✅'}</span>
          <span>{notificacion.mensaje}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-4 sm:px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-16 z-10 backdrop-blur">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-3xl">🍽️</span>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                Gestión de Cafetería y Comedor
                <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-bold">
                  IEP Millenium
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Punto de Venta · Menú Digital · Recargas Yape · Comandas de Cocina · Reportes
              </p>
            </div>
          </div>
        </div>

        {/* Selector de Pestañas */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          <button
            onClick={() => setTabActiva('pos')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
              tabActiva === 'pos' ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <span>🛒</span>
            <span>Caja Rápida (POS)</span>
          </button>

          <button
            onClick={() => setTabActiva('pedidos')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all whitespace-nowrap relative ${
              tabActiva === 'pedidos' ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <span>📋</span>
            <span>Pedidos</span>
            {pedidosPendientesCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black animate-pulse">
                {pedidosPendientesCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setTabActiva('recargas')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all whitespace-nowrap relative ${
              tabActiva === 'recargas' ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <span>💳</span>
            <span>Validar Yapes</span>
            {recargasPendientesCount > 0 && (
              <span className="bg-amber-400 text-slate-950 text-[10px] px-1.5 py-0.2 rounded-full font-black animate-pulse">
                {recargasPendientesCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setTabActiva('menu')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
              tabActiva === 'menu' ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <span>🍽️</span>
            <span>Menú y Precios</span>
          </button>

          <button
            onClick={() => setTabActiva('saldos')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
              tabActiva === 'saldos' ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <span>⚖️</span>
            <span>Saldos Alumnos</span>
          </button>

          <button
            onClick={() => setTabActiva('reportes')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
              tabActiva === 'reportes' ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <span>📊</span>
            <span>Reportes Dirección</span>
          </button>

          <button
            onClick={() => setMostrarModalQRYape(true)}
            className="px-3 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all whitespace-nowrap bg-purple-600/20 hover:bg-purple-600/40 text-purple-200 border border-purple-500/40"
            title="Ver código QR oficial de Yape para mostrar en caja o imprimir"
          >
            <span>📱</span>
            <span>QR Yape</span>
          </button>
        </div>
      </div>

      {/* CUERPO PRINCIPAL */}
      <div className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full">

        {/* ======================================================== */}
        {/* PESTAÑA 1: CAJA RÁPIDA (POS)                             */}
        {/* ======================================================== */}
        {tabActiva === 'pos' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Columna Izquierda / Centro: Buscador Alumno y Catálogo Productos (8 cols) */}
            <div className="lg:col-span-8 space-y-5">

              {/* BARRA DE IDENTIFICACIÓN DE ESTUDIANTE */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="🔍 Buscar alumno por DNI o Nombres..."
                      value={busquedaEstudiante}
                      onChange={(e) => setBusquedaEstudiante(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                    />
                    {/* Lista flotante de autocompletado */}
                    {estudiantesFiltradosPOS.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-2 bg-slate-950 border border-slate-700 rounded-xl shadow-2xl z-30 max-h-60 overflow-y-auto divide-y divide-slate-800">
                        {estudiantesFiltradosPOS.map(est => (
                          <div
                            key={est.dni}
                            onClick={() => seleccionarEstudiante(est)}
                            className="p-3 hover:bg-amber-500/10 cursor-pointer flex items-center justify-between transition-colors"
                          >
                            <div>
                              <div className="font-bold text-white text-sm">{est.nombres}</div>
                              <div className="text-xs text-slate-400">DNI: {est.dni} | Grado: {est.grado} {est.nivel || ''}</div>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-mono font-bold bg-slate-800 px-2 py-1 rounded text-amber-400">
                                S/ {saldosMap[String(est.dni).trim()] ? Number(saldosMap[String(est.dni).trim()].saldoActual || 0).toFixed(2) : '0.00'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => setMostrarEscanerPOS(prev => !prev)}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all whitespace-nowrap"
                  >
                    <span>📷</span>
                    <span>{mostrarEscanerPOS ? 'Cerrar Cámara' : 'Escanear Carnet QR'}</span>
                  </button>
                </div>

                {/* Modal / Caja de Escáner QR */}
                {mostrarEscanerPOS && (
                  <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded-xl">
                    <p className="text-xs text-slate-400 mb-2 text-center">Apunta el carnet del estudiante a la cámara para identificarlo al instante:</p>
                    <div className="max-w-xs mx-auto overflow-hidden rounded-xl border border-slate-700">
                      <QRScanner onScan={handleScanQR} />
                    </div>
                  </div>
                )}

                {/* Tarjeta del Estudiante Activo */}
                {estudianteSeleccionado ? (
                  <div className="mt-4 p-4 bg-gradient-to-r from-slate-950 to-slate-900 border border-amber-500/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-xl font-black text-amber-400">
                        {estudianteSeleccionado.nombres ? estudianteSeleccionado.nombres[0] : 'E'}
                      </div>
                      <div>
                        <div className="text-base font-extrabold text-white">{estudianteSeleccionado.nombres}</div>
                        <div className="text-xs text-slate-400">
                          DNI: <span className="font-mono font-semibold text-slate-300">{estudianteSeleccionado.dni}</span> | Grado: <span className="text-slate-300">{estudianteSeleccionado.grado} {estudianteSeleccionado.nivel || ''}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 sm:text-right">
                      <div>
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Saldo Disponible</div>
                        <div className={`text-2xl font-black font-mono ${
                          estudianteSeleccionado.saldoActual > 5 ? 'text-emerald-400' : estudianteSeleccionado.saldoActual > 0 ? 'text-amber-400' : 'text-rose-400'
                        }`}>
                          S/ {Number(estudianteSeleccionado.saldoActual || 0).toFixed(2)}
                        </div>
                      </div>
                      <button
                        onClick={() => setEstudianteSeleccionado(null)}
                        className="text-slate-500 hover:text-slate-300 text-xs p-2 rounded-lg hover:bg-slate-800"
                        title="Quitar estudiante"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 text-center py-2 text-xs text-amber-400/80 bg-amber-500/5 rounded-lg border border-amber-500/10">
                    💡 Selecciona o escanea a un estudiante para consultar su saldo y cargar el consumo a su cuenta.
                  </div>
                )}
              </div>

              {/* CATÁLOGO DE PRODUCTOS EN CAJA */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div className="font-extrabold text-white text-base flex items-center gap-2">
                    <span>🍽️</span>
                    <span>Productos Disponibles</span>
                  </div>

                  {/* Buscador de productos */}
                  <div className="relative w-full sm:w-64">
                    <input
                      type="text"
                      placeholder="Buscar producto..."
                      value={busquedaProducto}
                      onChange={(e) => setBusquedaProducto(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                    {busquedaProducto && (
                      <button onClick={() => setBusquedaProducto('')} className="absolute right-2.5 top-2 text-slate-400 text-xs">✕</button>
                    )}
                  </div>
                </div>

                {/* Filtro de Categorías con chips scrollables */}
                <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4 scrollbar-thin">
                  <button
                    onClick={() => setCategoriaSeleccionada('TODAS')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                      categoriaSeleccionada === 'TODAS'
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    ⭐ Todas
                  </button>
                  {CATEGORIAS_CAFETERIA.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setCategoriaSeleccionada(cat)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                        categoriaSeleccionada === cat
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Grid de productos */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[500px] overflow-y-auto pr-1">
                  {productos
                    .filter(p => p.enMenuHoy !== false)
                    .filter(p => categoriaSeleccionada === 'TODAS' || p.categoria === categoriaSeleccionada)
                    .filter(p => !busquedaProducto.trim() || p.nombre.toLowerCase().includes(busquedaProducto.toLowerCase()))
                    .map(prod => (
                      <div
                        key={prod.idProducto}
                        onClick={() => agregarAlCarrito(prod)}
                        className="bg-slate-950 border border-slate-800 hover:border-amber-500/60 rounded-xl p-3 flex flex-col justify-between cursor-pointer group transition-all transform hover:-translate-y-0.5 hover:shadow-lg hover:shadow-amber-500/10"
                      >
                        {/* Imagen o Placeholder */}
                        <div className="w-full h-24 rounded-lg bg-slate-900 overflow-hidden mb-2 relative flex items-center justify-center border border-slate-800">
                          {prod.imagenUrl ? (
                            <img
                              src={prod.imagenUrl}
                              alt={prod.nombre}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                          ) : (
                            <span className="text-3xl opacity-60">🥪</span>
                          )}
                          <span className="absolute top-1 right-1 bg-slate-950/80 backdrop-blur text-[10px] text-amber-300 font-bold px-1.5 py-0.5 rounded">
                            S/ {Number(prod.precio || 0).toFixed(2)}
                          </span>
                        </div>

                        <div>
                          <div className="font-bold text-white text-xs line-clamp-1 group-hover:text-amber-400 transition-colors">
                            {prod.nombre}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate mt-0.5">
                            {prod.categoria}
                          </div>
                        </div>

                        <button
                          type="button"
                          className="mt-2 w-full bg-slate-800 group-hover:bg-amber-500 group-hover:text-slate-950 text-slate-300 py-1 rounded text-xs font-bold transition-all flex items-center justify-center gap-1"
                        >
                          <span>+</span>
                          <span>Agregar</span>
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {/* Columna Derecha: Ticket de Venta / Carrito (4 cols) */}
            <div className="lg:col-span-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl sticky top-36 flex flex-col h-[calc(100vh-170px)]">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="font-extrabold text-white text-base flex items-center gap-2">
                    <span>🧾</span>
                    <span>Ticket de Venta</span>
                  </div>
                  {carrito.length > 0 && (
                    <button
                      onClick={() => setCarrito([])}
                      className="text-xs text-rose-400 hover:text-rose-300 font-semibold"
                    >
                      Vaciar
                    </button>
                  )}
                </div>

                {/* Lista de Items del carrito */}
                <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 my-3 pr-1">
                  {carrito.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                      <span className="text-4xl mb-2 opacity-50">🛒</span>
                      <p className="text-sm font-semibold">Ticket vacío</p>
                      <p className="text-xs text-slate-600 mt-1">Haz clic en los productos para agregarlos al pedido</p>
                    </div>
                  ) : (
                    carrito.map(item => (
                      <div key={item.idProducto} className="py-2.5 flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-white truncate">{item.nombre}</div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            S/ {item.precio.toFixed(2)} c/u
                          </div>
                        </div>

                        {/* Controles de Cantidad */}
                        <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-1.5 py-0.5">
                          <button
                            onClick={() => modificarCantidadCarrito(item.idProducto, -1)}
                            className="text-slate-400 hover:text-white font-black text-xs px-1"
                          >
                            -
                          </button>
                          <span className="text-xs font-mono font-bold text-amber-400 w-4 text-center">
                            {item.cantidad}
                          </span>
                          <button
                            onClick={() => modificarCantidadCarrito(item.idProducto, 1)}
                            className="text-slate-400 hover:text-white font-black text-xs px-1"
                          >
                            +
                          </button>
                        </div>

                        <div className="text-right min-w-[55px]">
                          <span className="text-xs font-mono font-bold text-white">
                            S/ {item.subtotal.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Subtotales y Métodos de Pago */}
                <div className="pt-3 border-t border-slate-800 space-y-3">
                  {/* Total */}
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total a Cobrar</span>
                    <span className="text-2xl font-black font-mono text-amber-400">
                      S/ {totalCarrito.toFixed(2)}
                    </span>
                  </div>

                  {/* Selector de Método de Pago */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                      Método de Pago:
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setMetodoPago('SALDO_ESTUDIANTE')}
                        className={`py-2 px-1 rounded-xl text-center text-xs font-bold border transition-all ${
                          metodoPago === 'SALDO_ESTUDIANTE'
                            ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className="text-base mb-0.5">💳</div>
                        <div>Saldo Alumno</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setMetodoPago('EFECTIVO')}
                        className={`py-2 px-1 rounded-xl text-center text-xs font-bold border transition-all ${
                          metodoPago === 'EFECTIVO'
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className="text-base mb-0.5">💵</div>
                        <div>Efectivo</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setMetodoPago('YAPE_DIRECTO')}
                        className={`py-2 px-1 rounded-xl text-center text-xs font-bold border transition-all ${
                          metodoPago === 'YAPE_DIRECTO'
                            ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className="text-base mb-0.5">📱</div>
                        <div>Yape en Caja</div>
                      </button>
                    </div>
                  </div>

                  {/* Botón de Cobro Final */}
                  <button
                    onClick={handleCobrarVenta}
                    disabled={procesandoVenta || carrito.length === 0}
                    className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black py-3 rounded-xl shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all text-sm"
                  >
                    {procesandoVenta ? (
                      <span className="animate-pulse">Procesando Venta...</span>
                    ) : (
                      <>
                        <span>⚡</span>
                        <span>Cobrar S/ {totalCarrito.toFixed(2)}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* PESTAÑA 2: COMANDAS / PEDIDOS DEL DÍA                    */}
        {/* ======================================================== */}
        {tabActiva === 'pedidos' && (
          <div className="space-y-6">
            {/* Barra de Filtros */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Fecha:</label>
                  <input
                    type="date"
                    value={fechaPedidos}
                    onChange={(e) => setFechaPedidos(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Turno:</label>
                  <select
                    value={filtroTurnoPedido}
                    onChange={(e) => setFiltroTurnoPedido(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="TODOS">Todos los Turnos</option>
                    <option value="RECREO">Recreo</option>
                    <option value="ALMUERZO">Almuerzo</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Estado:</label>
                  <select
                    value={filtroEstadoPedido}
                    onChange={(e) => setFiltroEstadoPedido(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="TODOS">Todos los Estados</option>
                    <option value="PENDIENTE">Pendientes</option>
                    <option value="EN_PREPARACION">En Preparación</option>
                    <option value="LISTO_ENTREGA">Listos para Entrega</option>
                    <option value="ENTREGADO">Entregados</option>
                  </select>
                </div>
              </div>

              <button
                onClick={cargarPedidos}
                className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 self-start md:self-auto"
              >
                <span>🔄</span>
                <span>Actualizar Comandas</span>
              </button>
            </div>

            {/* Listado de Comandas tipo Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pedidos
                .filter(p => filtroTurnoPedido === 'TODOS' || p.turnoEntrega === filtroTurnoPedido)
                .filter(p => filtroEstadoPedido === 'TODOS' || p.estado === filtroEstadoPedido)
                .map(ped => (
                  <div
                    key={ped.idPedido}
                    className={`bg-slate-900 border rounded-2xl p-4 shadow-xl flex flex-col justify-between transition-all ${
                      ped.estado === 'PENDIENTE'
                        ? 'border-amber-500/50 bg-amber-500/5'
                        : ped.estado === 'EN_PREPARACION'
                        ? 'border-blue-500/50 bg-blue-500/5'
                        : ped.estado === 'LISTO_ENTREGA'
                        ? 'border-emerald-500/50 bg-emerald-500/5'
                        : 'border-slate-800 opacity-70'
                    }`}
                  >
                    <div>
                      {/* Cabecera del pedido */}
                      <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                        <div>
                          <div className="font-black text-white text-base">{ped.nombres}</div>
                          <div className="text-xs text-slate-400">Grado: <span className="text-slate-300 font-semibold">{ped.grado}</span> | DNI: {ped.dni}</div>
                        </div>
                        <div className="text-right">
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                            ped.turnoEntrega === 'RECREO'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                          }`}>
                            {ped.turnoEntrega}
                          </span>
                        </div>
                      </div>

                      {/* Items del pedido */}
                      <div className="space-y-1.5 mb-3">
                        {ped.items && ped.items.map((it, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs">
                            <span className="text-slate-300 font-semibold">
                              <span className="text-amber-400 font-black mr-1">{it.cantidad}x</span> {it.nombre}
                            </span>
                            <span className="text-slate-400 font-mono">S/ {Number(it.subtotal || 0).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>

                      {/* Nota del padre */}
                      {ped.notaPadre && (
                        <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-amber-300/90 italic mb-3">
                          💬 &quot;{ped.notaPadre}&quot;
                        </div>
                      )}
                    </div>

                    {/* Footer y Acciones de Comanda */}
                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase font-bold">Total</div>
                        <div className="text-sm font-black font-mono text-white">S/ {Number(ped.total || 0).toFixed(2)}</div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {ped.estado === 'PENDIENTE' && (
                          <button
                            onClick={() => handleCambiarEstadoPedido(ped.idPedido, 'EN_PREPARACION')}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1"
                          >
                            <span>👨‍🍳</span>
                            <span>Preparar</span>
                          </button>
                        )}

                        {ped.estado === 'EN_PREPARACION' && (
                          <button
                            onClick={() => handleCambiarEstadoPedido(ped.idPedido, 'LISTO_ENTREGA')}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1"
                          >
                            <span>🔔</span>
                            <span>Listo</span>
                          </button>
                        )}

                        {ped.estado === 'LISTO_ENTREGA' && (
                          <button
                            onClick={() => handleCambiarEstadoPedido(ped.idPedido, 'ENTREGADO')}
                            className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1"
                          >
                            <span>✅</span>
                            <span>Entregar</span>
                          </button>
                        )}

                        {ped.estado === 'ENTREGADO' && (
                          <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                            <span>✓ Entregado</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

              {pedidos.length === 0 && (
                <div className="col-span-full py-16 text-center text-slate-500">
                  <span className="text-5xl block mb-2 opacity-50">📋</span>
                  <p className="text-base font-bold text-slate-400">No hay pedidos registrados para este día</p>
                  <p className="text-xs text-slate-600 mt-1">Los pedidos anticipados que realicen los padres aparecerán aquí en tiempo real.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* PESTAÑA 3: VALIDAR RECARGAS YAPE                         */}
        {/* ======================================================== */}
        {tabActiva === 'recargas' && (
          <div className="space-y-6">
            {/* Barra de Filtro */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFiltroEstadoRecargas('PENDIENTE')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    filtroEstadoRecargas === 'PENDIENTE' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  ⏳ Pendientes de Validación ({recargas.filter(r => r.estado === 'PENDIENTE').length})
                </button>
                <button
                  onClick={() => setFiltroEstadoRecargas('APROBADA')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    filtroEstadoRecargas === 'APROBADA' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  ✓ Aprobadas
                </button>
                <button
                  onClick={() => setFiltroEstadoRecargas('RECHAZADA')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    filtroEstadoRecargas === 'RECHAZADA' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  ✕ Rechazadas
                </button>
                <button
                  onClick={() => setFiltroEstadoRecargas('TODOS')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    filtroEstadoRecargas === 'TODOS' ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  Todas
                </button>
              </div>

              <button
                onClick={cargarRecargas}
                className="bg-slate-800 hover:bg-slate-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto"
              >
                <span>🔄</span>
                <span>Actualizar Recargas</span>
              </button>
            </div>

            {/* Listado de Recargas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recargas.map(rec => (
                <div
                  key={rec.idRecarga}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between"
                >
                  <div>
                    {/* Encabezado */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                      <div>
                        <div className="font-black text-white text-base">{rec.nombres}</div>
                        <div className="text-xs text-slate-400">DNI: {rec.dni} | Grado: {rec.grado}</div>
                      </div>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                        rec.estado === 'PENDIENTE'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : rec.estado === 'APROBADA'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      }`}>
                        {rec.estado}
                      </span>
                    </div>

                    {/* Datos del Yape */}
                    <div className="grid grid-cols-2 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800 mb-3">
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase font-bold">Monto Recarga</div>
                        <div className="text-lg font-black font-mono text-emerald-400">
                          S/ {Number(rec.monto || 0).toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase font-bold">Cód. Operación</div>
                        <div className="text-sm font-bold font-mono text-white">
                          {rec.codigoOperacion || 'N/A'}
                        </div>
                      </div>
                      <div className="col-span-2 text-[11px] text-slate-400">
                        📅 Fecha: <span className="text-slate-300">{rec.fecha} {rec.hora || ''}</span>
                        {rec.telefonoOrigen && <span> | Cel: {rec.telefonoOrigen}</span>}
                      </div>
                    </div>

                    {/* Comprobante / Voucher Preview */}
                    {rec.comprobanteUrl ? (
                      <div className="mb-3">
                        <div
                          onClick={() => setModalComprobante(rec.comprobanteUrl)}
                          className="w-full h-32 bg-slate-950 border border-slate-800 rounded-xl overflow-hidden cursor-pointer relative group flex items-center justify-center"
                        >
                          <img
                            src={rec.comprobanteUrl}
                            alt="Voucher Yape"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs font-bold text-white transition-opacity">
                            🔍 Ver Voucher Completo
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-2 text-xs text-slate-500 italic mb-3">
                        Sin comprobante adjunto
                      </div>
                    )}

                    {rec.motivoRechazo && (
                      <div className="p-2 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-300 mb-3">
                        ❌ Motivo rechazo: {rec.motivoRechazo}
                      </div>
                    )}
                  </div>

                  {/* Acciones */}
                  {rec.estado === 'PENDIENTE' && (
                    <div className="pt-3 border-t border-slate-800 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleProcesarRecarga(rec.idRecarga, 'RECHAZAR')}
                        disabled={procesandoRecargaId === rec.idRecarga}
                        className="bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 py-2 rounded-xl text-xs font-bold transition-all text-center"
                      >
                        ✕ Rechazar
                      </button>

                      <button
                        onClick={() => handleProcesarRecarga(rec.idRecarga, 'APROBAR')}
                        disabled={procesandoRecargaId === rec.idRecarga}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-xl text-xs font-bold transition-all text-center shadow-lg shadow-emerald-600/20"
                      >
                        {procesandoRecargaId === rec.idRecarga ? 'Abonando...' : '✓ Aprobar y Abonar'}
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {recargas.length === 0 && (
                <div className="col-span-full py-16 text-center text-slate-500">
                  <span className="text-5xl block mb-2 opacity-50">💳</span>
                  <p className="text-base font-bold text-slate-400">No hay recargas en este estado</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* PESTAÑA 4: MENÚ Y PRECIOS                                */}
        {/* ======================================================== */}
        {tabActiva === 'menu' && (
          <div className="space-y-6">
            {/* Header del catálogo con botón agregar */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                {/* Buscador */}
                <input
                  type="text"
                  placeholder="Buscar en el menú..."
                  value={busquedaMenu}
                  onChange={(e) => setBusquedaMenu(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 w-52"
                />

                {/* Filtro categoría */}
                <select
                  value={filtroCategoriaMenu}
                  onChange={(e) => setFiltroCategoriaMenu(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="TODAS">Todas las Categorías</option>
                  {CATEGORIAS_CAFETERIA.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => setModalProducto({ isEdit: false, data: null })}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-4 py-2 rounded-xl text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all self-start sm:self-auto"
              >
                <span>➕</span>
                <span>Nuevo Producto</span>
              </button>
            </div>

            {/* Listado de Productos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {productos
                .filter(p => filtroCategoriaMenu === 'TODAS' || p.categoria === filtroCategoriaMenu)
                .filter(p => !busquedaMenu.trim() || p.nombre.toLowerCase().includes(busquedaMenu.toLowerCase()))
                .map(prod => (
                  <div
                    key={prod.idProducto}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col justify-between group"
                  >
                    <div>
                      {/* Imagen con badge */}
                      <div className="w-full h-36 bg-slate-950 rounded-xl overflow-hidden mb-3 relative flex items-center justify-center border border-slate-800">
                        {prod.imagenUrl ? (
                          <img
                            src={prod.imagenUrl}
                            alt={prod.nombre}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        ) : (
                          <span className="text-4xl opacity-50">🍔</span>
                        )}
                        <span className="absolute top-2 left-2 text-[10px] bg-slate-950/80 backdrop-blur font-bold px-2 py-0.5 rounded text-slate-300 border border-slate-800">
                          {prod.categoria}
                        </span>
                      </div>

                      {/* Info */}
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="font-black text-white text-sm line-clamp-1">{prod.nombre}</div>
                        <div className="text-sm font-black font-mono text-amber-400 whitespace-nowrap">
                          S/ {Number(prod.precio || 0).toFixed(2)}
                        </div>
                      </div>

                      <p className="text-xs text-slate-400 line-clamp-2 mb-3">
                        {prod.descripcion || 'Sin descripción detallada.'}
                      </p>
                    </div>

                    {/* Controles: Switch 'En Menú Hoy' y Acciones */}
                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      {/* Switch menú hoy */}
                      <button
                        onClick={() => handleToggleMenuHoy(prod)}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1.5 ${
                          prod.enMenuHoy !== false
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : 'bg-slate-800 text-slate-500 border-slate-700'
                        }`}
                      >
                        <span>{prod.enMenuHoy !== false ? '🟢' : '⚪'}</span>
                        <span>{prod.enMenuHoy !== false ? 'En Menú Hoy' : 'Oculto'}</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setModalProducto({ isEdit: true, data: prod })}
                          className="text-xs text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800"
                          title="Editar producto"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleEliminarProducto(prod)}
                          className="text-xs text-rose-400 hover:text-rose-300 p-1.5 rounded-lg hover:bg-slate-800"
                          title="Eliminar producto"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* PESTAÑA 5: SALDOS DE ALUMNOS Y AJUSTES MANUALES          */}
        {/* ======================================================== */}
        {tabActiva === 'saldos' && (
          <div className="space-y-6">
            {/* Buscador de Alumnos */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="relative w-full sm:w-80">
                <input
                  type="text"
                  placeholder="🔍 Buscar por DNI o Nombres..."
                  value={busquedaSaldo}
                  onChange={(e) => setBusquedaSaldo(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="text-xs text-slate-400">
                Total de Alumnos con Billetera: <span className="font-bold text-white">{saldosLista.length}</span>
              </div>
            </div>

            {/* Tabla de Saldos */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase font-bold text-[10px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">DNI</th>
                      <th className="py-3 px-4">Estudiante</th>
                      <th className="py-3 px-4">Grado</th>
                      <th className="py-3 px-4 text-right">Saldo Actual</th>
                      <th className="py-3 px-4 text-right">Total Recargas</th>
                      <th className="py-3 px-4 text-right">Total Consumido</th>
                      <th className="py-3 px-4 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {saldosLista
                      .filter(s => {
                        const q = busquedaSaldo.toLowerCase().trim();
                        if (!q) return true;
                        return (s.nombres && s.nombres.toLowerCase().includes(q)) || (s.dni && String(s.dni).includes(q));
                      })
                      .map(s => (
                        <tr key={s.dni} className="hover:bg-slate-800/50 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-400">{s.dni}</td>
                          <td className="py-3 px-4 font-bold text-white">{s.nombres}</td>
                          <td className="py-3 px-4 text-slate-400">{s.grado}</td>
                          <td className="py-3 px-4 text-right font-mono font-black text-sm text-amber-400">
                            S/ {Number(s.saldoActual || 0).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-emerald-400">
                            S/ {Number(s.totalRecargado || 0).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-400">
                            S/ {Number(s.totalConsumido || 0).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => setModalAjuste({
                                dni: s.dni,
                                nombres: s.nombres,
                                saldoActual: Number(s.saldoActual || 0)
                              })}
                              className="bg-slate-800 hover:bg-slate-700 text-amber-300 px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors"
                            >
                              ⚙️ Ajustar Saldo
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* PESTAÑA 6: REPORTES DE DIRECCIÓN                         */}
        {/* ======================================================== */}
        {tabActiva === 'reportes' && (
          <div className="space-y-6">
            {/* Selector de Periodo */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                {['HOY', 'SEMANA', 'MES', 'TODO'].map(p => (
                  <button
                    key={p}
                    onClick={() => setPeriodoReporte(p)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      periodoReporte === p ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {p === 'HOY' ? '📅 Hoy' : p === 'SEMANA' ? '📆 Esta Semana' : p === 'MES' ? '🗓️ Este Mes' : '📚 Histórico Total'}
                  </button>
                ))}
              </div>

              <button
                onClick={cargarReporte}
                className="bg-slate-800 hover:bg-slate-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto"
              >
                <span>🔄</span>
                <span>Actualizar Datos</span>
              </button>
            </div>

            {/* Tarjetas KPI */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Ventas Totales</div>
                <div className="text-3xl font-black font-mono text-emerald-400">
                  S/ {Number(datosReporte ? datosReporte.ventasTotales || 0 : 0).toFixed(2)}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {datosReporte ? datosReporte.cantidadVentas || 0 : 0} transacciones registradas
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Recargas Yape Aprobadas</div>
                <div className="text-3xl font-black font-mono text-amber-400">
                  S/ {Number(datosReporte ? datosReporte.recargasAprobadasMonto || 0 : 0).toFixed(2)}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {datosReporte ? datosReporte.recargasAprobadasCount || 0 : 0} recargas procesadas
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Saldo Total en Custodia</div>
                <div className="text-3xl font-black font-mono text-blue-400">
                  S/ {Number(datosReporte ? datosReporte.saldoTotalCustodia || 0 : 0).toFixed(2)}
                </div>
                <div className="text-xs text-slate-500 mt-1">Billeteras activas de estudiantes</div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Yapes Pendientes</div>
                <div className="text-3xl font-black font-mono text-rose-400">
                  {datosReporte ? datosReporte.recargasPendientesCount || 0 : 0}
                </div>
                <div className="text-xs text-slate-500 mt-1">Por verificar en bandeja</div>
              </div>
            </div>

            {/* Arqueo por Método de Pago */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <h3 className="text-base font-extrabold text-white mb-4 flex items-center gap-2">
                <span>💵</span>
                <span>Arqueo de Ventas por Método de Pago ({periodoReporte})</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <div className="text-xs text-amber-400 font-bold mb-1">💳 Saldo Estudiante (Billetera)</div>
                  <div className="text-2xl font-black font-mono text-white">
                    S/ {Number(datosReporte && datosReporte.desgloseMetodos ? datosReporte.desgloseMetodos.SALDO_ESTUDIANTE || 0 : 0).toFixed(2)}
                  </div>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <div className="text-xs text-emerald-400 font-bold mb-1">💵 Efectivo en Caja</div>
                  <div className="text-2xl font-black font-mono text-white">
                    S/ {Number(datosReporte && datosReporte.desgloseMetodos ? datosReporte.desgloseMetodos.EFECTIVO || 0 : 0).toFixed(2)}
                  </div>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <div className="text-xs text-purple-400 font-bold mb-1">📱 Yape Directo en Caja</div>
                  <div className="text-2xl font-black font-mono text-white">
                    S/ {Number(datosReporte && datosReporte.desgloseMetodos ? datosReporte.desgloseMetodos.YAPE_DIRECTO || 0 : 0).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* MODAL: VER COMPROBANTE YAPE                              */}
      {/* ======================================================== */}
      {modalComprobante && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-4 overflow-hidden relative shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <h3 className="font-bold text-white text-sm">Comprobante de Transferencia Yape</h3>
              <button
                onClick={() => setModalComprobante(null)}
                className="text-slate-400 hover:text-white font-black text-sm p-1"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center p-2">
              <img src={modalComprobante} alt="Voucher" className="max-w-full h-auto rounded-lg" />
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CREAR / EDITAR PRODUCTO                           */}
      {/* ======================================================== */}
      {modalProducto && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 relative shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="font-bold text-white text-base">
                {modalProducto.isEdit ? 'Editar Producto del Menú' : 'Nuevo Producto para la Cafetería'}
              </h3>
              <button
                onClick={() => setModalProducto(null)}
                className="text-slate-400 hover:text-white font-black text-sm p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGuardarProductoSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Nombre del Producto *</label>
                <input
                  type="text"
                  name="nombre"
                  defaultValue={modalProducto.data ? modalProducto.data.nombre : ''}
                  required
                  placeholder="Ej: Sándwich de Pollo Especial"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Categoría *</label>
                  <select
                    name="categoria"
                    defaultValue={modalProducto.data ? modalProducto.data.categoria : CATEGORIAS_CAFETERIA[0]}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    {CATEGORIAS_CAFETERIA.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Precio (S/) *</label>
                  <input
                    type="number"
                    name="precio"
                    step="0.10"
                    min="0"
                    defaultValue={modalProducto.data ? modalProducto.data.precio : ''}
                    required
                    placeholder="3.50"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Unidad</label>
                  <input
                    type="text"
                    name="unidad"
                    defaultValue={modalProducto.data ? modalProducto.data.unidad : 'Unidad'}
                    placeholder="Porción, Vaso, Unidad..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="enMenuHoy"
                      defaultChecked={modalProducto.data ? modalProducto.data.enMenuHoy !== false : true}
                      className="w-4 h-4 text-amber-500 rounded bg-slate-950 border-slate-700 focus:ring-amber-500"
                    />
                    <span className="text-xs font-bold text-slate-300">¿Incluir en menú hoy?</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Descripción</label>
                <textarea
                  name="descripcion"
                  defaultValue={modalProducto.data ? modalProducto.data.descripcion : ''}
                  rows="2"
                  placeholder="Ingredientes o detalles para los padres y alumnos..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                ></textarea>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Foto del Alimento (Opcional)</label>
                <input
                  type="file"
                  name="imagen"
                  accept="image/*"
                  className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-800 file:text-slate-300 hover:file:bg-slate-700"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalProducto(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black shadow-lg shadow-amber-500/20"
                >
                  Guardar Producto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: AJUSTE MANUAL DE SALDO                            */}
      {/* ======================================================== */}
      {modalAjuste && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 relative shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div>
                <h3 className="font-bold text-white text-base">Ajuste Manual de Saldo</h3>
                <p className="text-xs text-slate-400">{modalAjuste.nombres} (DNI: {modalAjuste.dni})</p>
              </div>
              <button
                onClick={() => setModalAjuste(null)}
                className="text-slate-400 hover:text-white font-black text-sm p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGuardarAjusteManual} className="space-y-4">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                <span className="text-xs text-slate-400 font-bold">Saldo Actual:</span>
                <span className="text-base font-black font-mono text-amber-400">
                  S/ {modalAjuste.saldoActual.toFixed(2)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTipoAjuste('AUMENTAR')}
                  className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                    tipoAjuste === 'AUMENTAR'
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  ➕ Aumentar Saldo
                </button>
                <button
                  type="button"
                  onClick={() => setTipoAjuste('DISMINUIR')}
                  className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                    tipoAjuste === 'DISMINUIR'
                      ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  ➖ Disminuir Saldo
                </button>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Monto a Ajustar (S/) *</label>
                <input
                  type="number"
                  step="0.10"
                  min="0.10"
                  value={montoAjuste}
                  onChange={(e) => setMontoAjuste(e.target.value)}
                  required
                  placeholder="Ej: 5.00"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Motivo del Ajuste (Obligatorio) *</label>
                <input
                  type="text"
                  value={motivoAjuste}
                  onChange={(e) => setMotivoAjuste(e.target.value)}
                  required
                  placeholder="Ej: Devolución autorizada, corrección de recarga..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Autorizado Por</label>
                <input
                  type="text"
                  value={autorizadoPor}
                  onChange={(e) => setAutorizadoPor(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalAjuste(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black shadow-lg shadow-amber-500/20"
                >
                  Aplicar Ajuste
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: QR OFICIAL DE YAPE PARA COBRO O IMPRESIÓN         */}
      {/* ======================================================== */}
      {mostrarModalQRYape && (
        <div 
          onClick={() => setMostrarModalQRYape(false)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-[#6B1E87] border border-purple-400/40 rounded-3xl max-w-sm w-full p-6 text-center text-white shadow-2xl relative flex flex-col items-center"
          >
            <button
              onClick={() => setMostrarModalQRYape(false)}
              className="absolute top-4 right-4 text-purple-200 hover:text-white font-black text-sm p-1 rounded-lg"
            >
              ✕
            </button>

            <div className="text-xs font-black uppercase tracking-wider text-purple-200 mb-1 flex items-center gap-1.5">
              <span>💜</span>
              <span>Código QR Oficial de Yape</span>
            </div>

            <div className="bg-white p-3 rounded-2xl shadow-inner my-3 max-w-[220px]">
              <img 
                src="/qr-yape.jpg" 
                alt="QR Yape - Juan Fernando Elias Medina" 
                className="w-full h-auto rounded-xl object-contain shadow-sm"
              />
            </div>

            <div className="text-xs text-purple-200 mt-1">Titular de la Cuenta:</div>
            <div className="text-base font-extrabold text-white">Juan Fernando Elias Medina</div>
            <div className="text-xs text-purple-200/80 mt-0.5">Cafetería Escolar · IEP Millenium</div>

            <div className="mt-4 pt-3 border-t border-purple-400/30 w-full flex items-center justify-center gap-2">
              <a
                href="/qr-yape.jpg"
                download="qr-yape-cafeteria-millenium.jpg"
                className="bg-white hover:bg-purple-50 text-purple-950 font-black px-4 py-2 rounded-xl text-xs shadow-md transition-all inline-flex items-center gap-1.5"
              >
                <span>📥</span>
                <span>Descargar / Imprimir</span>
              </a>
              <button
                type="button"
                onClick={() => setMostrarModalQRYape(false)}
                className="bg-purple-900/50 hover:bg-purple-900/80 text-purple-200 font-bold px-3 py-2 rounded-xl text-xs transition-all"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
