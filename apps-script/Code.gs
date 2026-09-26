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
      const fechaReq = data.fecha;
      const motivo = data.motivo;
      if (!/^\d{8}$/.test(dni)) return jsonResponse({ success: false, message: 'DNI inválido.' });
      if (!fechaReq || !motivo) return jsonResponse({ success: false, message: 'Datos incompletos.' });
      
      const estudiante = buscarEstudiante(dni);
      if (!estudiante) return jsonResponse({ success: false, message: 'Estudiante no encontrado.' });
      
      const hojaJustificaciones = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(HOJA_JUSTIFICACIONES);
      hojaJustificaciones.appendRow([fechaReq, dni, motivo]);
      SpreadsheetApp.flush();
      
      return jsonResponse({
        success: true,
        message: 'Permiso/Justificación registrada correctamente',
        estudiante
      });
    }

    if (action !== 'registrar') {
      return jsonResponse({ success: false, message: 'Acción no válida para POST.' });
    }
    if (!/^\d{8}$/.test(dni)) {
      return jsonResponse({ success: false, message: 'El DNI debe contener 8 dígitos numéricos.' });
    }

    const SCRIPT_PROPERTIES = PropertiesService.getScriptProperties();
    const hoy = new Date();
    const tz = Session.getScriptTimeZone() || 'America/Lima';
    const fechaKey = Utilities.formatDate(hoy, tz, 'yyyy-MM-dd');
    const propertyKey = `asistencia_${dni}_${fechaKey}`;

    if (SCRIPT_PROPERTIES.getProperty(propertyKey)) {
      return jsonResponse({
        success: false,
        duplicate: true,
        message: 'La asistencia para este estudiante ya fue registrada hoy.',
        estudiante: buscarEstudiante(dni)
      });
    }

    const estudiante = buscarEstudiante(dni);
    if (!estudiante) {
      return jsonResponse({ success: false, message: 'Estudiante no encontrado con el DNI proporcionado.' });
    }

    const ahora = new Date();
    const fecha = Utilities.formatDate(ahora, tz, 'dd/MM/yyyy');
    const hora = Utilities.formatDate(ahora, tz, 'HH:mm:ss');
    const estado = calcularEstado(ahora, estudiante.nivel);

    const hoja = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(HOJA_REGISTRO);
    hoja.appendRow([fecha, hora, dni, estudiante.nombre, estado]);
    SpreadsheetApp.flush();

    SCRIPT_PROPERTIES.setProperty(propertyKey, 'registrado');

    let whatsappEnviado = false;
    if (estudiante.celular && META_API_TOKEN !== 'PEGA_AQUI_TU_TOKEN_DE_ACCESO_TEMPORAL') {
      try {
        const url = `https://graph.facebook.com/v25.0/${META_PHONE_ID}/messages`;
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
      message: estado === 'Asistió' ? 'Asistencia registrada correctamente' : 'Se registró una TARDANZA',
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
  
  if (String(nivel).toLowerCase().includes('primaria')) {
    if (minutosDelDia <= 495) return 'Asistió';
    if (minutosDelDia <= 600) return 'Tardanza';
    return 'Falta';
  }
  
  if (String(nivel).toLowerCase().includes('secundaria')) {
    if (minutosDelDia <= 855) return 'Asistió';
    if (minutosDelDia <= 960) return 'Tardanza';
    return 'Falta';
  }
  return 'Falta';
}

function obtenerHistorialPadre(dni, estudiante) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const hojaRegistro = ss.getSheetByName(HOJA_REGISTRO);
  const ultFilaR = hojaRegistro.getLastRow();
  const ultColR = hojaRegistro.getLastColumn();
  const registrosDatos = ultFilaR > 1 ? hojaRegistro.getRange(2, 1, ultFilaR - 1, ultColR).getValues() : [];

  const headers = hojaRegistro.getRange(1, 1, 1, ultColR).getValues()[0].map(h => String(h).trim().toLowerCase());
  const cDNI = headers.indexOf('dni');
  const cFecha = headers.indexOf('fecha');
  const cHora = headers.indexOf('hora');
  const cEstado = headers.indexOf('estado');

  const historial = [];
  let faltas = 0;
  let tardanzas = 0;
  let asistencias = 0;

  if (cDNI !== -1) {
    for (let i = 0; i < registrosDatos.length; i++) {
      const fila = registrosDatos[i];
      if (String(fila[cDNI]).trim() === dni) {
        const estado = String(fila[cEstado] || '').trim();
        const fecha = String(fila[cFecha] || '').trim();
        const hora = String(fila[cHora] || '').trim();
        
        historial.push({
          fecha: fecha,
          hora: hora,
          estado: estado
        });

        if (estado.includes('Asisti')) asistencias++;
        else if (estado === 'Tardanza') tardanzas++;
        else if (estado === 'Falta') faltas++;
      }
    }
  }

  // Ordenar el historial por fecha (de más reciente a más antiguo, asumiendo formato dd/MM/yyyy)
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
      faltas: faltas
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
  const datos = ultFilaR > 0 && ultColR > 0 ? hojaR.getRange(1, 1, ultFilaR, ultColR).getValues() : [];
  const fechaInicio = new Date();
  fechaInicio.setMonth(fechaInicio.getMonth() - meses);
  fechaInicio.setHours(0, 0, 0, 0);

  let asistencias = 0, tardanzas = 0, faltas = 0, justificados = 0;
  const registros = [];
  const registrosPorFecha = {};

  const hojaJ = ss.getSheetByName(HOJA_JUSTIFICACIONES);
  const ultFilaJ = hojaJ.getLastRow();
  const ultColJ = hojaJ.getLastColumn();
  const datosJustificaciones = ultFilaJ > 0 && ultColJ > 0 ? hojaJ.getRange(1, 1, ultFilaJ, ultColJ).getValues() : [];
  const mapJustificaciones = {};
  for (let i = 1; i < datosJustificaciones.length; i++) {
    if (!datosJustificaciones[i][0]) continue;
    const fDate = datosJustificaciones[i][0] instanceof Date ? Utilities.formatDate(datosJustificaciones[i][0], Session.getScriptTimeZone(), 'dd/MM/yyyy') : String(datosJustificaciones[i][0]);
    const d = String(datosJustificaciones[i][1]).trim();
    mapJustificaciones[`${fDate}_${d}`] = datosJustificaciones[i][2];
  }

  for (let i = 1; i < datos.length; i++) {
    const fechaCelda = datos[i][0];
    if (!fechaCelda) continue;
    
    const fechaRegistro = fechaCelda instanceof Date ? fechaCelda : convertirFecha(fechaCelda);
    
    if (fechaRegistro && fechaRegistro >= fechaInicio) {
      const fechaStr = fechaCelda instanceof Date ? Utilities.formatDate(fechaCelda, Session.getScriptTimeZone(), 'dd/MM/yyyy') : String(fechaCelda);
      const horaStr = datos[i][1] instanceof Date ? Utilities.formatDate(datos[i][1], Session.getScriptTimeZone(), 'HH:mm:ss') : String(datos[i][1]);
      const dni = String(datos[i][2]).trim();
      const estado = String(datos[i][4]);
      
      registros.push({
        fecha: fechaStr,
        timestamp: fechaRegistro.getTime(),
        hora: horaStr,
        dni: dni,
        nombre: datos[i][3],
        estado: estado
      });
      
      if (!registrosPorFecha[fechaStr]) registrosPorFecha[fechaStr] = new Set();
      registrosPorFecha[fechaStr].add(dni);
      
      if (estado === 'Asistió') asistencias++;
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
        const key = `${fechaStr}_${est.dni}`;
        if (mapJustificaciones[key]) {
           registros.push({
            fecha: fechaStr,
            timestamp: timestamp,
            hora: '--:--',
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
  const partes = String(fechaStr).split('/');
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
  
  // CORRECCIÓN 2: Comparamos las fechas en formato texto 'yyyy-MM-dd' para evitar fallos de zona horaria
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
            console.log(`Hoy (${fechaHoyStr}) es un día no laborable. No se registrarán faltas.`);
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
    const propertyKey = `asistencia_${dni}_${fechaKey}`;
    if (SCRIPT_PROPERTIES.getProperty(propertyKey)) {
      dnisAsistieron.push(dni);
    }
  });

  const dnisFaltaron = dnisAlumnos.filter(dni => !dnisAsistieron.includes(dni));
  const hojaRegistro = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(HOJA_REGISTRO);
  const nuevasFilas = [];

  dnisFaltaron.forEach(dni => {
    // CORRECCIÓN 3: Evitar registrar la falta dos veces si el script se ejecuta de nuevo hoy
    const faltaKey = `falta_${dni}_${fechaKey}`;
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
  
  console.log(`Proceso de inasistencias completado. Se registraron ${nuevasFilas.length} faltas nuevas.`);
}
