/**
 * ============================================================
 * Qr Asistencia - API Backend (Versión Corregida y Unificada)
 * IEP MILLENIUM
 * ============================================================
 */

// ------------------------------------------------------------
// CONFIGURACIÓN GLOBAL
// ------------------------------------------------------------
const SPREADSHEET_ID = '1S78EzSmPc7jlyd0_hKzaUSPGaCL45_ZOaivyNft_t-A';
const HOJA_ESTUDIANTES = 'BD_Estudiantes';
const HOJA_REGISTRO = 'Registro_Diario';
const HOJA_JUSTIFICACIONES = 'Justificaciones';
const HOJA_CALENDARIO = 'CALENDARIO_ANUAL';
const HOJA_DOCENTES = 'BD_Docentes';
const HOJA_TAREAS = 'Tareas_Escolares';
const HOJA_COMUNICADOS = 'Comunicados_Escolares';
const HOJA_CAFETERIA_PRODUCTOS = 'Cafeteria_Productos';
const HOJA_CAFETERIA_SALDOS = 'Cafeteria_Saldos';
const HOJA_CAFETERIA_RECARGAS = 'Cafeteria_Recargas';
const HOJA_CAFETERIA_VENTAS = 'Cafeteria_Ventas';
const HOJA_CAFETERIA_PEDIDOS = 'Cafeteria_Pedidos';

// --- API DE WHATSAPP (META CLOUD API) ---
// IMPORTANTE: Recuerda pegar aquí tu token real de Meta
const META_API_TOKEN = 'PEGA_AQUI_TU_TOKEN_DE_ACCESO_TEMPORAL'; 
const META_PHONE_ID = '1234134843119386'; // Tu Phone Number ID

// ------------------------------------------------------------
// MANEJADORES DE PETICIONES (GET Y POST) - EL "MOTOR"
// ------------------------------------------------------------

