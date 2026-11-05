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

    return jsonResponse({ success: false, message: 'Acción no válida' });

  } catch (error) {
    return jsonResponse({ success: false, message: 'Error en el servidor: ' + error.message });
  }
}

function doPost(e) {
  try {
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
  const estudiantes = actualizarCacheEstudiantes();
  const lista = [];
  for (const dni in estudiantes) {
    if (String(estudiantes[dni].grado).trim() === grado) {
      lista.push(estudiantes[dni]);
    }
  }
  lista.sort((a, b) => a.nombre.localeCompare(b.nombre));
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
  if (!hoja) {
    hoja = ss.insertSheet(HOJA_TAREAS);
    hoja.appendRow(['ID_Tarea', 'Fecha_Registro', 'Grado_Nivel', 'Curso_Materia', 'Docente', 'Descripcion', 'Fecha_Entrega', 'Estado', 'DNI_Docente']);
    hoja.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#1e293b').setFontColor('#ffffff');
    SpreadsheetApp.flush();
  }
  return hoja;
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
  const datos = hoja.getRange(2, 1, ultFila - 1, Math.max(hoja.getLastColumn(), 9)).getValues();
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
      grado: grado,
      curso: curso,
      docente: docente,
      descripcion: descripcion,
      fechaEntrega: fechaEntStr,
      estado: estado,
      dniDocente: dniD
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

  hoja.appendRow([
    idTarea,
    "'" + fechaHoy,
    grado,
    curso,
    nombreDocente,
    descripcion,
    fechaEntrega ? "'" + fechaEntrega : "'" + fechaHoy,
    'Activa',
    dniDocente
  ]);
  SpreadsheetApp.flush();

  return {
    success: true,
    message: 'Tarea publicada correctamente para ' + grado + '.',
    tarea: {
      id: idTarea,
      fechaRegistro: fechaHoy,
      grado: grado,
      curso: curso,
      docente: nombreDocente,
      descripcion: descripcion,
      fechaEntrega: fechaEntrega || fechaHoy,
      estado: 'Activa',
      dniDocente: dniDocente
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
    const estudiantes = actualizarCacheEstudiantes();
    const estMap = {};
    estudiantes.forEach(e => {
      if (e.dni) estMap[String(e.dni).trim()] = e;
    });

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