function doGet(e) {
  try {
    const action = e.parameter.action || 'dashboard';

    if (action === 'dashboard') {
      return jsonResponse(obtenerDashboard(e.parameter.meses));
    }
    
    if (action === 'buscar_estudiante') {
      const dni = String(e.parameter.dni || '').trim();
      if (!/^\d{8}$/.test(dni)) {
        return jsonResponse({ success: false, message: 'El DNI debe tener 8 dígitos.' });
      }
      const estudiante = buscarEstudiante(dni);
      if (!estudiante) {
        return jsonResponse({ success: false, message: 'Estudiante no encontrado.' });
      }
      return jsonResponse({ success: true, estudiante: estudiante });
    }

    if (action === 'consulta_padre') {
      const dni = String(e.parameter.dni || '').trim();
      if (!/^\d{8}$/.test(dni)) {
        return jsonResponse({ success: false, message: 'El DNI debe tener 8 digitos.' });
      }
      const estudiante = buscarEstudiante(dni);
      if (!estudiante) {
        return jsonResponse({ success: false, message: 'Estudiante no encontrado. Verifique el DNI.' });
      }
      return jsonResponse(obtenerHistorialPadre(dni, estudiante));
    }

    if (action === 'estudiantes') {
      return jsonResponse(obtenerEstudiantes());
    }

    if (action === 'estudiantes_por_grado') {
      const grado = String(e.parameter.grado || '').trim();
      if (!grado) return jsonResponse({ success: false, message: 'Debe indicar un grado.' });
      return jsonResponse(obtenerEstudiantesPorGrado(grado));
    }

    if (action === 'asistencia_dia') {
      const fecha = String(e.parameter.fecha || '').trim();
      if (!fecha) return jsonResponse({ success: false, message: 'Debe indicar una fecha.' });
      return jsonResponse(obtenerAsistenciaDia(fecha));
    }

    if (action === 'grados_disponibles') {
      return jsonResponse(obtenerGradosDisponibles());
    }

    if (action === 'login_docente') {
      const dni = String(e.parameter.dni || '').trim();
      return jsonResponse(verificarDocente(dni));
    }

    if (action === 'obtener_justificaciones') {
      return jsonResponse(obtenerJustificacionesGAS());
    }

    if (action === 'obtener_tareas') {
      const grado = String(e.parameter.grado || '').trim();
      const dniDocente = String(e.parameter.dniDocente || '').trim();
      return jsonResponse(obtenerTareas(grado, dniDocente));
    }

    if (action === 'obtener_comunicados') {
      const grado = String(e.parameter.grado || '').trim();
      return jsonResponse(obtenerComunicados(grado));
    }

    // --- ACCIONES DE CAFETERÍA (GET) ---
    if (action === 'cafeteria_productos') {
      const soloMenuHoy = e.parameter.soloMenuHoy === 'true';
      return jsonResponse(obtenerProductosCafeteria(soloMenuHoy));
    }

    if (action === 'cafeteria_historial_estudiante') {
      const dni = String(e.parameter.dni || '').trim();
      if (!dni) return jsonResponse({ success: false, message: 'DNI requerido' });
      return jsonResponse(obtenerHistorialEstudianteCafeteria(dni));
    }

    if (action === 'cafeteria_saldos') {
      return jsonResponse(obtenerSaldosCafeteria());
    }

    if (action === 'cafeteria_recargas') {
      const estado = String(e.parameter.estado || '').trim();
      return jsonResponse(obtenerRecargasCafeteria(estado));
    }

    if (action === 'cafeteria_pedidos') {
      const fecha = String(e.parameter.fecha || '').trim();
      const estado = String(e.parameter.estado || '').trim();
      return jsonResponse(obtenerPedidosCafeteria(fecha, estado));
    }

    if (action === 'cafeteria_reporte') {
      const periodo = String(e.parameter.periodo || 'HOY').toUpperCase();
      return jsonResponse(obtenerReporteCafeteria(periodo));
    }

    if (action === 'test_drive') {
      return jsonResponse(subirArchivoADrive('JVBERi0xLjQK', 'prueba_autorizacion.pdf', 'application/pdf'));
    }

    return jsonResponse({ success: false, message: 'Acción no válida' });

  } catch (error) {
    return jsonResponse({ success: false, message: 'Error en el servidor: ' + error.message });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    // Espera segura de hasta 10 segundos para concurrencia perfecta con múltiples lectores QR simultáneos
    lock.waitLock(10000);
    const data = JSON.parse(e.postData.contents || '{}');
    const action = data.action;
    const dni = String(data.dni || '').trim();

    if (action === 'justificar') {
      const fechaReq = normalizarFechaGAS(data.fecha);
      const motivo = data.motivo;
      if (!/^\d{8}$/.test(dni)) return jsonResponse({ success: false, message: 'DNI inválido.' });
      if (!fechaReq || !motivo) return jsonResponse({ success: false, message: 'Datos incompletos.' });
      
      const estudiante = buscarEstudiante(dni);
      if (!estudiante) return jsonResponse({ success: false, message: 'Estudiante no encontrado.' });
      
      const hojaJustificaciones = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(HOJA_JUSTIFICACIONES);
      // Prefijo con apóstrofe para forzar tipo TEXTO y evitar que Google Sheets invierta día/mes
      hojaJustificaciones.appendRow(["'" + fechaReq, "'" + dni, motivo]);
      SpreadsheetApp.flush();
      
      return jsonResponse({
        success: true,
        message: 'Permiso/Justificación registrada correctamente',
        estudiante
      });
    }

    if (action === 'eliminar_justificacion') {
      const fechaReq = normalizarFechaGAS(data.fecha);
      const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      const hojaJustificaciones = ss.getSheetByName(HOJA_JUSTIFICACIONES);
      if (!hojaJustificaciones) return jsonResponse({ success: false, message: 'Hoja de justificaciones no encontrada.' });
      
      const ultFila = hojaJustificaciones.getLastRow();
      if (ultFila <= 1) return jsonResponse({ success: false, message: 'No hay justificaciones para eliminar.' });
      
      const datos = hojaJustificaciones.getRange(1, 1, ultFila, 2).getDisplayValues();
      let filaEliminada = -1;
      for (let i = 1; i < datos.length; i++) {
        const fStr = normalizarFechaGAS(datos[i][0]);
        const dStr = String(datos[i][1]).trim();
        if (dStr === dni && (fStr === fechaReq || !fechaReq)) {
          filaEliminada = i + 1;
          break;
        }
      }
      if (filaEliminada !== -1) {
        hojaJustificaciones.deleteRow(filaEliminada);
        SpreadsheetApp.flush();
        return jsonResponse({ success: true, message: 'Justificación eliminada correctamente.' });
      }
      return jsonResponse({ success: false, message: 'No se encontró la justificación para eliminar.' });
    }

    if (action === 'registrar_manual_lote') {
      return jsonResponse(registrarManualLote(data));
    }

    if (action === 'registrar_tarea') {
      return jsonResponse(registrarTarea(data));
    }

    if (action === 'finalizar_tarea') {
      return jsonResponse(cambiarEstadoTarea(data.idTarea, 'Finalizada'));
    }

    if (action === 'eliminar_tarea') {
      return jsonResponse(eliminarTarea(data.idTarea));
    }

    if (action === 'registrar_comunicado') {
      return jsonResponse(registrarComunicado(data));
    }

    if (action === 'cambiar_estado_comunicado') {
      return jsonResponse(cambiarEstadoComunicado(data.idComunicado, data.nuevoEstado));
    }

    if (action === 'eliminar_comunicado') {
      return jsonResponse(eliminarComunicado(data.idComunicado));
    }

    // --- ACCIONES DE CAFETERÍA (POST) ---
    if (action === 'cafeteria_guardar_producto') {
      return jsonResponse(guardarProductoCafeteria(data));
    }

    if (action === 'cafeteria_eliminar_producto') {
      return jsonResponse(eliminarProductoCafeteria(data.idProducto));
    }

    if (action === 'cafeteria_toggle_menu_hoy') {
      return jsonResponse(toggleMenuHoyProducto(data.idProducto, data.enMenuHoy));
    }

    if (action === 'cafeteria_reportar_recarga') {
      return jsonResponse(reportarRecargaYape(data));
    }

    if (action === 'cafeteria_procesar_recarga') {
      return jsonResponse(procesarRecargaYape(data.idRecarga, data.accion, data.validadoPor, data.motivoRechazo));
    }

    if (action === 'cafeteria_ajustar_saldo_manual') {
      return jsonResponse(ajustarSaldoManual(data));
    }

    if (action === 'cafeteria_registrar_venta') {
      return jsonResponse(registrarVentaCaja(data));
    }

    if (action === 'cafeteria_registrar_pedido') {
      return jsonResponse(registrarPedidoPadre(data));
    }

    if (action === 'cafeteria_cambiar_estado_pedido') {
      return jsonResponse(cambiarEstadoPedido(data.idPedido, data.nuevoEstado));
    }

    if (action === 'cafeteria_eliminar_pedido') {
      return jsonResponse(eliminarPedidoCafeteria(data.idPedido, data.reembolsar));
    }

    if (action === 'cafeteria_resetear_datos_prueba') {
      return jsonResponse(resetearDatosPruebaCafeteria(data.confirmacion));
    }

    if (action !== 'registrar') {
      return jsonResponse({ success: false, message: 'Acción no válida para POST.' });
    }
    if (!/^\d{8}$/.test(dni)) {
      return jsonResponse({ success: false, message: 'El DNI debe contener 8 dígitos numéricos.' });
    }

    const tipo = String(data.tipo || 'entrada').toLowerCase();
    const SCRIPT_PROPERTIES = PropertiesService.getScriptProperties();
    const hoy = new Date();
    const tz = Session.getScriptTimeZone() || 'America/Lima';
    const fechaKey = Utilities.formatDate(hoy, tz, 'yyyy-MM-dd');
    const ahora = new Date();
    const fecha = Utilities.formatDate(ahora, tz, 'dd/MM/yyyy');
    const hora = Utilities.formatDate(ahora, tz, 'HH:mm:ss');

    const estudiante = buscarEstudiante(dni);
    if (!estudiante) {
      return jsonResponse({ success: false, message: 'Estudiante no encontrado con el DNI proporcionado.' });
    }

    const hoja = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(HOJA_REGISTRO);
    const ultFilaR = hoja.getLastRow();
    const ultColR = Math.max(hoja.getLastColumn(), 9);

    // --- REGISTRO DE SALIDA ---
    if (tipo === 'salida') {
      const propertyKeySalida = 'salida_' + dni + '_' + fechaKey;
      if (SCRIPT_PROPERTIES.getProperty(propertyKeySalida)) {
        return jsonResponse({
          success: false,
          duplicate: true,
          tipo: 'salida',
          message: 'La salida de este estudiante ya fue registrada hoy.',
          estudiante: estudiante
        });
      }

      // Buscar si el estudiante ya tiene fila de ingreso registrada hoy (desde el final hacia arriba)
      let filaEncontrada = -1;
      let horaIngreso = '--:--';
      let estadoIngreso = 'Asistió';

      if (ultFilaR > 1) {
        const valores = hoja.getRange(2, 1, ultFilaR - 1, ultColR).getDisplayValues();
        for (let i = valores.length - 1; i >= 0; i--) {
          const fFila = String(valores[i][0] || '').replace(/['"]/g, '').trim();
          const dFila = String(valores[i][2] || '').trim();
          if (fFila === fecha && dFila === dni) {
            filaEncontrada = i + 2; // +2 por encabezado y 1-based index
            horaIngreso = valores[i][1] || '--:--';
            estadoIngreso = valores[i][4] || 'Asistió';
            break;
          }
        }
      }

      if (filaEncontrada !== -1) {
        // Columna I (columna 9) para Hora_Salida
        hoja.getRange(filaEncontrada, 9).setValue(hora);
        SpreadsheetApp.flush();
      } else {
        // Si no escaneó ingreso en la mañana, registrarlo con salida
        hoja.appendRow(["'" + fecha, '--:--', dni, estudiante.nombre, 'Asistió', '', '', '', hora]);
        SpreadsheetApp.flush();
      }

      SCRIPT_PROPERTIES.setProperty(propertyKeySalida, hora);

      return jsonResponse({
        success: true,
        tipo: 'salida',
        message: '👋 Salida registrada correctamente',
        estudiante,
        asistencia: { fecha, hora: horaIngreso, horaSalida: hora, estado: estadoIngreso }
      });
    }

    // --- REGISTRO DE ENTRADA ---
    const propertyKeyEntrada = 'asistencia_' + dni + '_' + fechaKey;
    if (SCRIPT_PROPERTIES.getProperty(propertyKeyEntrada)) {
      return jsonResponse({
        success: false,
        duplicate: true,
        tipo: 'entrada',
        message: 'La entrada para este estudiante ya fue registrada hoy.',
        estudiante: estudiante
      });
    }

    const estado = calcularEstado(ahora, estudiante.nivel);
    hoja.appendRow(["'" + fecha, hora, dni, estudiante.nombre, estado, '', '', '', '--:--']);
    SpreadsheetApp.flush();

    SCRIPT_PROPERTIES.setProperty(propertyKeyEntrada, 'registrado');

    let whatsappEnviado = false;
    if (estudiante.celular && META_API_TOKEN !== 'PEGA_AQUI_TU_TOKEN_DE_ACCESO_TEMPORAL') {
      try {
        const url = 'https://graph.facebook.com/v25.0/' + META_PHONE_ID + '/messages';
        const celularLimpio = String(estudiante.celular).replace(/\D/g, ''); const numeroDestino = celularLimpio.startsWith('51') ? celularLimpio : '51' + celularLimpio;
        const payload = {
          "messaging_product": "whatsapp",
          "to": numeroDestino,
          "type": "template",
          "template": { 
            "name": "asistencia", 
            "language": { "code": "es" }, 
            "components": [
              { 
                "type": "body", 
                "parameters": [
                  { "type": "text", "text": estudiante.nombre }, 
                  { "type": "text", "text": estado }, 
                  { "type": "text", "text": fecha }
                ] 
              }
            ] 
          }
        };

        const opciones = {
          "method": "post",
          "headers": {
            "Authorization": "Bearer " + META_API_TOKEN,
            "Content-Type": "application/json"
          },
          "payload": JSON.stringify(payload),
          "muteHttpExceptions": true
        };
        
        const res = UrlFetchApp.fetch(url, opciones);
        if (res.getResponseCode() === 200 || res.getResponseCode() === 201) {
          whatsappEnviado = true;
        } else {
          const errorMsg = res.getContentText();
          console.error('Meta API Error: ' + errorMsg);
          hoja.getRange(hoja.getLastRow(), 6).setValue('Error Meta: ' + errorMsg);
        }
      } catch (error) {
        console.error('Error al enviar WhatsApp (Meta): ', error);
        hoja.getRange(hoja.getLastRow(), 6).setValue('Error script: ' + error.message);
      }
    } else if (!estudiante.celular) {
      hoja.getRange(hoja.getLastRow(), 6).setValue('Sin número de celular');
    }

    return jsonResponse({
      success: true,
      message: (estado === 'Asistio' || estado === 'Asistió') ? 'Asistencia registrada correctamente' : (estado === 'Tardanza' ? 'Se registró una TARDANZA' : 'Se registró como FALTA'),
      estudiante,
      asistencia: { fecha, hora, estado },
      whatsapp: whatsappEnviado
    });

  } catch (error) {
    return jsonResponse({ success: false, message: 'Error en el servidor: ' + error.message });
  } finally {
    try {
      lock.releaseLock();
    } catch (eLock) {}
  }
}

// ------------------------------------------------------------
// FUNCIONES DE LÓGICA DE NEGOCIO Y CACHÉ
// ------------------------------------------------------------

const CACHE_KEY_ESTUDIANTES = 'estudiantes_cache';

function actualizarCacheEstudiantes() {
  const hojaEstudiantes = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(HOJA_ESTUDIANTES);
  const ultFila = hojaEstudiantes.getLastRow();
  const ultCol = hojaEstudiantes.getLastColumn();
  const datos = ultFila > 0 && ultCol > 0 ? hojaEstudiantes.getRange(1, 1, ultFila, ultCol).getValues() : [];
  const estudiantesObj = {};

  if (datos.length > 1) {
    const headers = datos[0].map(h => String(h).trim().toLowerCase());
    const cDNI = headers.indexOf('dni');
    const cNombre = headers.indexOf('nombre');
    const cGrado = headers.indexOf('grado');
    const cNivel = headers.indexOf('nivel');
    const cCelular = headers.indexOf('celular');

    if (cDNI !== -1) {
      for (let i = 1; i < datos.length; i++) {
        const fila = datos[i];
        const dni = String(fila[cDNI]).trim();
        if (dni) {
          estudiantesObj[dni] = {
            dni: dni,
            nombre: cNombre !== -1 ? fila[cNombre] : '',
            grado: cGrado !== -1 ? fila[cGrado] : '',
            nivel: cNivel !== -1 ? fila[cNivel] : '',
            celular: cCelular !== -1 ? String(fila[cCelular] || '').trim() : ''
          };
        }
      }
    }
  }

  return estudiantesObj;
}

function buscarEstudiante(dni) {
  const estudiantes = actualizarCacheEstudiantes();
  return estudiantes[dni] || null;
}

function calcularEstado(fechaHora, nivel) {
  const minutosDelDia = fechaHora.getHours() * 60 + fechaHora.getMinutes();
  
  // NIVEL PRIMARIA
  // Ingreso oficial: 7:30 AM
  // Tolerancia 10 min: hasta las 7:40 AM (460 min) -> 'Asistió'
  // Tardanza: de 7:41 AM hasta las 8:15 AM (495 min) -> 'Tardanza'
  // Después de las 8:15 AM (> 495 min) -> 'Falta'
  if (String(nivel).toLowerCase().includes('primaria')) {
    if (minutosDelDia <= 460) return 'Asistió';
    if (minutosDelDia <= 495) return 'Tardanza';
    return 'Falta';
  }
  
  // NIVEL SECUNDARIA
  // Ingreso oficial: 1:30 PM (13:30)
  // Tolerancia 10 min: hasta las 1:40 PM / 13:40 (820 min) -> 'Asistió'
  // Tardanza: de 1:41 PM hasta las 2:15 PM / 14:15 (855 min) -> 'Tardanza'
  // Después de las 2:15 PM (> 855 min) -> 'Falta'
  if (String(nivel).toLowerCase().includes('secundaria')) {
    if (minutosDelDia <= 820) return 'Asistió';
    if (minutosDelDia <= 855) return 'Tardanza';
    return 'Falta';
  }
  
  return 'Falta';
}

function obtenerHistorialPadre(dni, estudiante) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const tz = Session.getScriptTimeZone() || 'America/Lima';

  // Leer justificaciones registradas usando getDisplayValues para no perder formato DD/MM/YYYY
  const hojaJ = ss.getSheetByName(HOJA_JUSTIFICACIONES);
  const ultFilaJ = hojaJ ? hojaJ.getLastRow() : 0;
  const ultColJ = hojaJ ? hojaJ.getLastColumn() : 0;
  const datosJ = ultFilaJ > 1 ? hojaJ.getRange(2, 1, ultFilaJ - 1, ultColJ).getDisplayValues() : [];
  const mapJ = {};
  for (let j = 0; j < datosJ.length; j++) {
    const fDate = normalizarFechaGAS(datosJ[j][0]);
    const d = String(datosJ[j][1] || '').trim();
    if (d === dni) {
      mapJ[fDate] = String(datosJ[j][2] || 'Permiso justificado').trim();
    }
  }

  const hojaRegistro = ss.getSheetByName(HOJA_REGISTRO);
  const ultFilaR = hojaRegistro.getLastRow();
  const ultColR = hojaRegistro.getLastColumn();
  const registrosDatos = ultFilaR > 1 ? hojaRegistro.getRange(2, 1, ultFilaR - 1, ultColR).getDisplayValues() : [];

  const headers = hojaRegistro.getRange(1, 1, 1, ultColR).getValues()[0].map(h => String(h).trim().toLowerCase());
  const cDNI = headers.indexOf('dni');
  const cFecha = headers.indexOf('fecha');
  const cHora = headers.indexOf('hora');
  const cEstado = headers.indexOf('estado');

  const historial = [];
  const fechasRegistradas = {};
  let faltas = 0;
  let tardanzas = 0;
  let asistencias = 0;
  let justificados = 0;

  if (cDNI !== -1) {
    for (let i = 0; i < registrosDatos.length; i++) {
      const fila = registrosDatos[i];
      if (String(fila[cDNI]).trim() === dni) {
        let estado = String(fila[cEstado] || '').trim();
        const fecha = normalizarFechaGAS(fila[cFecha]);
        fechasRegistradas[fecha] = true;
        let motivo = '';

        if (mapJ[fecha]) {
          estado = 'Justificado';
          motivo = mapJ[fecha];
        }

        let hora = '';
        if (fila[cHora] instanceof Date) {
          hora = Utilities.formatDate(fila[cHora], tz, 'HH:mm:ss');
        } else {
          hora = String(fila[cHora] || '').trim();
          if (hora.includes('1899')) {
             const match = hora.match(/\d{2}:\d{2}:\d{2}/);
             if (match) hora = match[0];
          }
        }

        const horaSalida = (fila[8] && String(fila[8]).trim() !== '' && String(fila[8]).trim() !== 'null') ? String(fila[8]).trim() : '--:--';
        historial.push({
          fecha: fecha,
          hora: hora,
          horaSalida: horaSalida,
          estado: estado,
          motivo: motivo
        });

        if (estado === 'Justificado') justificados++;
        else if (estado.includes('Asisti') || estado.includes('Asistió')) asistencias++;
        else if (estado === 'Tardanza') tardanzas++;
        else if (estado === 'Falta') faltas++;
      }
    }
  }

  // Agregar fechas con justificación donde el estudiante no asistió y no tiene fila en Registro_Diario
  for (const fJustif in mapJ) {
    if (!fechasRegistradas[fJustif]) {
      historial.push({
        fecha: fJustif,
        hora: '--:--',
        horaSalida: '--:--',
        estado: 'Justificado',
        motivo: mapJ[fJustif]
      });
      justificados++;
    }
  }

  // Ordenar el historial por fecha (de más reciente a más antiguo)
  historial.sort((a, b) => {
    const [d1, m1, y1] = a.fecha.split('/');
    const [d2, m2, y2] = b.fecha.split('/');
    const date1 = new Date(y1, m1 - 1, d1).getTime();
    const date2 = new Date(y2, m2 - 1, d2).getTime();
    return date2 - date1;
  });

  return { 
    success: true, 
    estudiante: estudiante,
    estadisticas: {
      asistencias: asistencias,
      tardanzas: tardanzas,
      faltas: faltas,
      justificados: justificados
    },
    historial: historial
  };
}

function obtenerDashboard(meses) {
  meses = Number(meses) || 1;
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  const hojaE = ss.getSheetByName(HOJA_ESTUDIANTES);
  const ultFilaE = hojaE.getLastRow();
  const ultColE = hojaE.getLastColumn();
  const datosEstudiantes = ultFilaE > 0 && ultColE > 0 ? hojaE.getRange(1, 1, ultFilaE, ultColE).getValues() : [];
  const estudiantesTotales = [];
  if (datosEstudiantes.length > 1) {
    const headers = datosEstudiantes[0].map(h => String(h).trim().toLowerCase());
    const cDNI = headers.indexOf('dni');
    const cNombre = headers.indexOf('nombre');
    
    if (cDNI !== -1) {
      for (let i = 1; i < datosEstudiantes.length; i++) {
        if (datosEstudiantes[i][cDNI]) {
          estudiantesTotales.push({
            dni: String(datosEstudiantes[i][cDNI]).trim(),
            nombre: cNombre !== -1 ? datosEstudiantes[i][cNombre] : ''
          });
        }
      }
    }
  }

  const hojaR = ss.getSheetByName(HOJA_REGISTRO);
  const ultFilaR = hojaR.getLastRow();
  const ultColR = hojaR.getLastColumn();
  const datos = ultFilaR > 0 && ultColR > 0 ? hojaR.getRange(1, 1, ultFilaR, ultColR).getDisplayValues() : [];
  const fechaInicio = new Date();
  fechaInicio.setMonth(fechaInicio.getMonth() - meses);
  fechaInicio.setHours(0, 0, 0, 0);

  let asistencias = 0, tardanzas = 0, faltas = 0, justificados = 0;
  const registros = [];
  const registrosPorFecha = {};

  const hojaJ = ss.getSheetByName(HOJA_JUSTIFICACIONES);
  const ultFilaJ = hojaJ ? hojaJ.getLastRow() : 0;
  const ultColJ = hojaJ ? hojaJ.getLastColumn() : 0;
  const datosJustificaciones = ultFilaJ > 1 && ultColJ > 0 ? hojaJ.getRange(2, 1, ultFilaJ - 1, ultColJ).getDisplayValues() : [];
  const mapJustificaciones = {};
  for (let i = 0; i < datosJustificaciones.length; i++) {
    const fDate = normalizarFechaGAS(datosJustificaciones[i][0]);
    const d = String(datosJustificaciones[i][1]).trim();
    if (fDate && d) {
      mapJustificaciones[fDate + '_' + d] = datosJustificaciones[i][2] || 'Justificado';
    }
  }

  for (let i = 1; i < datos.length; i++) {
    const fechaCelda = datos[i][0];
    if (!fechaCelda) continue;
    
    const fechaRegistro = fechaCelda instanceof Date ? fechaCelda : convertirFecha(fechaCelda);
    
    if (fechaRegistro && fechaRegistro >= fechaInicio) {
      const fechaStr = fechaCelda instanceof Date ? Utilities.formatDate(fechaCelda, Session.getScriptTimeZone(), 'dd/MM/yyyy') : String(fechaCelda);
      const horaStr = datos[i][1] instanceof Date ? Utilities.formatDate(datos[i][1], Session.getScriptTimeZone(), 'HH:mm:ss') : String(datos[i][1]);
      const dni = String(datos[i][2]).trim();
      let estado = String(datos[i][4]);
      const keyJust = fechaStr + '_' + dni;
      if (mapJustificaciones[keyJust]) {
        estado = 'Justificado';
      }
      
      const horaSalidaStr = (datos[i][8] && String(datos[i][8]).trim() !== '' && String(datos[i][8]).trim() !== 'null') ? String(datos[i][8]).trim() : '--:--';
      registros.push({
        fecha: fechaStr,
        timestamp: fechaRegistro.getTime(),
        hora: horaStr,
        horaSalida: horaSalidaStr,
        dni: dni,
        nombre: datos[i][3],
        estado: estado
      });
      
      if (!registrosPorFecha[fechaStr]) registrosPorFecha[fechaStr] = new Set();
      registrosPorFecha[fechaStr].add(dni);
      
      if (estado === 'Asistio') asistencias++;
      if (estado === 'Tardanza') tardanzas++;
      if (estado === 'Falta') faltas++; 
      if (estado === 'Justificado') justificados++;
    }
  }

  for (const fechaStr in registrosPorFecha) {
    const dnisRegistrados = registrosPorFecha[fechaStr];
    const timestamp = convertirFecha(fechaStr).getTime();
    for (const est of estudiantesTotales) {
      if (!dnisRegistrados.has(est.dni)) {
        const key = fechaStr + '_' + est.dni;
        if (mapJustificaciones[key]) {
           registros.push({
            fecha: fechaStr,
            timestamp: timestamp,
            hora: '--:--',
            horaSalida: '--:--',
            dni: est.dni,
            nombre: est.nombre,
            estado: 'Justificado'
          });
          justificados++;
        } else {
          registros.push({
            fecha: fechaStr,
            timestamp: timestamp,
            hora: '--:--',
            horaSalida: '--:--',
            dni: est.dni,
            nombre: est.nombre,
            estado: 'Falta'
          });
          faltas++;
        }
      }
    }
  }

  registros.sort((a, b) => {
    if (a.timestamp > b.timestamp) return -1;
    if (a.timestamp < b.timestamp) return 1;
    return a.estado === 'Falta' ? 1 : (b.estado === 'Falta' ? -1 : 0);
  });

  const total = asistencias + tardanzas + faltas + justificados;

  return {
    success: true,
    filtros: { meses },
    metricas: { 
      total, 
      asistencias, 
      tardanzas, 
      faltas,
      justificados,
      porcentaje: total > 0 ? Math.round(((asistencias + tardanzas + justificados) / total) * 100) : 0 
    },
    registros
  };
}

function obtenerEstudiantes() {
    const estudiantesObj = actualizarCacheEstudiantes();
    const estudiantes = Object.values(estudiantesObj);
    return {
        success: true,
        estudiantes: estudiantes
    };
}

function convertirFecha(fechaStr) {
  if (!fechaStr) return null;
  const partes = String(fechaStr).replace(/['"]/g, '').trim().split('/');
  if (partes.length === 3) {
    return new Date(Number(partes[2]), Number(partes[1]) - 1, Number(partes[0]));
  }
  return null;
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}


// =================================================================================
// REGISTRO MANUAL DE ASISTENCIA
// =================================================================================

function obtenerGradosDisponibles() {
  const estudiantes = actualizarCacheEstudiantes();
  const gradosSet = new Set();
  for (const dni in estudiantes) {
    const est = estudiantes[dni];
    const grado = String(est.grado || '').trim();
    const nivel = String(est.nivel || '').trim();
    if (grado) {
      const item = nivel ? (grado + ' - ' + nivel) : grado;
      gradosSet.add(item);
    }
  }
  const orden = [
    '1ro - Primaria', '2do - Primaria', '3ro - Primaria', '4to - Primaria', '5to - Primaria', '6to - Primaria',
    '1ro - Secundaria', '2do - Secundaria', '3ro - Secundaria', '4to - Secundaria', '5to - Secundaria'
  ];
  const grados = Array.from(gradosSet).sort((a, b) => {
    const idxA = orden.indexOf(a);
    const idxB = orden.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });
  return { success: true, grados: grados };
}

function obtenerEstudiantesPorGrado(grado) {
  const estudiantes = actualizarCacheEstudiantes() || {};
  const lista = [];
  const gBuscado = String(grado || '').toLowerCase().replace(/[\s-]+/g, '');
  for (const dni in estudiantes) {
    const est = estudiantes[dni];
    const gEst = String(est.grado || '').trim();
    const nEst = String(est.nivel || '').trim();
    const comb = (nEst ? gEst + ' - ' + nEst : gEst).toLowerCase().replace(/[\s-]+/g, '');
    const gOnly = gEst.toLowerCase().replace(/[\s-]+/g, '');
    if (comb === gBuscado || gOnly === gBuscado) {
      lista.push(est);
    }
  }
  lista.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
  return { success: true, estudiantes: lista };
}

function obtenerAsistenciaDia(fechaStr) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const hojaR = ss.getSheetByName(HOJA_REGISTRO);
  const ultFilaR = hojaR.getLastRow();
  const ultColR = hojaR.getLastColumn();
  if (ultFilaR <= 1) return { success: true, registrados: {} };

  const datos = hojaR.getRange(2, 1, ultFilaR - 1, ultColR).getValues();
  const headers = hojaR.getRange(1, 1, 1, ultColR).getValues()[0].map(h => String(h).trim().toLowerCase());
  const cFecha = headers.indexOf('fecha');
  const cHora = headers.indexOf('hora');
  const cDNI = headers.indexOf('dni');
  const cEstado = headers.indexOf('estado');
  const tz = Session.getScriptTimeZone() || 'America/Lima';

  const registrados = {};
  for (let i = 0; i < datos.length; i++) {
    const fechaCelda = datos[i][cFecha];
    let fechaFormateada = '';
    if (fechaCelda instanceof Date) {
      fechaFormateada = Utilities.formatDate(fechaCelda, tz, 'dd/MM/yyyy');
    } else {
      fechaFormateada = String(fechaCelda).trim();
    }

    if (fechaFormateada === fechaStr) {
      const dni = String(datos[i][cDNI]).trim();
      let hora = '';
      if (datos[i][cHora] instanceof Date) {
        hora = Utilities.formatDate(datos[i][cHora], tz, 'HH:mm:ss');
      } else {
        hora = String(datos[i][cHora] || '').trim();
      }
      registrados[dni] = {
        estado: String(datos[i][cEstado] || '').trim(),
        hora: hora,
        fila: i + 2 // fila real en la hoja (1-indexed + header)
      };
    }
  }
  return { success: true, registrados: registrados };
}

function registrarManualLote(data) {
  const registros = data.registros || [];
  const fechaStr = String(data.fecha || '').trim();

  if (!fechaStr) return { success: false, message: 'Debe indicar una fecha.' };
  if (!registros.length) return { success: false, message: 'No hay registros para guardar.' };

  const estadosValidos = ['Asistió', 'Tardanza', 'Falta'];
  const SCRIPT_PROPERTIES = PropertiesService.getScriptProperties();
  const tz = Session.getScriptTimeZone() || 'America/Lima';

  // Convertir fecha dd/MM/yyyy a yyyy-MM-dd para la property key
  const partes = fechaStr.split('/');
  const fechaKey = partes.length === 3 ? partes[2] + '-' + partes[1] + '-' + partes[0] : fechaStr;

  const todosLosAlumnos = actualizarCacheEstudiantes();

  // Obtener registros existentes del dia para detectar duplicados
  const existentes = obtenerAsistenciaDia(fechaStr);
  const registradosMap = existentes.registrados || {};

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const hojaRegistro = ss.getSheetByName(HOJA_REGISTRO);
  const nuevasFilas = [];
  let actualizados = 0;
  let nuevos = 0;
  const errores = [];

  for (const reg of registros) {
    const dni = String(reg.dni || '').trim();
    const estado = String(reg.estado || '').trim();

    if (!dni || !estado) {
      errores.push('Registro incompleto: falta DNI o estado.');
      continue;
    }

    if (!estadosValidos.includes(estado)) {
      errores.push('Estado invalido para DNI ' + dni + ': ' + estado);
      continue;
    }

    const alumno = todosLosAlumnos[dni];
    if (!alumno) {
      errores.push('DNI ' + dni + ' no encontrado en BD_Estudiantes.');
      continue;
    }

    // Si ya existe un registro para este DNI en este dia, actualizamos
    if (registradosMap[dni]) {
      const filaExistente = registradosMap[dni].fila;
      hojaRegistro.getRange(filaExistente, 5).setValue(estado); // Columna Estado (E)
      actualizados++;
    } else {
      // Nuevo registro manual
      nuevasFilas.push([fechaStr, 'Manual', dni, alumno.nombre, estado]);
      nuevos++;
    }

    // Actualizar property para que registrarInasistencias() no lo marque como falta
    const propertyKey = 'asistencia_' + dni + '_' + fechaKey;
    SCRIPT_PROPERTIES.setProperty(propertyKey, 'registrado');
  }

  // Escribir todas las filas nuevas de una vez (rendimiento)
  if (nuevasFilas.length > 0) {
    hojaRegistro.getRange(hojaRegistro.getLastRow() + 1, 1, nuevasFilas.length, nuevasFilas[0].length).setValues(nuevasFilas);
  }

  SpreadsheetApp.flush();

  return {
    success: true,
    message: 'Registro manual completado: ' + nuevos + ' nuevos, ' + actualizados + ' actualizados.',
    nuevos: nuevos,
    actualizados: actualizados,
    errores: errores
  };
}

// =================================================================================
// MENÚ LATERAL Y CALENDARIO
// =================================================================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Asistencia QR')
    .addItem('Abrir Calendario de Feriados', 'abrirSidebarCalendario')
    .addSeparator()
    .addItem('Actualizar Caché de Alumnos', 'actualizarCacheEstudiantes')
    .addToUi();
}

function abrirSidebarCalendario() {
  const html = HtmlService.createHtmlOutputFromFile('SidebarCalendario')
      .setTitle('Calendario Anual');
  SpreadsheetApp.getUi().showSidebar(html);
}

function getNonWorkingDays(year, month) {
  const hojaCalendario = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(HOJA_CALENDARIO);
  if (!hojaCalendario) return [];

  const ultFilaC = hojaCalendario.getLastRow();
  const ultColC = hojaCalendario.getLastColumn();
  const datos = ultFilaC > 0 && ultColC > 0 ? hojaCalendario.getRange(1, 1, ultFilaC, ultColC).getValues() : [];
  const nonWorkingDays = [];
  const tz = Session.getScriptTimeZone() || 'America/Lima';

  for (let i = 1; i < datos.length; i++) {
    const fechaCelda = datos[i][0];
    if (fechaCelda instanceof Date && !isNaN(fechaCelda)) {
      if (fechaCelda.getFullYear() === year && (fechaCelda.getMonth() + 1) === month) {
        if (String(datos[i][1]).toUpperCase() === 'NO') {
          nonWorkingDays.push(Utilities.formatDate(fechaCelda, tz, 'yyyy-MM-dd'));
        }
      }
    }
  }
  return nonWorkingDays;
}

function updateNonWorkingDay(dateString, isNonWorking) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let hojaCalendario = ss.getSheetByName(HOJA_CALENDARIO);
  if (!hojaCalendario) {
    hojaCalendario = ss.insertSheet(HOJA_CALENDARIO);
    hojaCalendario.appendRow(['Fecha', 'Laborable']);
  }
  
  const ultFilaC = hojaCalendario.getLastRow();
  const ultColC = hojaCalendario.getLastColumn();
  const datos = ultFilaC > 0 && ultColC > 0 ? hojaCalendario.getRange(1, 1, ultFilaC, ultColC).getValues() : [];
  const tz = Session.getScriptTimeZone() || 'America/Lima';
  
  for (let i = 1; i < datos.length; i++) {
    const fechaCelda = datos[i][0];
    if (fechaCelda instanceof Date && !isNaN(fechaCelda)) {
      const fechaCeldaStr = Utilities.formatDate(fechaCelda, tz, 'yyyy-MM-dd');
      if (fechaCeldaStr === dateString) {
        hojaCalendario.getRange(i + 1, 2).setValue(isNonWorking ? 'NO' : '');
        return { success: true, message: 'Fecha actualizada' };
      }
    }
  }
  
  // Si la fecha no estaba en el Excel, la agregamos automáticamente
  const [año, mes, dia] = dateString.split('-');
  const nuevaFecha = new Date(año, mes - 1, dia);
  hojaCalendario.appendRow([nuevaFecha, isNonWorking ? 'NO' : '']);
  return { success: true, message: 'Fecha nueva agregada' };
}

// =================================================================================
// PROCESO DE INASISTENCIAS
// =================================================================================

function registrarInasistencias() {
  const SCRIPT_PROPERTIES = PropertiesService.getScriptProperties();
  const hoy = new Date();
  const tz = Session.getScriptTimeZone() || 'America/Lima';
  const fechaHoyStr = Utilities.formatDate(hoy, tz, 'dd/MM/yyyy');
  const fechaKey = Utilities.formatDate(hoy, tz, 'yyyy-MM-dd');

  const hojaCalendario = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(HOJA_CALENDARIO);
  if (hojaCalendario) {
    const ultFilaC = hojaCalendario.getLastRow();
    const ultColC = hojaCalendario.getLastColumn();
    const calendarioDatos = ultFilaC > 0 && ultColC > 0 ? hojaCalendario.getRange(1, 1, ultFilaC, ultColC).getValues() : [];
    for (let i = 1; i < calendarioDatos.length; i++) {
      const fechaCelda = calendarioDatos[i][0];
      if (fechaCelda instanceof Date && !isNaN(fechaCelda)) {
        const fechaCeldaStr = Utilities.formatDate(fechaCelda, tz, 'dd/MM/yyyy');
        if (fechaCeldaStr === fechaHoyStr) {
          const esLaborable = String(calendarioDatos[i][1]).toUpperCase();
          if (esLaborable === 'NO') {
            console.log('Hoy (' + fechaHoyStr + ') es un dia no laborable. No se registraran faltas.');
            return; 
          }
          break; 
        }
      }
    }
  }

  const todosLosAlumnos = actualizarCacheEstudiantes();
  const dnisAlumnos = Object.keys(todosLosAlumnos);
  
  const dnisAsistieron = [];
  dnisAlumnos.forEach(dni => {
    const propertyKey = 'asistencia_' + dni + '_' + fechaKey;
    if (SCRIPT_PROPERTIES.getProperty(propertyKey)) {
      dnisAsistieron.push(dni);
    }
  });

  const dnisFaltaron = dnisAlumnos.filter(dni => !dnisAsistieron.includes(dni));
  const hojaRegistro = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(HOJA_REGISTRO);
  const nuevasFilas = [];

  dnisFaltaron.forEach(dni => {
    const faltaKey = 'falta_' + dni + '_' + fechaKey;
    if (!SCRIPT_PROPERTIES.getProperty(faltaKey)) {
      const alumno = todosLosAlumnos[dni];
      if (alumno) {
        nuevasFilas.push([fechaHoyStr, 'N/A', dni, alumno.nombre, 'Falta']);
        SCRIPT_PROPERTIES.setProperty(faltaKey, 'registrada');
      }
    }
  });

  if (nuevasFilas.length > 0) {
    hojaRegistro.getRange(hojaRegistro.getLastRow() + 1, 1, nuevasFilas.length, nuevasFilas[0].length).setValues(nuevasFilas);
    SpreadsheetApp.flush();
  }
  
  console.log('Proceso de inasistencias completado. Se registraron ' + nuevasFilas.length + ' faltas nuevas.');
}


// ============================================================
// MÓDULO DE TAREAS Y AGENDA ESCOLAR (DOCENTES Y PADRES)
// ============================================================

function asegurarHojaDocentes() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let hoja = ss.getSheetByName(HOJA_DOCENTES);
  if (!hoja) {
    hoja = ss.insertSheet(HOJA_DOCENTES);
    hoja.appendRow(['DNI', 'Nombre_Docente', 'Nivel_Grados', 'Telefono', 'Estado']);
    hoja.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#1e293b').setFontColor('#ffffff');
    SpreadsheetApp.flush();
  }
  return hoja;
}

function asegurarHojaTareas() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let hoja = ss.getSheetByName(HOJA_TAREAS);
  const encabezados = ['ID_Tarea', 'Fecha_Registro', 'Grado_Nivel', 'Curso_Materia', 'Docente', 'Descripcion', 'Fecha_Entrega', 'Estado', 'DNI_Docente', 'Fecha_Inicio', 'URL_Adjunto', 'Nombre_Adjunto'];
  if (!hoja) {
    hoja = ss.insertSheet(HOJA_TAREAS);
    hoja.appendRow(encabezados);
    hoja.getRange(1, 1, 1, encabezados.length).setFontWeight('bold').setBackground('#1e293b').setFontColor('#ffffff');
    SpreadsheetApp.flush();
  } else {
    const ultCol = hoja.getLastColumn();
    if (ultCol < encabezados.length) {
      for (let c = ultCol + 1; c <= encabezados.length; c++) {
        hoja.getRange(1, c).setValue(encabezados[c - 1]);
      }
      hoja.getRange(1, 1, 1, encabezados.length).setFontWeight('bold').setBackground('#1e293b').setFontColor('#ffffff');
      SpreadsheetApp.flush();
    }
  }
  return hoja;
}

function autorizarPermisosDrive() {
  // Función para forzar a Google a solicitar y conceder el permiso completo https://www.googleapis.com/auth/drive
  // (creación de carpetas y subida de archivos PDF).
  try {
    const nombreCarpeta = 'Tareas_Escolares_Adjuntos';
    const carpetas = DriveApp.getFoldersByName(nombreCarpeta);
    let carpeta;
    if (carpetas.hasNext()) {
      carpeta = carpetas.next();
    } else {
      carpeta = DriveApp.createFolder(nombreCarpeta);
    }
    try {
      carpeta.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (eShare) {}
    
    // Crear archivo temporal de prueba para validar permiso de escritura en Drive
    const blobTest = Utilities.newBlob('OK', 'text/plain', 'test_auth.txt');
    const fileTest = carpeta.createFile(blobTest);
    fileTest.setTrashed(true);
    
    Logger.log('¡Éxito! Permisos de creación de carpetas y subida de archivos en Drive autorizados al 100%.');
    return 'Permisos de Google Drive concedidos correctamente.';
  } catch (err) {
    Logger.log('Error al autorizar Drive: ' + err.message);
    throw err;
  }
}

function subirArchivoADrive(base64Data, nombreArchivo, mimeType, subcarpeta) {
  try {
    if (!base64Data) return { success: false, message: 'No hay datos de archivo.' };
    
    // Limpiar prefijo data URL si existe
    if (base64Data.indexOf(',') !== -1) {
      base64Data = base64Data.split(',')[1];
    }
    
    base64Data = base64Data.replace(/\s/g, '');
    const bytes = Utilities.base64Decode(base64Data);
    const tipo = mimeType || 'application/pdf';
    const tz = Session.getScriptTimeZone() || 'America/Lima';
    const nombre = nombreArchivo || ('Archivo_' + Utilities.formatDate(new Date(), tz, 'yyyyMMdd_HHmmss'));
    const blob = Utilities.newBlob(bytes, tipo, nombre);
    
    // Carpeta en Google Drive (por defecto Tareas_Escolares_Adjuntos o Comunicados_Banners)
    const nombreCarpeta = subcarpeta || 'Tareas_Escolares_Adjuntos';
    const carpetas = DriveApp.getFoldersByName(nombreCarpeta);
    let carpeta;
    if (carpetas.hasNext()) {
      carpeta = carpetas.next();
    } else {
      carpeta = DriveApp.createFolder(nombreCarpeta);
      try {
        carpeta.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (eShare) {}
    }
    
    const archivo = carpeta.createFile(blob);
    try {
      archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (eShare) {}
    
    const url = archivo.getUrl();
    return {
      success: true,
      url: url,
      nombre: nombre,
      idArchivo: archivo.getId()
    };
  } catch (err) {
    Logger.log('Error al subir archivo a Drive: ' + err.message);
    return { 
      success: false, 
      message: 'Error en Google Drive (' + err.message + '). Ejecute autorizarPermisosDrive() en Apps Script para conceder permisos.' 
    };
  }
}

function verificarDocente(dni) {
  if (!/^\d{8}$/.test(dni)) {
    return { success: false, message: 'El DNI debe tener 8 dígitos numéricos.' };
  }
  const hoja = asegurarHojaDocentes();
  const ultFila = hoja.getLastRow();
  if (ultFila <= 1) {
    return { 
      success: false, 
      message: 'No hay docentes registrados en la hoja BD_Docentes de Google Sheets. Agrega tu DNI y Nombre en la hoja para iniciar sesión.',
      sinRegistros: true
    };
  }

  const datos = hoja.getRange(2, 1, ultFila - 1, Math.max(hoja.getLastColumn(), 5)).getValues();
  for (let i = 0; i < datos.length; i++) {
    const dFila = String(datos[i][0] || '').trim();
    if (dFila === dni) {
      return {
        success: true,
        docente: {
          dni: dFila,
          nombre: String(datos[i][1] || '').trim(),
          nivel: String(datos[i][2] || '').trim(),
          telefono: String(datos[i][3] || '').trim(),
          estado: String(datos[i][4] || 'Activo').trim()
        }
      };
    }
  }

  return { success: false, message: 'DNI no encontrado en el padrón de docentes. Solicita a dirección tu registro en BD_Docentes.' };
}

function obtenerTareas(gradoFiltro, dniDocente) {
  const hoja = asegurarHojaTareas();
  const ultFila = hoja.getLastRow();
  if (ultFila <= 1) {
    return { success: true, tareas: [] };
  }

  const tz = Session.getScriptTimeZone() || 'America/Lima';
  const datos = hoja.getRange(2, 1, ultFila - 1, Math.max(hoja.getLastColumn(), 12)).getValues();
  const tareas = [];

  for (let i = datos.length - 1; i >= 0; i--) {
    const id = String(datos[i][0] || '').trim();
    if (!id) continue;
    
    const fReg = datos[i][1];
    const fechaRegStr = fReg instanceof Date ? Utilities.formatDate(fReg, tz, 'dd/MM/yyyy') : String(fReg || '').trim();
    
    const grado = String(datos[i][2] || '').trim();
    const curso = String(datos[i][3] || '').trim();
    const docente = String(datos[i][4] || '').trim();
    const descripcion = String(datos[i][5] || '').trim();
    
    const fEnt = datos[i][6];
    const fechaEntStr = fEnt instanceof Date ? Utilities.formatDate(fEnt, tz, 'dd/MM/yyyy') : String(fEnt || '').trim();
    
    const estado = String(datos[i][7] || 'Activa').trim();
    const dniD = String(datos[i][8] || '').trim();

    const fIni = datos[i][9];
    const fechaIniStr = fIni instanceof Date ? Utilities.formatDate(fIni, tz, 'dd/MM/yyyy') : String(fIni || fechaRegStr).trim();
    const urlAdjunto = String(datos[i][10] || '').trim();
    const nombreAdjunto = String(datos[i][11] || '').trim();

    if (gradoFiltro && gradoFiltro !== 'TODOS') {
      const gNorm = grado.toLowerCase().replace(/[\s-]+/g, '');
      const fNorm = gradoFiltro.toLowerCase().replace(/[\s-]+/g, '');
      if (gNorm !== fNorm && !gNorm.includes(fNorm) && !fNorm.includes(gNorm)) {
        continue;
      }
    }

    if (dniDocente && dniD && dniD !== dniDocente) {
      continue;
    }

    tareas.push({
      id: id,
      fechaRegistro: fechaRegStr,
      fechaInicio: fechaIniStr || fechaRegStr,
      grado: grado,
      curso: curso,
      docente: docente,
      descripcion: descripcion,
      fechaEntrega: fechaEntStr,
      estado: estado,
      dniDocente: dniD,
      urlAdjunto: urlAdjunto,
      nombreAdjunto: nombreAdjunto
    });
  }

  return { success: true, tareas: tareas };
}

function registrarTarea(data) {
  const dniDocente = String(data.dniDocente || '').trim();
  const grado = String(data.grado || '').trim();
  const curso = String(data.curso || '').trim();
  const descripcion = String(data.descripcion || '').trim();
  const fechaEntrega = String(data.fechaEntrega || '').trim();
  let nombreDocente = String(data.nombreDocente || '').trim();

  if (!grado || !curso || !descripcion) {
    return { success: false, message: 'Por favor complete el grado, curso y la descripción de la tarea.' };
  }

  if (dniDocente) {
    const docRes = verificarDocente(dniDocente);
    if (docRes.success && docRes.docente.nombre) {
      nombreDocente = docRes.docente.nombre;
    }
  }

  if (!nombreDocente) {
    nombreDocente = 'Docente IEP Millenium';
  }

  const hoja = asegurarHojaTareas();
  const tz = Session.getScriptTimeZone() || 'America/Lima';
  const ahora = new Date();
  const fechaHoy = Utilities.formatDate(ahora, tz, 'dd/MM/yyyy');
  const idTarea = 'TAR-' + Utilities.formatDate(ahora, tz, 'yyyyMMdd-HHmmss') + '-' + Math.floor(Math.random() * 900 + 100);

  const fechaInicio = String(data.fechaInicio || data.fechaRegistro || fechaHoy).trim();
  let urlAdjunto = '';
  let nombreAdjunto = '';

  if (data.archivo && data.archivo.base64) {
    const resDrive = subirArchivoADrive(data.archivo.base64, data.archivo.nombre, data.archivo.tipo);
    if (resDrive && resDrive.success) {
      urlAdjunto = resDrive.url;
      nombreAdjunto = resDrive.nombre;
    } else {
      return {
        success: false,
        message: 'No se pudo subir el archivo PDF a Google Drive: ' + (resDrive ? resDrive.message : 'Error desconocido. Verifique permisos de Drive en Apps Script.')
      };
    }
  }

  hoja.appendRow([
    idTarea,
    "'" + fechaHoy,
    grado,
    curso,
    nombreDocente,
    descripcion,
    fechaEntrega ? "'" + fechaEntrega : "'" + fechaHoy,
    'Activa',
    dniDocente,
    fechaInicio ? "'" + fechaInicio : "'" + fechaHoy,
    urlAdjunto,
    nombreAdjunto
  ]);
  SpreadsheetApp.flush();

  return {
    success: true,
    message: 'Tarea publicada correctamente para ' + grado + (urlAdjunto ? ' con archivo PDF adjunto.' : '.'),
    tarea: {
      id: idTarea,
      fechaRegistro: fechaHoy,
      fechaInicio: fechaInicio || fechaHoy,
      grado: grado,
      curso: curso,
      docente: nombreDocente,
      descripcion: descripcion,
      fechaEntrega: fechaEntrega || fechaHoy,
      estado: 'Activa',
      dniDocente: dniDocente,
      urlAdjunto: urlAdjunto,
      nombreAdjunto: nombreAdjunto
    }
  };
}

function cambiarEstadoTarea(idTarea, nuevoEstado) {
  if (!idTarea) return { success: false, message: 'ID de tarea requerido.' };
  const hoja = asegurarHojaTareas();
  const ultFila = hoja.getLastRow();
  if (ultFila <= 1) return { success: false, message: 'No hay tareas registradas.' };

  const datos = hoja.getRange(2, 1, ultFila - 1, 1).getValues();
  for (let i = 0; i < datos.length; i++) {
    if (String(datos[i][0]).trim() === String(idTarea).trim()) {
      hoja.getRange(i + 2, 8).setValue(nuevoEstado);
      SpreadsheetApp.flush();
      return { success: true, message: 'Estado de la tarea actualizado a ' + nuevoEstado + '.' };
    }
  }
  return { success: false, message: 'Tarea no encontrada.' };
}

function eliminarTarea(idTarea) {
  if (!idTarea) return { success: false, message: 'ID de tarea requerido.' };
  const hoja = asegurarHojaTareas();
  const ultFila = hoja.getLastRow();
  if (ultFila <= 1) return { success: false, message: 'No hay tareas registradas.' };

  const datos = hoja.getRange(2, 1, ultFila - 1, 1).getValues();
  for (let i = 0; i < datos.length; i++) {
    if (String(datos[i][0]).trim() === String(idTarea).trim()) {
      hoja.deleteRow(i + 2);
      SpreadsheetApp.flush();
      return { success: true, message: 'Tarea eliminada correctamente.' };
    }
  }
  return { success: false, message: 'Tarea no encontrada.' };
}


function normalizarFechaGAS(str) {
  if (!str) return '';
  str = String(str).replace(/['"]/g, '').trim();
  if (str.indexOf('/') !== -1) {
    const parts = str.split('/');
    if (parts.length === 3) {
      const d = parts[0].length === 1 ? '0' + parts[0] : parts[0];
      const m = parts[1].length === 1 ? '0' + parts[1] : parts[1];
      const y = parts[2];
      return d + '/' + m + '/' + y;
    }
  }
  if (str.indexOf('-') !== -1) {
    const parts = str.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      const d = parts[2].length === 1 ? '0' + parts[2] : parts[2];
      const m = parts[1].length === 1 ? '0' + parts[1] : parts[1];
      const y = parts[0];
      return d + '/' + m + '/' + y;
    }
  }
  return str;
}

function obtenerJustificacionesGAS() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const hojaJ = ss.getSheetByName(HOJA_JUSTIFICACIONES);
    if (!hojaJ) return { success: false, message: 'Hoja no encontrada', justificaciones: [] };

    const ultFila = hojaJ.getLastRow();
    const ultCol = hojaJ.getLastColumn();
    if (ultFila <= 1) return { success: true, justificaciones: [] };

    const datos = hojaJ.getRange(1, 1, ultFila, ultCol).getDisplayValues();
    const estMap = actualizarCacheEstudiantes() || {};

    const lista = [];
    for (let i = 1; i < datos.length; i++) {
      const fecha = normalizarFechaGAS(datos[i][0]);
      const dni = String(datos[i][1]).trim();
      const motivo = String(datos[i][2] || '').trim();
      if (dni && /^\d{8}$/.test(dni)) {
        const est = estMap[dni];
        lista.push({
          id: 'JUST-' + fecha + '-' + dni + '-' + i,
          fila: i + 1,
          fecha: fecha,
          dni: dni,
          motivo: motivo || 'Sin detalle especificado',
          nombre: est ? est.nombre : 'Estudiante no registrado',
          grado: est ? est.grado : '',
          nivel: est ? est.nivel : '',
          gradoCompleto: est ? (est.nivel ? est.grado + ' - ' + est.nivel : est.grado) : ''
        });
      }
    }
    lista.reverse();
    return { success: true, justificaciones: lista };
  } catch (err) {
    return { success: false, message: err.message, justificaciones: [] };
  }
}


// ============================================================
// MÓDULO DE COMUNICADOS Y REUNIONES ESCOLARES (IEP MILLENIUM)
// ============================================================

function asegurarHojaComunicados() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let hoja = ss.getSheetByName(HOJA_COMUNICADOS);
  const encabezados = [
    'ID_Comunicado', 
    'Fecha_Registro', 
    'Titulo', 
    'Descripcion', 
    'Fecha_Evento', 
    'Hora_Evento', 
    'Lugar', 
    'Dirigido_A', 
    'URL_Banner', 
    'Nombre_Banner', 
    'Estado'
  ];
  if (!hoja) {
    hoja = ss.insertSheet(HOJA_COMUNICADOS);
    hoja.appendRow(encabezados);
    hoja.getRange(1, 1, 1, encabezados.length).setFontWeight('bold').setBackground('#1e293b').setFontColor('#ffffff');
    SpreadsheetApp.flush();
  } else {
    const ultCol = hoja.getLastColumn();
    if (ultCol < encabezados.length) {
      for (let c = ultCol + 1; c <= encabezados.length; c++) {
        hoja.getRange(1, c).setValue(encabezados[c - 1]);
      }
      hoja.getRange(1, 1, 1, encabezados.length).setFontWeight('bold').setBackground('#1e293b').setFontColor('#ffffff');
      SpreadsheetApp.flush();
    }
  }
  return hoja;
}

function registrarComunicado(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const hoja = asegurarHojaComunicados();

  const titulo = String(data.titulo || '').trim();
  const descripcion = String(data.descripcion || '').trim();
  const fechaEvento = String(data.fechaEvento || '').trim();
  const horaEvento = String(data.horaEvento || '').trim();
  const lugar = String(data.lugar || 'Patio Central - IEP Millenium').trim();
  const dirigidoA = String(data.dirigidoA || 'TODOS').trim();

  if (!titulo) {
    return { success: false, message: 'Debe ingresar el título del comunicado o reunión.' };
  }

  const tz = Session.getScriptTimeZone() || 'America/Lima';
  const ahora = new Date();
  const fechaHoy = Utilities.formatDate(ahora, tz, 'dd/MM/yyyy');
  const idComunicado = 'COM-' + Utilities.formatDate(ahora, tz, 'yyyyMMdd-HHmmss') + '-' + Math.floor(Math.random() * 900 + 100);

  let urlBanner = '';
  let nombreBanner = '';

  if (data.banner && data.banner.base64) {
    const resDrive = subirArchivoADrive(
      data.banner.base64, 
      data.banner.nombre, 
      data.banner.tipo || 'image/jpeg', 
      'Comunicados_Banners'
    );
    if (resDrive && resDrive.success) {
      urlBanner = resDrive.idArchivo ? ('https://lh3.googleusercontent.com/d/' + resDrive.idArchivo) : resDrive.url;
      nombreBanner = resDrive.nombre;
    } else {
      return {
        success: false,
        message: 'No se pudo subir el banner a Google Drive: ' + (resDrive ? resDrive.message : 'Error desconocido.')
      };
    }
  }

  hoja.appendRow([
    idComunicado,
    "'" + fechaHoy,
    titulo,
    descripcion,
    fechaEvento ? "'" + fechaEvento : "'" + fechaHoy,
    horaEvento ? "'" + horaEvento : '',
    lugar,
    dirigidoA,
    urlBanner,
    nombreBanner,
    'Activo'
  ]);
  SpreadsheetApp.flush();

  return {
    success: true,
    message: 'Comunicado publicado correctamente para ' + (dirigidoA === 'TODOS' ? 'todo el colegio' : dirigidoA) + '.',
    comunicado: {
      id: idComunicado,
      fechaRegistro: fechaHoy,
      titulo: titulo,
      descripcion: descripcion,
      fechaEvento: fechaEvento || fechaHoy,
      horaEvento: horaEvento,
      lugar: lugar,
      dirigidoA: dirigidoA,
      urlBanner: urlBanner,
      nombreBanner: nombreBanner,
      estado: 'Activo'
    }
  };
}

function obtenerComunicados(filtroGrado) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const hoja = asegurarHojaComunicados();
  const ultFila = hoja.getLastRow();
  if (ultFila <= 1) {
    return { success: true, comunicados: [] };
  }

  const tz = Session.getScriptTimeZone() || 'America/Lima';
  const datos = hoja.getRange(2, 1, ultFila - 1, Math.max(hoja.getLastColumn(), 11)).getValues();
  const comunicados = [];

  for (let i = datos.length - 1; i >= 0; i--) {
    const id = String(datos[i][0] || '').trim();
    if (!id) continue;

    const fReg = datos[i][1];
    const fechaRegStr = fReg instanceof Date ? Utilities.formatDate(fReg, tz, 'dd/MM/yyyy') : String(fReg || '').trim();

    const titulo = String(datos[i][2] || '').trim();
    const descripcion = String(datos[i][3] || '').trim();

    const fEvt = datos[i][4];
    const fechaEvtStr = fEvt instanceof Date ? Utilities.formatDate(fEvt, tz, 'dd/MM/yyyy') : String(fEvt || '').trim();

    const hEvt = datos[i][5];
    const horaEvtStr = hEvt instanceof Date ? Utilities.formatDate(hEvt, tz, 'HH:mm') : String(hEvt || '').trim();

    const lugar = String(datos[i][6] || '').trim();
    const dirigidoA = String(datos[i][7] || 'TODOS').trim();
    const urlBanner = String(datos[i][8] || '').trim();
    const nombreBanner = String(datos[i][9] || '').trim();
    const estado = String(datos[i][10] || 'Activo').trim();

    if (estado === 'Eliminado') continue;

    // Filtro por grado o nivel
    if (filtroGrado && filtroGrado !== 'TODOS') {
      const gNorm = filtroGrado.toLowerCase().replace(/[\s-]+/g, '');
      const dNorm = dirigidoA.toLowerCase().replace(/[\s-]+/g, '');
      
      const esParaTodos = dNorm === 'todos' || dNorm === 'general' || dNorm === 'todas';
      const esParaPrimaria = dNorm === 'primaria' || dNorm === 'todoprimaria' || dNorm === 'nivelprimaria';
      const esParaSecundaria = dNorm === 'secundaria' || dNorm === 'todosecundaria' || dNorm === 'nivelsecundaria';

      const gradoEsPrimaria = gNorm.includes('primaria');
      const gradoEsSecundaria = gNorm.includes('secundaria');

      let coincide = esParaTodos;
      if (!coincide && esParaPrimaria && gradoEsPrimaria) coincide = true;
      if (!coincide && esParaSecundaria && gradoEsSecundaria) coincide = true;
      if (!coincide && (gNorm === dNorm || gNorm.includes(dNorm) || dNorm.includes(gNorm))) coincide = true;

      if (!coincide) continue;
    }

    comunicados.push({
      id: id,
      fechaRegistro: fechaRegStr,
      titulo: titulo,
      descripcion: descripcion,
      fechaEvento: fechaEvtStr,
      horaEvento: horaEvtStr,
      lugar: lugar,
      dirigidoA: dirigidoA,
      urlBanner: urlBanner,
      nombreBanner: nombreBanner,
      estado: estado
    });
  }

  return { success: true, comunicados: comunicados };
}

function cambiarEstadoComunicado(idComunicado, nuevoEstado) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const hoja = asegurarHojaComunicados();
  const ultFila = hoja.getLastRow();
  if (ultFila <= 1) return { success: false, message: 'Hoja vacía.' };

  const ids = hoja.getRange(2, 1, ultFila - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === idComunicado) {
      hoja.getRange(i + 2, 11).setValue(nuevoEstado || 'Finalizado');
      SpreadsheetApp.flush();
      return { success: true, message: 'Estado del comunicado actualizado a ' + nuevoEstado + '.' };
    }
  }
  return { success: false, message: 'Comunicado no encontrado.' };
}

function eliminarComunicado(idComunicado) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const hoja = asegurarHojaComunicados();
  const ultFila = hoja.getLastRow();
  if (ultFila <= 1) return { success: false, message: 'Hoja vacía.' };

  const ids = hoja.getRange(2, 1, ultFila - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === idComunicado) {
      hoja.deleteRow(i + 2);
      SpreadsheetApp.flush();
      return { success: true, message: 'Comunicado eliminado correctamente.' };
    }
  }
  return { success: false, message: 'Comunicado no encontrado.' };
}


// ============================================================
// MÓDULO INTEGRAL DE CAFETERÍA ESCOLAR Y BILLETERA DIGITAL
// IEP MILLENIUM
// ============================================================

function asegurarHojasCafeteria() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // 1. Hoja de Productos
  let hojaProd = ss.getSheetByName(HOJA_CAFETERIA_PRODUCTOS);
  const encProd = ['ID_Producto', 'Categoria', 'Nombre', 'Descripcion', 'Precio', 'Foto_URL', 'Estado', 'En_Menu_Hoy'];
  if (!hojaProd) {
    hojaProd = ss.insertSheet(HOJA_CAFETERIA_PRODUCTOS);
    hojaProd.appendRow(encProd);
    hojaProd.getRange(1, 1, 1, encProd.length).setFontWeight('bold').setBackground('#1e293b').setFontColor('#ffffff');

    // Cargar productos iniciales representativos de las categorías escolares
    const itemsIniciales = [
      ['PROD-001', 'Sándwiches y hamburguesas', 'Sándwich de Pollo Especial', 'Pollo deshilachado con lechuga y mayonesa artesanal', 3.50, '', 'Disponible', 'SI'],
      ['PROD-002', 'Sándwiches y hamburguesas', 'Hamburguesa de Carne con Papitas', 'Carne casera, lechuga, tomate y cremas', 4.50, '', 'Disponible', 'SI'],
      ['PROD-003', 'Desayunos', 'Desayuno Clásico (Pan con Queso + Avena)', 'Pan campesino con queso fresco y vaso de avena tibia', 4.00, '', 'Disponible', 'SI'],
      ['PROD-004', 'Comidas y platos preparados', 'Menú Escolar del Día (Almuerzo Completo)', 'Segundo + entrada o sopa + refresco natural', 10.00, '', 'Disponible', 'SI'],
      ['PROD-005', 'Pastelería y panadería', 'Empanada de Pollo / Carne al Horno', 'Masa horneada rellena con trozos de carne y aceituna', 3.00, '', 'Disponible', 'SI'],
      ['PROD-006', 'Jugos y bebidas naturales', 'Jugo Natural de Naranja / Maracuyá (400ml)', 'Fruta fresca exprimida en el momento', 3.50, '', 'Disponible', 'SI'],
      ['PROD-007', 'Bebidas frías', 'Chicha Morada Casera (500ml)', 'Elaborada con maíz morado, piña y canela', 2.00, '', 'Disponible', 'SI'],
      ['PROD-008', 'Bebidas frías', 'Agua Mineral sin Gas (600ml)', 'Botella individual sellada', 2.00, '', 'Disponible', 'SI'],
      ['PROD-009', 'Frutas y ensaladas', 'Ensalada de Frutas con Yogur y Miel', 'Papaya, plátano, manzana con yogur natural', 5.00, '', 'Disponible', 'SI'],
      ['PROD-010', 'Frutas y ensaladas', 'Manzana / Plátano Seleccionado', 'Fruta lavada y lista para consumir', 1.50, '', 'Disponible', 'SI'],
      ['PROD-011', 'Postres y dulces', 'Queque Casero de Vainilla / Zanahoria', 'Porción generosa horneada en el colegio', 2.50, '', 'Disponible', 'SI'],
      ['PROD-012', 'Productos lácteos', 'Yogur Personal con Cereal (200ml)', 'Vaso individual sellado', 3.00, '', 'Disponible', 'SI'],
      ['PROD-013', 'Combos y promociones', 'Combo Recreo: Sándwich de Pollo + Jugo', 'Ahorro especial de refrigerio', 6.00, '', 'Disponible', 'SI'],
      ['PROD-014', 'Snacks y piqueos', 'Galleta Integral con Semillas', 'Opción saludable y energética', 1.50, '', 'Disponible', 'SI']
    ];
    hojaProd.getRange(2, 1, itemsIniciales.length, encProd.length).setValues(itemsIniciales);
    SpreadsheetApp.flush();
  }

  // 2. Hoja de Saldos
  let hojaSaldos = ss.getSheetByName(HOJA_CAFETERIA_SALDOS);
  const encSaldos = ['DNI', 'Estudiante', 'Grado', 'Nivel', 'Saldo_Actual', 'Total_Recargado', 'Total_Consumido', 'Ultima_Actualizacion'];
  if (!hojaSaldos) {
    hojaSaldos = ss.insertSheet(HOJA_CAFETERIA_SALDOS);
    hojaSaldos.appendRow(encSaldos);
    hojaSaldos.getRange(1, 1, 1, encSaldos.length).setFontWeight('bold').setBackground('#1e293b').setFontColor('#ffffff');
    SpreadsheetApp.flush();
  }

  // 3. Hoja de Recargas (Yape / Transferencias)
  let hojaRecargas = ss.getSheetByName(HOJA_CAFETERIA_RECARGAS);
  const encRecargas = ['ID_Recarga', 'Fecha_Registro', 'Hora_Registro', 'DNI', 'Estudiante', 'Grado', 'Monto', 'Metodo', 'Num_Operacion', 'URL_Comprobante', 'Estado', 'Validado_Por', 'Fecha_Validacion'];
  if (!hojaRecargas) {
    hojaRecargas = ss.insertSheet(HOJA_CAFETERIA_RECARGAS);
    hojaRecargas.appendRow(encRecargas);
    hojaRecargas.getRange(1, 1, 1, encRecargas.length).setFontWeight('bold').setBackground('#1e293b').setFontColor('#ffffff');
    SpreadsheetApp.flush();
  }

  // 4. Hoja de Ventas y Consumos
  let hojaVentas = ss.getSheetByName(HOJA_CAFETERIA_VENTAS);
  const encVentas = ['ID_Venta', 'Fecha_Hora', 'DNI', 'Estudiante', 'Grado', 'Detalle_Productos', 'Total', 'Saldo_Anterior', 'Saldo_Restante', 'Metodo_Pago', 'Atendido_Por'];
  if (!hojaVentas) {
    hojaVentas = ss.insertSheet(HOJA_CAFETERIA_VENTAS);
    hojaVentas.appendRow(encVentas);
    hojaVentas.getRange(1, 1, 1, encVentas.length).setFontWeight('bold').setBackground('#1e293b').setFontColor('#ffffff');
    SpreadsheetApp.flush();
  }

  // 5. Hoja de Pedidos Anticipados
  let hojaPedidos = ss.getSheetByName(HOJA_CAFETERIA_PEDIDOS);
  const encPedidos = ['ID_Pedido', 'Fecha_Registro', 'Fecha_Entrega', 'DNI', 'Estudiante', 'Grado', 'Detalle_Productos', 'Total', 'Turno_Entrega', 'Estado', 'Metodo_Pago', 'Notas'];
  if (!hojaPedidos) {
    hojaPedidos = ss.insertSheet(HOJA_CAFETERIA_PEDIDOS);
    hojaPedidos.appendRow(encPedidos);
    hojaPedidos.getRange(1, 1, 1, encPedidos.length).setFontWeight('bold').setBackground('#1e293b').setFontColor('#ffffff');
    SpreadsheetApp.flush();
  }

  return { hojaProd, hojaSaldos, hojaRecargas, hojaVentas, hojaPedidos };
}

// ------------------------------------------------------------
// PRODUCTOS Y MENÚ
// ------------------------------------------------------------

function obtenerProductosCafeteria(soloMenuHoy) {
  asegurarHojasCafeteria();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const hoja = ss.getSheetByName(HOJA_CAFETERIA_PRODUCTOS);
  const ultFila = hoja.getLastRow();
  if (ultFila <= 1) return { success: true, productos: [] };

  const datos = hoja.getRange(2, 1, ultFila - 1, 8).getValues();
  const productos = [];

  for (let i = 0; i < datos.length; i++) {
    const id = String(datos[i][0] || '').trim();
    if (!id) continue;

    const estado = String(datos[i][6] || 'Disponible').trim();
    const enMenuHoy = String(datos[i][7] || 'SI').trim().toUpperCase() === 'SI';

    if (soloMenuHoy && (!enMenuHoy || estado !== 'Disponible')) {
      continue;
    }

    const fotoUrl = String(datos[i][5] || '').trim();

    productos.push({
      id: id,
      idProducto: id,
      categoria: String(datos[i][1] || 'Otros productos').trim(),
      nombre: String(datos[i][2] || '').trim(),
      descripcion: String(datos[i][3] || '').trim(),
      precio: parseFloat(datos[i][4]) || 0,
      fotoUrl: fotoUrl,
      imagenUrl: fotoUrl,
      estado: estado,
      enMenuHoy: enMenuHoy
    });
  }

  return { success: true, productos: productos };
}

function guardarProductoCafeteria(data) {
  asegurarHojasCafeteria();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const hoja = ss.getSheetByName(HOJA_CAFETERIA_PRODUCTOS);

  const nombre = String(data.nombre || '').trim();
  const categoria = String(data.categoria || 'Otros productos').trim();
  const precio = parseFloat(data.precio) || 0;
  const descripcion = String(data.descripcion || '').trim();
  const estado = String(data.estado || 'Disponible').trim();
  const enMenuHoy = data.enMenuHoy !== false ? 'SI' : 'NO';

  if (!nombre || precio <= 0) {
    return { success: false, message: 'El nombre y un precio válido son obligatorios.' };
  }

  let fotoUrl = String(data.fotoUrl || data.imagenUrl || '').trim();

  // Soporte universal para foto en base64 en cualquiera de los formatos
  const base64Data = (data.foto && data.foto.base64) ? data.foto.base64 : (data.imagenBase64 || data.fotoBase64 || '');
  const base64Nombre = (data.foto && data.foto.nombre) ? data.foto.nombre : (data.imagenNombre || data.fotoNombre || (nombre.replace(/[^a-zA-Z0-9]/g, '_') + '.png'));
  const base64Tipo = (data.foto && data.foto.tipo) ? data.foto.tipo : (data.imagenMime || data.fotoMime || 'image/png');

  if (base64Data) {
    const resDrive = subirArchivoADrive(
      base64Data, 
      base64Nombre, 
      base64Tipo, 
      'Cafeteria_Fotos'
    );
    if (resDrive && resDrive.success) {
      fotoUrl = resDrive.idArchivo ? ('https://lh3.googleusercontent.com/d/' + resDrive.idArchivo) : resDrive.url;
    }
  }

  const idExistente = String(data.id || data.idProducto || '').trim();
  const ultFila = hoja.getLastRow();

  if (idExistente && ultFila > 1) {
    const ids = hoja.getRange(2, 1, ultFila - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (String(ids[i][0]).trim() === idExistente) {
        hoja.getRange(i + 2, 2, 1, 7).setValues([[categoria, nombre, descripcion, precio, fotoUrl, estado, enMenuHoy]]);
        SpreadsheetApp.flush();
        return { success: true, message: 'Producto actualizado correctamente.', id: idExistente, idProducto: idExistente, fotoUrl: fotoUrl, imagenUrl: fotoUrl };
      }
    }
  }

  const tz = Session.getScriptTimeZone() || 'America/Lima';
  const nuevoId = 'PROD-' + Utilities.formatDate(new Date(), tz, 'yyyyMMdd_HHmmss') + '-' + Math.floor(Math.random() * 900 + 100);
  hoja.appendRow([nuevoId, categoria, nombre, descripcion, precio, fotoUrl, estado, enMenuHoy]);
  SpreadsheetApp.flush();

  return { success: true, message: 'Producto registrado con éxito.', id: nuevoId, idProducto: nuevoId, fotoUrl: fotoUrl, imagenUrl: fotoUrl };
}

function toggleMenuHoyProducto(idProducto, nuevoEnMenuHoy) {
  asegurarHojasCafeteria();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const hoja = ss.getSheetByName(HOJA_CAFETERIA_PRODUCTOS);
  const ultFila = hoja.getLastRow();
  if (ultFila <= 1) return { success: false, message: 'Sin productos.' };

  const ids = hoja.getRange(2, 1, ultFila - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === idProducto) {
      hoja.getRange(i + 2, 8).setValue(nuevoEnMenuHoy ? 'SI' : 'NO');
      SpreadsheetApp.flush();
      return { success: true, message: 'Disponibilidad en menú del día actualizada.' };
    }
  }
  return { success: false, message: 'Producto no encontrado.' };
}

function eliminarProductoCafeteria(idProducto) {
  asegurarHojasCafeteria();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const hoja = ss.getSheetByName(HOJA_CAFETERIA_PRODUCTOS);
  const ultFila = hoja.getLastRow();
  if (ultFila <= 1) return { success: false, message: 'Sin productos.' };

  const ids = hoja.getRange(2, 1, ultFila - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === idProducto) {
      hoja.deleteRow(i + 2);
      SpreadsheetApp.flush();
      return { success: true, message: 'Producto eliminado correctamente.' };
    }
  }
  return { success: false, message: 'Producto no encontrado.' };
}

// ------------------------------------------------------------
// GESTIÓN DE SALDOS Y MONEDERO ESCOLAR
// ------------------------------------------------------------

function obtenerSaldosMap() {
  asegurarHojasCafeteria();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const hoja = ss.getSheetByName(HOJA_CAFETERIA_SALDOS);
  const ultFila = hoja.getLastRow();
  const map = {};
  if (ultFila <= 1) return map;

  const datos = hoja.getRange(2, 1, ultFila - 1, 8).getValues();
  for (let i = 0; i < datos.length; i++) {
    const dni = String(datos[i][0] || '').trim();
    if (dni) {
      map[dni] = {
        fila: i + 2,
        dni: dni,
        estudiante: String(datos[i][1] || '').trim(),
        grado: String(datos[i][2] || '').trim(),
        nivel: String(datos[i][3] || '').trim(),
        saldo: parseFloat(datos[i][4]) || 0,
        totalRecargado: parseFloat(datos[i][5]) || 0,
        totalConsumido: parseFloat(datos[i][6]) || 0,
        ultimaActualizacion: String(datos[i][7] || '').trim()
      };
    }
  }
  return map;
}

function obtenerSaldosCafeteria() {
  const map = obtenerSaldosMap();
  const lista = [];
  const estMap = actualizarCacheEstudiantes() || {};

  // Asegurar que todos los alumnos existan en el mapa de saldos y tengan su nombre visible
  for (const dni in estMap) {
    const e = estMap[dni] || {};
    const s = map[dni] || {};
    const nombreCompleto = s.estudiante || e.nombre || 'Estudiante';
    const saldoNum = parseFloat(s.saldo || 0);
    const recargadoNum = parseFloat(s.totalRecargado || 0);
    const consumidoNum = parseFloat(s.totalConsumido || 0);

    lista.push({
      fila: s.fila || 0,
      dni: dni,
      estudiante: nombreCompleto,
      nombres: nombreCompleto,
      nombre: nombreCompleto,
      grado: s.grado || e.grado || '',
      nivel: s.nivel || e.nivel || '',
      saldo: saldoNum,
      saldoActual: saldoNum,
      totalRecargado: recargadoNum,
      totalConsumido: consumidoNum,
      ultimaActualizacion: s.ultimaActualizacion || '--'
    });
  }

  // Si hubiera DNI en map que no están en estMap
  for (const dni in map) {
    if (!estMap[dni]) {
      const s = map[dni];
      const nombreCompleto = s.estudiante || 'Estudiante';
      const saldoNum = parseFloat(s.saldo || 0);
      lista.push({
        fila: s.fila || 0,
        dni: dni,
        estudiante: nombreCompleto,
        nombres: nombreCompleto,
        nombre: nombreCompleto,
        grado: s.grado || '',
        nivel: s.nivel || '',
        saldo: saldoNum,
        saldoActual: saldoNum,
        totalRecargado: parseFloat(s.totalRecargado || 0),
        totalConsumido: parseFloat(s.totalConsumido || 0),
        ultimaActualizacion: s.ultimaActualizacion || '--'
      });
    }
  }

  lista.sort((a, b) => (a.nombres || a.estudiante || '').localeCompare(b.nombres || b.estudiante || ''));
  return { success: true, saldos: lista };
}

function actualizarSaldoEstudiante(dni, deltaSaldo, esRecarga, esConsumo) {
  asegurarHojasCafeteria();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const hoja = ss.getSheetByName(HOJA_CAFETERIA_SALDOS);
  const tz = Session.getScriptTimeZone() || 'America/Lima';
  const fechaHora = Utilities.formatDate(new Date(), tz, 'dd/MM/yyyy HH:mm:ss');

  const map = obtenerSaldosMap();
  const item = map[dni];
  const e = buscarEstudiante(dni) || {};

  if (item && item.fila > 0) {
    const nombreGuardar = item.estudiante || e.nombre || 'Estudiante';
    const gradoGuardar = item.grado || e.grado || '';
    const nivelGuardar = item.nivel || e.nivel || '';

    const nuevoSaldo = Math.round((item.saldo + deltaSaldo) * 100) / 100;
    const nuevoRecargado = esRecarga ? (Math.round((item.totalRecargado + Math.max(0, deltaSaldo)) * 100) / 100) : item.totalRecargado;
    const nuevoConsumido = esConsumo ? (Math.round((item.totalConsumido + Math.abs(deltaSaldo)) * 100) / 100) : item.totalConsumido;

    hoja.getRange(item.fila, 2, 1, 7).setValues([[
      nombreGuardar,
      gradoGuardar,
      nivelGuardar,
      nuevoSaldo,
      nuevoRecargado,
      nuevoConsumido,
      fechaHora
    ]]);
    SpreadsheetApp.flush();
    return { success: true, saldoAnterior: item.saldo, nuevoSaldo: nuevoSaldo };
  } else {
    // Alumno nuevo en la tabla de saldos
    const nuevoSaldo = Math.round(deltaSaldo * 100) / 100;
    const nuevoRecargado = esRecarga ? nuevoSaldo : 0;
    const nuevoConsumido = esConsumo ? Math.abs(nuevoSaldo) : 0;

    hoja.appendRow([
      dni, 
      e.nombre || 'Estudiante', 
      e.grado || '', 
      e.nivel || '', 
      nuevoSaldo, 
      nuevoRecargado, 
      nuevoConsumido, 
      fechaHora
    ]);
    SpreadsheetApp.flush();
    return { success: true, saldoAnterior: 0, nuevoSaldo: nuevoSaldo };
  }
}

function ajustarSaldoManual(data) {
  const dni = String(data.dni || '').trim();
  const monto = parseFloat(data.monto) || 0;
  const motivo = String(data.motivo || 'Ajuste manual de cafetería').trim();
  const operador = String(data.operador || 'Cajero').trim();

  if (!dni || monto === 0) {
    return { success: false, message: 'DNI y monto válido son requeridos.' };
  }

  const res = actualizarSaldoEstudiante(dni, monto, monto > 0, monto < 0);
  if (res.success) {
    // Registrar en movimientos
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const hojaV = ss.getSheetByName(HOJA_CAFETERIA_VENTAS);
    const tz = Session.getScriptTimeZone() || 'America/Lima';
    const ahoraStr = Utilities.formatDate(new Date(), tz, 'dd/MM/yyyy HH:mm:ss');
    const idMov = 'AJUSTE-' + Utilities.formatDate(new Date(), tz, 'yyyyMMdd_HHmmss');
    const e = buscarEstudiante(dni) || {};

    hojaV.appendRow([
      idMov, 
      ahoraStr, 
      dni, 
      e.nombre || '', 
      e.grado || '', 
      'Ajuste de saldo: ' + motivo + ' (Op: ' + operador + ')', 
      Math.abs(monto), 
      res.saldoAnterior, 
      res.nuevoSaldo, 
      monto > 0 ? 'Abono Manual' : 'Descuento Manual', 
      operador
    ]);
    SpreadsheetApp.flush();
  }
  return { success: true, message: 'Saldo actualizado correctamente.', ...res };
}

// ------------------------------------------------------------
// RECARGAS YAPE Y TRANSFERENCIAS
// ------------------------------------------------------------

function reportarRecargaYape(data) {
  asegurarHojasCafeteria();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const hoja = ss.getSheetByName(HOJA_CAFETERIA_RECARGAS);

  const dni = String(data.dni || '').trim();
  const monto = parseFloat(data.monto) || 0;
  const numOperacion = String(data.codigoOperacion || data.numOperacion || '').trim();

  if (!dni || !/^\d{8}$/.test(dni)) {
    return { success: false, message: 'DNI de estudiante inválido.' };
  }
  if (monto <= 0) {
    return { success: false, message: 'El monto de recarga debe ser mayor a 0.' };
  }

  const e = buscarEstudiante(dni) || {};

  // Manejar comprobante en base64 (soporta comprobanteBase64 directo o dentro de comprobante.base64)
  let urlComprobante = '';
  const base64Img = data.comprobanteBase64 || (data.comprobante && data.comprobante.base64) || '';
  const tz = Session.getScriptTimeZone() || 'America/Lima';
  const ahora = new Date();
  const fReg = Utilities.formatDate(ahora, tz, 'dd/MM/yyyy');
  const hReg = Utilities.formatDate(ahora, tz, 'HH:mm:ss');
  const nombreImg = data.comprobanteNombre || (data.comprobante && data.comprobante.nombre) || ('Yape_' + dni + '_' + Utilities.formatDate(ahora, tz, 'yyyyMMdd_HHmmss') + '.jpg');
  const mimeImg = data.comprobanteMime || (data.comprobante && data.comprobante.tipo) || 'image/jpeg';

  if (base64Img) {
    try {
      const resDrive = subirArchivoADrive(
        base64Img,
        nombreImg,
        mimeImg,
        'Cafeteria_Comprobantes'
      );
      if (resDrive && resDrive.success) {
        urlComprobante = resDrive.idArchivo ? ('https://lh3.googleusercontent.com/d/' + resDrive.idArchivo) : (resDrive.url || '');
      }
    } catch (errDrive) {
      Logger.log('Error subiendo comprobante a Drive: ' + errDrive.toString());
    }
  }

  const idRecarga = 'YAPE-' + Utilities.formatDate(ahora, tz, 'yyyyMMdd_HHmmss') + '-' + Math.floor(Math.random() * 900 + 100);

  hoja.appendRow([
    idRecarga,
    "'" + fReg,
    "'" + hReg,
    dni,
    e.nombre || data.nombres || '',
    (e.grado ? e.grado + ' ' + (e.nivel || '') : (data.grado || '')),
    monto,
    'Yape',
    numOperacion,
    urlComprobante,
    'Pendiente',
    '',
    ''
  ]);
  SpreadsheetApp.flush();

  return {
    success: true,
    message: 'Recarga por Yape de S/ ' + monto.toFixed(2) + ' enviada. La cafetería validará el abono a la brevedad.',
    idRecarga: idRecarga,
    id: idRecarga,
    urlComprobante: urlComprobante,
    comprobanteUrl: urlComprobante
  };
}

function obtenerRecargasCafeteria(estadoFiltro) {
  asegurarHojasCafeteria();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const hoja = ss.getSheetByName(HOJA_CAFETERIA_RECARGAS);
  const ultFila = hoja.getLastRow();
  if (ultFila <= 1) return { success: true, recargas: [] };

  const datos = hoja.getRange(2, 1, ultFila - 1, 13).getValues();
  const tz = Session.getScriptTimeZone() || 'America/Lima';
  const recargas = [];
  const filtroUpper = String(estadoFiltro || 'TODAS').trim().toUpperCase();

  for (let i = datos.length - 1; i >= 0; i--) {
    const id = String(datos[i][0] || '').trim();
    if (!id) continue;

    const estadoRaw = String(datos[i][10] || 'Pendiente').trim();
    const estadoUpper = estadoRaw.toUpperCase();

    if (filtroUpper !== 'TODAS') {
      if (filtroUpper === 'PENDIENTES' || filtroUpper === 'PENDIENTE') {
        if (!estadoUpper.includes('PENDIENTE')) continue;
      } else if (filtroUpper === 'APROBADAS' || filtroUpper === 'APROBADA') {
        if (!estadoUpper.includes('APROBADA')) continue;
      } else if (filtroUpper === 'RECHAZADAS' || filtroUpper === 'RECHAZADA') {
        if (!estadoUpper.includes('RECHAZADA')) continue;
      } else {
        if (estadoUpper !== filtroUpper) continue;
      }
    }

    const fReg = datos[i][1];
    const fechaRegStr = fReg instanceof Date ? Utilities.formatDate(fReg, tz, 'dd/MM/yyyy') : String(fReg || '').trim();

    // Sanitizar hora evitando epoch de 1899
    let horaStr = '';
    const hRaw = datos[i][2];
    if (hRaw instanceof Date) {
      horaStr = Utilities.formatDate(hRaw, tz, 'HH:mm:ss');
    } else {
      horaStr = String(hRaw || '').trim();
      if (horaStr.includes('1899') || horaStr.includes('GMT')) {
        const m = horaStr.match(/\d{2}:\d{2}(:\d{2})?/);
        if (m) horaStr = m[0];
      }
    }

    const numOp = String(datos[i][8] || '').trim();
    const urlComp = String(datos[i][9] || '').trim();
    const estudianteNombre = String(datos[i][4] || '').trim();

    recargas.push({
      id: id,
      idRecarga: id,
      fecha: fechaRegStr,
      hora: horaStr,
      dni: String(datos[i][3] || '').trim(),
      estudiante: estudianteNombre,
      nombres: estudianteNombre,
      nombre: estudianteNombre,
      grado: String(datos[i][5] || '').trim(),
      monto: parseFloat(datos[i][6]) || 0,
      metodo: String(datos[i][7] || 'Yape').trim(),
      numOperacion: numOp,
      codigoOperacion: numOp,
      urlComprobante: urlComp,
      comprobanteUrl: urlComp,
      estado: estadoRaw,
      estadoUpper: estadoUpper.includes('APROBADA') ? 'APROBADA' : (estadoUpper.includes('RECHAZADA') ? 'RECHAZADA' : 'PENDIENTE'),
      validadoPor: String(datos[i][11] || '').trim(),
      fechaValidacion: String(datos[i][12] || '').trim()
    });
  }

  return { success: true, recargas: recargas };
}

function procesarRecargaYape(idRecarga, accion, validadoPor, motivoRechazo) {
  asegurarHojasCafeteria();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const hoja = ss.getSheetByName(HOJA_CAFETERIA_RECARGAS);
  const ultFila = hoja.getLastRow();
  if (ultFila <= 1) return { success: false, message: 'Sin registros de recarga.' };

  const idRecargaLimpio = String(idRecarga || '').trim();
  if (!idRecargaLimpio) {
    return { success: false, message: 'ID de recarga no proporcionado.' };
  }

  const datos = hoja.getRange(2, 1, ultFila - 1, 13).getValues();
  const tz = Session.getScriptTimeZone() || 'America/Lima';
  const ahoraStr = Utilities.formatDate(new Date(), tz, 'dd/MM/yyyy HH:mm:ss');
  const usuario = validadoPor || 'Cajero Cafetería';
  const esAprobacion = String(accion || '').trim().toUpperCase() === 'APROBAR';

  for (let i = 0; i < datos.length; i++) {
    const idFila = String(datos[i][0] || '').trim();
    if (idFila === idRecargaLimpio) {
      const estadoActual = String(datos[i][10] || '').trim();
      if (estadoActual.toLowerCase() === 'aprobada' && esAprobacion) {
        return { success: false, message: 'Esta recarga ya fue aprobada anteriormente.' };
      }

      const fila = i + 2;
      const dni = String(datos[i][3] || '').trim();
      const monto = parseFloat(datos[i][6]) || 0;

      if (esAprobacion) {
        hoja.getRange(fila, 11, 1, 3).setValues([['Aprobada', usuario, ahoraStr]]);
        SpreadsheetApp.flush();

        // Abonar al saldo del estudiante y actualizar datos en hoja de saldos
        const resAbono = actualizarSaldoEstudiante(dni, monto, true, false);
        return { 
          success: true, 
          message: 'Recarga de S/ ' + monto.toFixed(2) + ' APROBADA con éxito. Saldo nuevo: S/ ' + resAbono.nuevoSaldo.toFixed(2),
          nuevoSaldo: resAbono.nuevoSaldo
        };
      } else {
        const razon = String(motivoRechazo || 'Comprobante no válido').trim();
        hoja.getRange(fila, 11, 1, 3).setValues([['Rechazada (' + razon + ')', usuario, ahoraStr]]);
        SpreadsheetApp.flush();
        return { success: true, message: 'Recarga marcada como RECHAZADA.' };
      }
    }
  }

  return { success: false, message: 'No se encontró la recarga con ID: ' + idRecargaLimpio };
}

// ------------------------------------------------------------
// VENTAS EN CAJA (POS) Y PEDIDOS ANTICIPADOS
// ------------------------------------------------------------

function normalizarFechaComparacion(f) {
  if (!f) return '';
  if (f instanceof Date) {
    const tz = Session.getScriptTimeZone() || 'America/Lima';
    return Utilities.formatDate(f, tz, 'yyyy-MM-dd');
  }
  const str = String(f).trim();
  if (str.toUpperCase() === 'TODOS' || str === '') return '';
  // Si viene en formato dd/MM/yyyy
  const m1 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m1) {
    const d = m1[1].padStart(2, '0');
    const m = m1[2].padStart(2, '0');
    const y = m1[3];
    return `${y}-${m}-${d}`;
  }
  // Si viene en formato yyyy-MM-dd
  const m2 = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m2) {
    const y = m2[1];
    const m = m2[2].padStart(2, '0');
    const d = m2[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return str;
}

function parseDetalleItems(detalleStr) {
  if (!detalleStr) return [];
  const partes = detalleStr.split(',');
  const items = [];
  for (let i = 0; i < partes.length; i++) {
    const lim = partes[i].trim();
    if (!lim) continue;
    const match = lim.match(/^(\d+)x\s*(.*)/);
    if (match) {
      items.push({
        cantidad: parseInt(match[1], 10),
        nombre: match[2].trim(),
        subtotal: 0
      });
    } else {
      items.push({
        cantidad: 1,
        nombre: lim,
        subtotal: 0
      });
    }
  }
  return items;
}

function registrarVentaCaja(data) {
  asegurarHojasCafeteria();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const hojaV = ss.getSheetByName(HOJA_CAFETERIA_VENTAS);

  const dni = String(data.dni || '').trim();
  const items = Array.isArray(data.items) ? data.items : [];
  const total = parseFloat(data.total) || 0;
  const metodoPago = String(data.metodoPago || 'Saldo').trim();
  const atendidoPor = String(data.atendidoPor || 'Caja Principal').trim();

  if (items.length === 0 || total <= 0) {
    return { success: false, message: 'Debe incluir al menos un producto con monto válido.' };
  }

  let estudianteNombre = String(data.nombre || data.estudiante || 'Cliente General').trim();
  let estudianteGrado = String(data.grado || '').trim();
  let saldoAnterior = 0;
  let saldoRestante = 0;

  if (dni) {
    const e = buscarEstudiante(dni);
    if (e) {
      estudianteNombre = e.nombre || estudianteNombre;
      estudianteGrado = (e.grado ? e.grado + ' ' + (e.nivel || '') : '') || estudianteGrado;
    }
  }

  const esSaldo = (
    metodoPago === 'Saldo' || 
    metodoPago === 'SALDO_ESTUDIANTE' || 
    metodoPago === 'Saldo Billetera' ||
    metodoPago.toUpperCase().includes('SALDO')
  );

  // Cobro con saldo de billetera escolar
  if (esSaldo) {
    if (!dni) {
      return { success: false, message: 'Se requiere el DNI del alumno para cobrar con saldo.' };
    }

    const map = obtenerSaldosMap();
    const itemSaldo = map[dni] || { saldo: 0 };
    saldoAnterior = itemSaldo.saldo;

    if (saldoAnterior < total) {
      return { 
        success: false, 
        message: 'Saldo insuficiente. Saldo actual: S/ ' + saldoAnterior.toFixed(2) + ' - Total venta: S/ ' + total.toFixed(2) 
      };
    }

    const resDescuento = actualizarSaldoEstudiante(dni, -total, false, true);
    saldoRestante = resDescuento.nuevoSaldo;
  }

  const tz = Session.getScriptTimeZone() || 'America/Lima';
  const ahora = new Date();
  const ahoraStr = Utilities.formatDate(ahora, tz, 'dd/MM/yyyy HH:mm:ss');
  const idVenta = 'VENTA-' + Utilities.formatDate(ahora, tz, 'yyyyMMdd_HHmmss') + '-' + Math.floor(Math.random() * 900 + 100);

  const detalleResumen = items.map(it => `${it.cantidad}x ${it.nombre} (S/ ${(it.precio * it.cantidad).toFixed(2)})`).join(', ');

  hojaV.appendRow([
    idVenta,
    ahoraStr,
    dni,
    estudianteNombre,
    estudianteGrado,
    detalleResumen,
    total,
    saldoAnterior,
    saldoRestante,
    metodoPago,
    atendidoPor
  ]);
  SpreadsheetApp.flush();

  return {
    success: true,
    idVenta: idVenta,
    nuevoSaldo: saldoRestante,
    message: 'Venta registrada correctamente por S/ ' + total.toFixed(2) + '.',
    ticket: {
      idVenta: idVenta,
      fechaHora: ahoraStr,
      estudiante: estudianteNombre,
      grado: estudianteGrado,
      total: total,
      metodoPago: metodoPago,
      saldoRestante: saldoRestante,
      items: items
    }
  };
}

function registrarPedidoPadre(data) {
  asegurarHojasCafeteria();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const hojaP = ss.getSheetByName(HOJA_CAFETERIA_PEDIDOS);
  const hojaV = ss.getSheetByName(HOJA_CAFETERIA_VENTAS);

  const dni = String(data.dni || '').trim();
  const items = Array.isArray(data.items) ? data.items : [];
  const total = parseFloat(data.total) || 0;
  const fechaEntrega = String(data.fechaEntrega || '').trim();
  const turnoEntrega = String(data.turnoEntrega || 'Recreo').trim();
  const notas = String(data.notas || data.notaPadre || '').trim();

  if (!dni || items.length === 0 || total <= 0) {
    return { success: false, message: 'Datos incompletos para procesar el pedido.' };
  }

  const e = buscarEstudiante(dni);
  if (!e) return { success: false, message: 'Estudiante no encontrado.' };

  // Verificar saldo del estudiante
  const map = obtenerSaldosMap();
  const itemSaldo = map[dni] || { saldo: 0 };
  if (itemSaldo.saldo < total) {
    return {
      success: false,
      message: 'Saldo insuficiente para programar este pedido. Saldo actual: S/ ' + itemSaldo.saldo.toFixed(2) + '. Por favor recargue por Yape primero.'
    };
  }

  // Descontar saldo y reservar pedido
  const resDescuento = actualizarSaldoEstudiante(dni, -total, false, true);

  const tz = Session.getScriptTimeZone() || 'America/Lima';
  const ahora = new Date();
  const ahoraStr = Utilities.formatDate(ahora, tz, 'dd/MM/yyyy HH:mm:ss');
  const idPedido = 'PED-' + Utilities.formatDate(ahora, tz, 'yyyyMMdd_HHmmss') + '-' + Math.floor(Math.random() * 900 + 100);
  const detalleStr = items.map(it => `${it.cantidad}x ${it.nombre}`).join(', ');

  // Formatear fecha de entrega consistente
  let fechaEntReg = fechaEntrega;
  if (!fechaEntReg) {
    fechaEntReg = Utilities.formatDate(ahora, tz, 'dd/MM/yyyy');
  } else {
    const m = fechaEntReg.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) {
      fechaEntReg = `${m[3].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[1]}`;
    }
  }

  // 1. Guardar en Hoja de Pedidos para cocina
  hojaP.appendRow([
    idPedido,
    ahoraStr,
    "'" + fechaEntReg,
    dni,
    e.nombre || '',
    (e.grado ? e.grado + ' ' + (e.nivel || '') : ''),
    detalleStr,
    total,
    turnoEntrega,
    'Pendiente',
    'Saldo Billetera',
    notas
  ]);

  // 2. Guardar en Hoja de Ventas/Consumos para trazabilidad financiera inmediata
  if (hojaV) {
    hojaV.appendRow([
      idPedido,
      ahoraStr,
      dni,
      e.nombre || '',
      (e.grado ? e.grado + ' ' + (e.nivel || '') : ''),
      `[Pedido Lonchera - ${turnoEntrega}] ${detalleStr}`,
      total,
      itemSaldo.saldo,
      resDescuento.nuevoSaldo,
      'Saldo Billetera (Pedido)',
      'Portal de Padres'
    ]);
  }

  SpreadsheetApp.flush();

  return {
    success: true,
    message: 'Pedido programado con éxito. Se descontó S/ ' + total.toFixed(2) + ' de su saldo disponible.',
    nuevoSaldo: resDescuento.nuevoSaldo,
    idPedido: idPedido
  };
}

function obtenerPedidosCafeteria(filtroFecha, filtroEstado) {
  asegurarHojasCafeteria();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const hojaP = ss.getSheetByName(HOJA_CAFETERIA_PEDIDOS);
  const ultFila = hojaP ? hojaP.getLastRow() : 0;
  if (ultFila <= 1) return { success: true, pedidos: [] };

  const datos = hojaP.getRange(2, 1, ultFila - 1, 12).getValues();
  const tz = Session.getScriptTimeZone() || 'America/Lima';
  const pedidos = [];

  const filtroFechaNorm = normalizarFechaComparacion(filtroFecha);
  const filtroEstNorm = String(filtroEstado || 'TODOS').trim().toUpperCase();

  for (let i = datos.length - 1; i >= 0; i--) {
    const id = String(datos[i][0] || '').trim();
    if (!id) continue;

    const fEnt = datos[i][2];
    const fechaEntStr = fEnt instanceof Date ? Utilities.formatDate(fEnt, tz, 'dd/MM/yyyy') : String(fEnt || '').trim();
    const fechaEntNorm = normalizarFechaComparacion(fEnt);

    const estadoRaw = String(datos[i][9] || 'Pendiente').trim();
    const estadoNorm = estadoRaw.toUpperCase();

    // Filtro por fecha (soporta formatos cruzados dd/MM/yyyy y yyyy-MM-dd)
    if (filtroFechaNorm && fechaEntNorm && fechaEntNorm !== filtroFechaNorm) continue;

    // Filtro por estado
    if (filtroEstNorm !== 'TODOS' && estadoNorm !== filtroEstNorm) continue;

    const detalleStr = String(datos[i][6] || '').trim();
    const parsedItems = parseDetalleItems(detalleStr);
    const turnoRaw = String(datos[i][8] || 'Recreo').trim();
    const turnoNorm = turnoRaw.toUpperCase();
    const notasStr = String(datos[i][11] || '').trim();
    const estudianteNom = String(datos[i][4] || '').trim();

    pedidos.push({
      id: id,
      idPedido: id,
      fechaRegistro: String(datos[i][1] || '').trim(),
      fechaEntrega: fechaEntStr,
      fechaEntregaISO: fechaEntNorm,
      dni: String(datos[i][3] || '').trim(),
      estudiante: estudianteNom,
      nombres: estudianteNom,
      nombre: estudianteNom,
      grado: String(datos[i][5] || '').trim(),
      detalle: detalleStr,
      items: parsedItems,
      total: parseFloat(datos[i][7]) || 0,
      turnoEntrega: turnoNorm,
      turno: turnoNorm,
      estado: estadoNorm,
      estadoRaw: estadoRaw,
      metodoPago: String(datos[i][10] || 'Saldo Billetera').trim(),
      notas: notasStr,
      notaPadre: notasStr
    });
  }

  return { success: true, pedidos: pedidos };
}

function cambiarEstadoPedido(idPedido, nuevoEstado) {
  asegurarHojasCafeteria();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const hojaP = ss.getSheetByName(HOJA_CAFETERIA_PEDIDOS);
  const ultFila = hojaP ? hojaP.getLastRow() : 0;
  if (ultFila <= 1) return { success: false, message: 'Sin pedidos.' };

  const idBuscado = String(idPedido || '').trim().toLowerCase();
  const datosP = hojaP.getRange(2, 1, ultFila - 1, 12).getValues();
  for (let i = 0; i < datosP.length; i++) {
    if (String(datosP[i][0]).trim().toLowerCase() === idBuscado) {
      hojaP.getRange(i + 2, 10).setValue(nuevoEstado || 'Entregado');
      SpreadsheetApp.flush();

      // Asegurar registro en Hoja de Ventas para trazabilidad contable
      try {
        const hojaV = ss.getSheetByName(HOJA_CAFETERIA_VENTAS);
        if (hojaV) {
          const ultV = hojaV.getLastRow();
          let existeEnVentas = false;
          if (ultV > 1) {
            const idsV = hojaV.getRange(2, 1, ultV - 1, 1).getValues();
            for (let v = 0; v < idsV.length; v++) {
              if (String(idsV[v][0]).trim().toLowerCase() === idBuscado) {
                existeEnVentas = true;
                break;
              }
            }
          }
          if (!existeEnVentas) {
            const tz = Session.getScriptTimeZone() || 'America/Lima';
            const fHora = datosP[i][1] || Utilities.formatDate(new Date(), tz, 'dd/MM/yyyy HH:mm:ss');
            const total = parseFloat(datosP[i][7]) || 0;
            const turno = String(datosP[i][8] || 'Recreo').trim();
            const det = String(datosP[i][6] || '').trim();
            hojaV.appendRow([
              datosP[i][0],
              fHora,
              datosP[i][3],
              datosP[i][4],
              datosP[i][5],
              `[Pedido Lonchera - ${turno}] ${det}`,
              total,
              0,
              0,
              'Saldo Billetera (Pedido)',
              'Cocina Cafetería'
            ]);
            SpreadsheetApp.flush();
          }
        }
      } catch (eSync) {}

      return { success: true, message: 'Estado del pedido actualizado a ' + nuevoEstado + '.' };
    }
  }
  return { success: false, message: 'Pedido no encontrado.' };
}

function eliminarPedidoCafeteria(idPedido, reembolsar) {
  asegurarHojasCafeteria();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const hojaP = ss.getSheetByName(HOJA_CAFETERIA_PEDIDOS);
  const ultP = hojaP ? hojaP.getLastRow() : 0;
  if (ultP <= 1) return { success: false, message: 'No hay pedidos registrados.' };

  const idBuscado = String(idPedido || '').trim().toLowerCase();
  const datosP = hojaP.getRange(2, 1, ultP - 1, 12).getValues();

  for (let i = 0; i < datosP.length; i++) {
    const idFila = String(datosP[i][0] || '').trim().toLowerCase();
    if (idFila === idBuscado) {
      const filaEliminar = i + 2;
      const dni = String(datosP[i][3] || '').trim();
      const total = parseFloat(datosP[i][7]) || 0;
      const metodoPago = String(datosP[i][10] || '').trim().toUpperCase();

      // 1. Reembolsar saldo al estudiante si pagó con saldo
      if (reembolsar !== false && total > 0 && dni && (metodoPago.includes('SALDO') || metodoPago.includes('BILLETERA'))) {
        try {
          actualizarSaldoEstudiante(dni, total, false, false);
        } catch (eReemb) {}
      }

      // 2. Eliminar fila en Hoja de Pedidos
      hojaP.deleteRow(filaEliminar);

      // 3. Eliminar de Hoja de Ventas si existía para que no compute en métricas
      try {
        const hojaV = ss.getSheetByName(HOJA_CAFETERIA_VENTAS);
        if (hojaV) {
          const ultV = hojaV.getLastRow();
          if (ultV > 1) {
            const idsV = hojaV.getRange(2, 1, ultV - 1, 1).getValues();
            for (let v = 0; v < idsV.length; v++) {
              if (String(idsV[v][0]).trim().toLowerCase() === idBuscado) {
                hojaV.deleteRow(v + 2);
                break;
              }
            }
          }
        }
      } catch (eVentas) {}

      SpreadsheetApp.flush();
      return { 
        success: true, 
        message: 'Pedido eliminado exitosamente.' + (total > 0 ? ` Se devolvió S/ ${total.toFixed(2)} al saldo del alumno.` : '') 
      };
    }
  }

  return { success: false, message: 'Pedido no encontrado con ID: ' + idPedido };
}

function resetearDatosPruebaCafeteria(confirmacion) {
  if (String(confirmacion || '').trim().toUpperCase() !== 'RESET') {
    return { success: false, message: 'Debe escribir RESET para confirmar el reinicio de datos de prueba.' };
  }

  asegurarHojasCafeteria();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // 1. Limpiar Hoja de Pedidos (Conservando fila 1 encabezados)
  const hojaP = ss.getSheetByName(HOJA_CAFETERIA_PEDIDOS);
  if (hojaP && hojaP.getLastRow() > 1) {
    hojaP.getRange(2, 1, hojaP.getLastRow() - 1, hojaP.getLastColumn()).clearContent();
  }

  // 2. Limpiar Hoja de Ventas (Conservando fila 1 encabezados)
  const hojaV = ss.getSheetByName(HOJA_CAFETERIA_VENTAS);
  if (hojaV && hojaV.getLastRow() > 1) {
    hojaV.getRange(2, 1, hojaV.getLastRow() - 1, hojaV.getLastColumn()).clearContent();
  }

  // 3. Limpiar Hoja de Recargas (Conservando fila 1 encabezados)
  const hojaR = ss.getSheetByName(HOJA_CAFETERIA_RECARGAS);
  if (hojaR && hojaR.getLastRow() > 1) {
    hojaR.getRange(2, 1, hojaR.getLastRow() - 1, hojaR.getLastColumn()).clearContent();
  }

  // 4. Reiniciar Saldos a 0 en Hoja de Saldos (Columnas 5, 6 y 7)
  const hojaS = ss.getSheetByName(HOJA_CAFETERIA_SALDOS);
  if (hojaS && hojaS.getLastRow() > 1) {
    for (let f = 2; f <= hojaS.getLastRow(); f++) {
      hojaS.getRange(f, 5, 1, 3).setValues([[0, 0, 0]]);
    }
  }

  SpreadsheetApp.flush();
  return { 
    success: true, 
    message: '¡Datos de prueba reiniciados a cero exitosamente! Todos los pedidos, ventas y recargas se limpiaron. El catálogo de productos y precios se mantiene intacto.' 
  };
}

// ------------------------------------------------------------
// HISTORIAL DEL ESTUDIANTE (PARA EL PORTAL DE PADRES)
// ------------------------------------------------------------

function obtenerHistorialEstudianteCafeteria(dni) {
  asegurarHojasCafeteria();
  const map = obtenerSaldosMap();
  const saldoInfo = map[dni] || { saldo: 0, totalRecargado: 0, totalConsumido: 0 };

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const tz = Session.getScriptTimeZone() || 'America/Lima';

  // 1. Obtener recargas de este DNI
  const hojaR = ss.getSheetByName(HOJA_CAFETERIA_RECARGAS);
  const ultR = hojaR ? hojaR.getLastRow() : 0;
  const recargas = [];
  if (ultR > 1) {
    const datosR = hojaR.getRange(2, 1, ultR - 1, 13).getValues();
    for (let i = datosR.length - 1; i >= 0; i--) {
      if (String(datosR[i][3]).trim() === dni) {
        const f = datosR[i][1];
        const fStr = f instanceof Date ? Utilities.formatDate(f, tz, 'dd/MM/yyyy') : String(f || '').trim();

        let horaStr = '';
        const hRaw = datosR[i][2];
        if (hRaw instanceof Date) {
          horaStr = Utilities.formatDate(hRaw, tz, 'HH:mm:ss');
        } else {
          horaStr = String(hRaw || '').trim();
          if (horaStr.includes('1899') || horaStr.includes('GMT')) {
            const m = horaStr.match(/\d{2}:\d{2}(:\d{2})?/);
            if (m) horaStr = m[0];
          }
        }

        const numOp = String(datosR[i][8] || '').trim();
        const urlComp = String(datosR[i][9] || '').trim();
        const estRaw = String(datosR[i][10] || 'Pendiente').trim();

        recargas.push({
          id: String(datosR[i][0] || ''),
          idRecarga: String(datosR[i][0] || ''),
          fecha: fStr,
          hora: horaStr,
          monto: parseFloat(datosR[i][6]) || 0,
          metodo: String(datosR[i][7] || 'Yape'),
          numOperacion: numOp,
          codigoOperacion: numOp,
          urlComprobante: urlComp,
          comprobanteUrl: urlComp,
          estado: estRaw,
          estadoUpper: estRaw.toUpperCase()
        });
      }
    }
  }

  // 2. Obtener pedidos programados de este DNI primero (para trazabilidad cruzada)
  const hojaP = ss.getSheetByName(HOJA_CAFETERIA_PEDIDOS);
  const ultP = hojaP ? hojaP.getLastRow() : 0;
  const pedidos = [];
  if (ultP > 1) {
    const datosP = hojaP.getRange(2, 1, ultP - 1, 12).getValues();
    for (let i = datosP.length - 1; i >= 0; i--) {
      if (String(datosP[i][3]).trim() === dni) {
        const f = datosP[i][2];
        const fStr = f instanceof Date ? Utilities.formatDate(f, tz, 'dd/MM/yyyy') : String(f || '').trim();
        const turnoStr = String(datosP[i][8] || 'Recreo').trim();
        const estadoStr = String(datosP[i][9] || 'Pendiente').trim();
        pedidos.push({
          id: String(datosP[i][0] || ''),
          idPedido: String(datosP[i][0] || ''),
          fechaEntrega: fStr,
          fecha: fStr,
          detalle: String(datosP[i][6] || ''),
          total: parseFloat(datosP[i][7]) || 0,
          turnoEntrega: turnoStr,
          turno: turnoStr,
          estado: estadoStr,
          estadoUpper: estadoStr.toUpperCase()
        });
      }
    }
  }

  // 3. Obtener consumos/ventas de este DNI
  const hojaV = ss.getSheetByName(HOJA_CAFETERIA_VENTAS);
  const ultV = hojaV ? hojaV.getLastRow() : 0;
  const consumos = [];
  const idsVentasRegistradas = {};

  if (ultV > 1) {
    const datosV = hojaV.getRange(2, 1, ultV - 1, 11).getValues();
    for (let i = datosV.length - 1; i >= 0; i--) {
      if (String(datosV[i][2]).trim() === dni) {
        const idV = String(datosV[i][0] || '').trim();
        if (idV) idsVentasRegistradas[idV] = true;
        const fhStr = String(datosV[i][1] || '').trim();
        const partesFH = fhStr.split(' ');
        consumos.push({
          id: idV,
          fechaHora: fhStr,
          fecha: partesFH[0] || fhStr,
          hora: partesFH[1] || '',
          detalle: String(datosV[i][5] || ''),
          total: parseFloat(datosV[i][6]) || 0,
          saldoRestante: parseFloat(datosV[i][8]) || 0,
          metodo: String(datosV[i][9] || 'SALDO_ESTUDIANTE'),
          metodoPago: String(datosV[i][9] || 'SALDO_ESTUDIANTE')
        });
      }
    }
  }

  // Trazabilidad automática: si hay pedidos de lonchera que aún no están en la hoja de ventas,
  // agregarlos automáticamente al listado de consumos para que el padre los visualice de inmediato
  for (let i = 0; i < pedidos.length; i++) {
    const p = pedidos[i];
    if (p.id && !idsVentasRegistradas[p.id]) {
      consumos.unshift({
        id: p.id,
        fechaHora: p.fechaEntrega + ' (' + p.turno + ')',
        fecha: p.fechaEntrega,
        hora: p.turno,
        detalle: '[Pedido Lonchera - ' + p.turno + '] ' + p.detalle,
        total: p.total,
        saldoRestante: 0,
        metodo: 'Saldo Billetera (Pedido)',
        metodoPago: 'Saldo Billetera (Pedido)'
      });
    }
  }

  const saldoActualNum = parseFloat(saldoInfo.saldo || 0);
  const recargadoNum = parseFloat(saldoInfo.totalRecargado || 0);
  const consumidoNum = parseFloat(saldoInfo.totalConsumido || 0);

  return {
    success: true,
    saldoActual: saldoActualNum,
    totalRecargado: recargadoNum,
    totalConsumido: consumidoNum,
    saldo: {
      saldoActual: saldoActualNum,
      totalRecargado: recargadoNum,
      totalConsumido: consumidoNum
    },
    recargas: recargas,
    consumos: consumos,
    ventas: consumos,
    pedidos: pedidos
  };
}

// ------------------------------------------------------------
// REPORTE FINANCIERO Y CONTROL PARA DIRECCIÓN
// ------------------------------------------------------------

function coincidePeriodoCafeteria(fechaInput, periodo) {
  const p = String(periodo || 'HOY').trim().toUpperCase();
  if (p === 'TODO' || p === 'HISTORICO') return true;

  const fNorm = normalizarFechaComparacion(fechaInput);
  if (!fNorm) return false;

  const tz = Session.getScriptTimeZone() || 'America/Lima';
  const hoy = new Date();
  const hoyNorm = Utilities.formatDate(hoy, tz, 'yyyy-MM-dd');

  if (p === 'HOY') {
    return fNorm === hoyNorm;
  }

  const pF = fNorm.split('-');
  const pH = hoyNorm.split('-');
  if (pF.length < 3 || pH.length < 3) return false;

  const yF = parseInt(pF[0], 10);
  const mF = parseInt(pF[1], 10);
  const dF = parseInt(pF[2], 10);

  const yH = parseInt(pH[0], 10);
  const mH = parseInt(pH[1], 10);
  const dH = parseInt(pH[2], 10);

  if (p === 'MES') {
    return yF === yH && mF === mH;
  }

  if (p === 'SEMANA') {
    const tF = new Date(yF, mF - 1, dF).getTime();
    const tH = new Date(yH, mH - 1, dH).getTime();
    const diffDias = Math.floor((tH - tF) / (1000 * 60 * 60 * 24));
    return diffDias >= 0 && diffDias <= 7;
  }

  return true;
}

function obtenerReporteCafeteria(periodo) {
  asegurarHojasCafeteria();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const periodoFiltro = String(periodo || 'HOY').trim().toUpperCase();

  // 1. Recorrer Hoja de Ventas
  const hojaV = ss.getSheetByName(HOJA_CAFETERIA_VENTAS);
  const ultV = hojaV ? hojaV.getLastRow() : 0;
  let ventasTotales = 0;
  let cantidadVentas = 0;
  const desgloseMetodos = {
    SALDO_ESTUDIANTE: 0,
    EFECTIVO: 0,
    YAPE_DIRECTO: 0
  };
  const productosConteo = {};
  const idsVentasRegistradas = {};

  if (ultV > 1) {
    const datosV = hojaV.getRange(2, 1, ultV - 1, 11).getValues();
    for (let i = 0; i < datosV.length; i++) {
      const idVenta = String(datosV[i][0] || '').trim();
      const fHora = datosV[i][1];
      const total = parseFloat(datosV[i][6]) || 0;
      const detalle = String(datosV[i][5] || '').trim();
      const metodo = String(datosV[i][9] || '').trim().toUpperCase();

      if (idVenta) {
        idsVentasRegistradas[idVenta.toLowerCase()] = true;
      }

      if (coincidePeriodoCafeteria(fHora, periodoFiltro)) {
        ventasTotales += total;
        cantidadVentas++;

        if (metodo.includes('SALDO') || metodo.includes('BILLETERA')) {
          desgloseMetodos.SALDO_ESTUDIANTE += total;
        } else if (metodo.includes('EFECTIVO')) {
          desgloseMetodos.EFECTIVO += total;
        } else if (metodo.includes('YAPE')) {
          desgloseMetodos.YAPE_DIRECTO += total;
        } else {
          desgloseMetodos.EFECTIVO += total;
        }

        // Conteo de productos
        const items = detalle.split(',');
        items.forEach(it => {
          const clean = it.replace(/^\s*\[.*?\]\s*/, '').replace(/^\s*\d+x\s*/, '').replace(/\s*\(.*\)/, '').trim();
          if (clean && !clean.startsWith('Ajuste')) {
            productosConteo[clean] = (productosConteo[clean] || 0) + 1;
          }
        });
      }
    }
  }

  // 2. Revisar Hoja de Pedidos para sumar pedidos que aún no estuvieran en Ventas
  const hojaP = ss.getSheetByName(HOJA_CAFETERIA_PEDIDOS);
  const ultP = hojaP ? hojaP.getLastRow() : 0;
  if (ultP > 1) {
    const datosP = hojaP.getRange(2, 1, ultP - 1, 12).getValues();
    for (let i = 0; i < datosP.length; i++) {
      const idPed = String(datosP[i][0] || '').trim();
      if (!idPed) continue;
      // Solo si no fue ya sumado en hoja de ventas
      if (!idsVentasRegistradas[idPed.toLowerCase()]) {
        const fechaReg = datosP[i][1];
        const fechaEnt = datosP[i][2];
        const totalPed = parseFloat(datosP[i][7]) || 0;
        const detPed = String(datosP[i][6] || '').trim();

        // Si coincide con el periodo (por fecha de registro o entrega)
        if (coincidePeriodoCafeteria(fechaReg || fechaEnt, periodoFiltro)) {
          ventasTotales += totalPed;
          cantidadVentas++;
          desgloseMetodos.SALDO_ESTUDIANTE += totalPed;

          const itemsP = detPed.split(',');
          itemsP.forEach(it => {
            const clean = it.replace(/^\s*\d+x\s*/, '').replace(/\s*\(.*\)/, '').trim();
            if (clean) {
              productosConteo[clean] = (productosConteo[clean] || 0) + 1;
            }
          });
        }
      }
    }
  }

  // 3. Recargas Yape (Aprobadas y Pendientes)
  const hojaR = ss.getSheetByName(HOJA_CAFETERIA_RECARGAS);
  const ultR = hojaR ? hojaR.getLastRow() : 0;
  let recargasAprobadasMonto = 0;
  let recargasAprobadasCount = 0;
  let recargasPendientesMonto = 0;
  let recargasPendientesCount = 0;

  if (ultR > 1) {
    const datosR = hojaR.getRange(2, 1, ultR - 1, 13).getValues();
    for (let i = 0; i < datosR.length; i++) {
      const fRec = datosR[i][1];
      const monto = parseFloat(datosR[i][6]) || 0;
      const estadoRec = String(datosR[i][10] || '').trim().toUpperCase();

      if (estadoRec === 'PENDIENTE') {
        recargasPendientesCount++;
        recargasPendientesMonto += monto;
      } else if (estadoRec === 'APROBADA' || estadoRec === 'APROBADO') {
        if (coincidePeriodoCafeteria(fRec, periodoFiltro)) {
          recargasAprobadasMonto += monto;
          recargasAprobadasCount++;
        }
      }
    }
  }

  // 4. Saldo en custodia total en billeteras escolares
  const map = obtenerSaldosMap();
  let saldoTotalCustodia = 0;
  let alumnosConSaldo = 0;
  for (const dni in map) {
    const sVal = parseFloat(map[dni].saldo || 0);
    if (sVal > 0) {
      saldoTotalCustodia += sVal;
      alumnosConSaldo++;
    }
  }

  // 5. Top 5 productos más vendidos
  const topProductos = Object.keys(productosConteo)
    .map(k => ({ nombre: k, cantidad: productosConteo[k] }))
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 5);

  return {
    success: true,
    periodo: periodoFiltro,
    ventasTotales: Math.round(ventasTotales * 100) / 100,
    cantidadVentas: cantidadVentas,
    recargasAprobadasMonto: Math.round(recargasAprobadasMonto * 100) / 100,
    recargasAprobadasCount: recargasAprobadasCount,
    saldoTotalCustodia: Math.round(saldoTotalCustodia * 100) / 100,
    recargasPendientesCount: recargasPendientesCount,
    recargasPendientesMonto: Math.round(recargasPendientesMonto * 100) / 100,
    alumnosConSaldo: alumnosConSaldo,
    desgloseMetodos: {
      SALDO_ESTUDIANTE: Math.round(desgloseMetodos.SALDO_ESTUDIANTE * 100) / 100,
      EFECTIVO: Math.round(desgloseMetodos.EFECTIVO * 100) / 100,
      YAPE_DIRECTO: Math.round(desgloseMetodos.YAPE_DIRECTO * 100) / 100
    },
    topProductos: topProductos,
    // Aliases para compatibilidad histórica
    ventasHoyTotal: Math.round(ventasTotales * 100) / 100,
    ventasHoyCantidad: cantidadVentas,
    ventasMesTotal: Math.round(ventasTotales * 100) / 100
  };
}
