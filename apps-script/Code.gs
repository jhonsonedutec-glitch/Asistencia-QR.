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

    // --- INICIO DE LA CORRECCIÓN CON PROPERTIES SERVICE ---
    const SCRIPT_PROPERTIES = PropertiesService.getScriptProperties();
    const hoy = new Date();
    const tz = Session.getScriptTimeZone() || 'America/Lima';
    const fechaKey = Utilities.formatDate(hoy, tz, 'yyyy-MM-dd');
    const propertyKey = `asistencia_${dni}_${fechaKey}`;

    // 1. Revisar la "lista de control" rápida.
    if (SCRIPT_PROPERTIES.getProperty(propertyKey)) {
      return jsonResponse({
        success: false,
        duplicate: true,
        message: 'La asistencia para este estudiante ya fue registrada hoy.',
        estudiante: buscarEstudiante(dni)
      });
    }
    // --- FIN DE LA CORRECCIÓN ---

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

    // 2. Marcar en la "lista de control" que este DNI ya se registró hoy.
    SCRIPT_PROPERTIES.setProperty(propertyKey, 'registrado');

    // --- 3. ENVIAR MENSAJE DE WHATSAPP (META API) ---
    let whatsappEnviado = false;
    if (estudiante.celular && META_API_TOKEN !== 'PEGA_AQUI_TU_TOKEN_DE_ACCESO_TEMPORAL') {
      try {
        const url = `https://graph.facebook.com/v25.0/${META_PHONE_ID}/messages`;
        
        // Limpiamos el número para asegurar que solo tenga dígitos (Meta no acepta el signo '+')
        const numeroDestino = estudiante.celular.replace(/\D/g, '');
        
        // Payload usando la API oficial
        // IMPORTANTE: Fuera de la ventana de 24 horas, Meta exige usar una "Plantilla" (Template).
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
          // Escribir el error en la hoja de Registro para que el usuario pueda verlo de inmediato
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
// FUNCIONES DE LÓGICA DE NEGOCIO
// ------------------------------------------------------------

const CACHE_KEY_ESTUDIANTES = 'estudiantes_cache';

function actualizarCacheEstudiantes() {
  const hojaEstudiantes = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(HOJA_ESTUDIANTES);
  const datos = hojaEstudiantes.getDataRange().getValues();
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

  PropertiesService.getScriptProperties().setProperty(CACHE_KEY_ESTUDIANTES, JSON.stringify(estudiantesObj));
  return estudiantesObj;
}

function getEstudiantesFromCache() {
  const cache = PropertiesService.getScriptProperties().getProperty(CACHE_KEY_ESTUDIANTES);
  if (cache) {
    return JSON.parse(cache);
  }
  // Si el caché no existe, lo creamos y lo devolvemos
  return actualizarCacheEstudiantes();
}

function buscarEstudiante(dni) {
  const estudiantes = getEstudiantesFromCache();
  return estudiantes[dni] || null;
}

function calcularEstado(fechaHora, nivel) {
  const minutosDelDia = fechaHora.getHours() * 60 + fechaHora.getMinutes();
  
  if (String(nivel).toLowerCase().includes('primaria')) {
    // Hora de ingreso: 08:00 am
    // Asistencia hasta 08:15 am (495 min)
    // Tardanza hasta 10:00 am (600 min - pasadas 2 horas)
    // Falta después de las 10:00 am
    if (minutosDelDia <= 495) return 'Asistió';
    if (minutosDelDia <= 600) return 'Tardanza';
    return 'Falta';
  }
  
  if (String(nivel).toLowerCase().includes('secundaria')) {
    // Hora de ingreso: 02:00 pm (14:00)
    // Asistencia hasta 02:15 pm (855 min)
    // Tardanza hasta 04:00 pm (960 min - pasadas 2 horas)
    // Falta después de las 04:00 pm
    if (minutosDelDia <= 855) return 'Asistió';
    if (minutosDelDia <= 960) return 'Tardanza';
    return 'Falta';
  }
  
  return 'Falta';
}

function obtenerDashboard(meses) {
  meses = Number(meses) || 1;
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // 1. Obtener todos los estudiantes activos
  const datosEstudiantes = ss.getSheetByName(HOJA_ESTUDIANTES).getDataRange().getValues();
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

  const datos = ss.getSheetByName(HOJA_REGISTRO).getDataRange().getValues();
  const fechaInicio = new Date();
  fechaInicio.setMonth(fechaInicio.getMonth() - meses);
  fechaInicio.setHours(0, 0, 0, 0);

  let asistencias = 0, tardanzas = 0, faltas = 0, justificados = 0;
  const registros = [];
  const registrosPorFecha = {}; // Para saber quiénes registraron asistencia cada día

  // 1.5 Obtener las justificaciones
  const datosJustificaciones = ss.getSheetByName(HOJA_JUSTIFICACIONES).getDataRange().getValues();
  const mapJustificaciones = {};
  for (let i = 1; i < datosJustificaciones.length; i++) {
    if (!datosJustificaciones[i][0]) continue;
    const fDate = datosJustificaciones[i][0] instanceof Date ? Utilities.formatDate(datosJustificaciones[i][0], Session.getScriptTimeZone(), 'dd/MM/yyyy') : String(datosJustificaciones[i][0]);
    const d = String(datosJustificaciones[i][1]).trim();
    mapJustificaciones[`${fDate}_${d}`] = datosJustificaciones[i][2];
  }

  // 2. Procesar los registros reales de la hoja
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
        hora: horaStr,
        dni: dni,
        nombre: datos[i][3],
        estado: estado
      });
      
      if (!registrosPorFecha[fechaStr]) registrosPorFecha[fechaStr] = new Set();
      registrosPorFecha[fechaStr].add(dni);
      
      if (estado === 'Asistió') asistencias++;
      if (estado === 'Tardanza') tardanzas++;
      if (estado === 'Falta') faltas++; // Por si hay faltas puestas manualmente
      if (estado === 'Justificado') justificados++;
    }
  }

  // 3. Calcular las faltas virtuales (alumnos que no escanearon) para cada día escolar
  for (const fechaStr in registrosPorFecha) {
    const dnisRegistrados = registrosPorFecha[fechaStr];
    for (const est of estudiantesTotales) {
      if (!dnisRegistrados.has(est.dni)) {
        const key = `${fechaStr}_${est.dni}`;
        if (mapJustificaciones[key]) {
           registros.push({
            fecha: fechaStr,
            hora: '--:--',
            dni: est.dni,
            nombre: est.nombre,
            estado: 'Justificado'
          });
          justificados++;
        } else {
          // No está en la lista de ese día -> es Falta
          registros.push({
            fecha: fechaStr,
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

  // 4. Ordenar los registros por fecha (del más reciente al más antiguo)
  registros.sort((a, b) => {
    const fA = convertirFecha(a.fecha);
    const fB = convertirFecha(b.fecha);
    if (fA > fB) return -1;
    if (fA < fB) return 1;
    // Si son la misma fecha, priorizamos Asistió > Tardanza > Falta
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
    const datos = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(HOJA_ESTUDIANTES).getDataRange().getValues();
    if (datos.length < 2) return { success: true, estudiantes: [] };
    
    const headers = datos[0].map(h => String(h).trim().toLowerCase());
    const cDNI = headers.indexOf('dni');
    const cNombre = headers.indexOf('nombre');
    const cGrado = headers.indexOf('grado');
    const cNivel = headers.indexOf('nivel');
    
    if (cDNI === -1) return { success: true, estudiantes: [] };

    const estudiantes = datos.slice(1).map(r => ({ 
      dni: String(r[cDNI]), 
      nombre: cNombre !== -1 ? r[cNombre] : '', 
      grado: cGrado !== -1 ? r[cGrado] : '', 
      nivel: cNivel !== -1 ? r[cNivel] : '' 
    })).filter(e => e.dni);

    return {
        success: true,
        estudiantes: estudiantes
    };
}

// ------------------------------------------------------------
// FUNCIONES UTILITARIAS
// ------------------------------------------------------------

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

// Función exclusiva para forzar a Google a pedir el permiso de conexión externa
function pedirPermisos() {
  UrlFetchApp.fetch("https://google.com");
}


// =================================================================================
// SCRIPT DE CONFIGURACIÓN INICIAL DEL SISTEMA - LA "CAJA DE HERRAMIENTAS"
// =================================================================================

function configurarSistema() {

  const ui = SpreadsheetApp.getUi();

  const confirmacion = ui.alert(
    'Confirmar Configuración',
    'Este script configurará las hojas "BD_Estudiantes", "Registro_Diario" y "Justificaciones".\n\nADVERTENCIA: Se borrará cualquier contenido existente en estas hojas.\n\n¿Desea continuar?',
    ui.ButtonSet.YES_NO
  );

  if (confirmacion !== ui.Button.YES) {
    ui.alert('Configuración cancelada por el usuario.');
    return;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (ss.getName() !== 'Qr Asistencia') {
    ui.alert(
      'Advertencia de Nombre',
      'El archivo actual se llama "' + ss.getName() + '".\n\n' +
      'Se recomienda renombrarlo a:\n' +
      '"Qr Asistencia" para mantener la consistencia.',
      ui.ButtonSet.OK
    );
  }

  let estudiantes = ss.getSheetByName('BD_Estudiantes');
  if (!estudiantes) {
    estudiantes = ss.insertSheet('BD_Estudiantes');
  }
  estudiantes.clear();
  estudiantes.getRange('A1:E1').setValues([['DNI', 'Nombre', 'Grado', 'Nivel', 'Celular']]);

  let registro = ss.getSheetByName('Registro_Diario');
  if (!registro) {
    registro = ss.insertSheet('Registro_Diario');
  }
  registro.clear();
  registro.getRange('A1:E1').setValues([['Fecha', 'Hora', 'DNI', 'Nombre', 'Estado']]);

  let justificaciones = ss.getSheetByName('Justificaciones');
  if (!justificaciones) {
    justificaciones = ss.insertSheet('Justificaciones');
  }
  justificaciones.clear();
  justificaciones.getRange('A1:C1').setValues([['Fecha', 'DNI', 'Motivo']]);

  const estudiantesPrueba = [
    ['12345678', 'Juan Pérez López', '3ro', 'Primaria', '+51999999999'],
    ['23456789', 'María López García', '4to', 'Primaria', '+51999999998'],
    ['34567890', 'Pedro Sánchez Díaz', '1ro', 'Secundaria', '+51999999997'],
    ['45678901', 'Ana Torres Ruiz', '5to', 'Secundaria', '+51999999996']
  ];

  estudiantes.getRange(2, 1, estudiantesPrueba.length, 5).setValues(estudiantesPrueba);

  const rangosEncabezados = [
    estudiantes.getRange('A1:E1'),
    registro.getRange('A1:E1'),
    justificaciones.getRange('A1:C1')
  ];

  rangosEncabezados.forEach(rango => {
    rango
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle')
      .setBackground('#EEEEEE');
  });

  estudiantes.setColumnWidth(1, 120);
  estudiantes.setColumnWidth(2, 250);
  estudiantes.setColumnWidth(3, 120);
  estudiantes.setColumnWidth(4, 130);
  estudiantes.setColumnWidth(5, 130);

  registro.setColumnWidth(1, 120);
  registro.setColumnWidth(2, 100);
  registro.setColumnWidth(3, 120);
  registro.setColumnWidth(4, 250);
  registro.setColumnWidth(5, 130);

  justificaciones.setColumnWidth(1, 120);
  justificaciones.setColumnWidth(2, 120);
  justificaciones.setColumnWidth(3, 400);

  registro.getRange('A2:A').setNumberFormat('dd/MM/yyyy');
  registro.getRange('B2:B').setNumberFormat('HH:mm:ss');
  justificaciones.getRange('A2:A').setNumberFormat('dd/MM/yyyy');

  estudiantes.setFrozenRows(1);
  registro.setFrozenRows(1);
  justificaciones.setFrozenRows(1);

  [estudiantes, registro, justificaciones].forEach(hoja => {
    if (hoja.getFilter()) {
      hoja.getFilter().remove();
    }
    hoja.getRange(1, 1, hoja.getMaxRows(), hoja.getMaxColumns()).createFilter();
  });

  const reglaNivel = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Primaria', 'Secundaria'], true)
    .setAllowInvalid(false)
    .setHelpText('Seleccione un nivel válido: Primaria o Secundaria.')
    .build();

  estudiantes.getRange('D2:D').setDataValidation(reglaNivel);

  const reglaEstado = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Asistió', 'Tardanza', 'Falta'], true)
    .setAllowInvalid(false)
    .setHelpText('Seleccione un estado válido: Asistió, Tardanza o Falta.')
    .build();

  registro.getRange('E2:E').setDataValidation(reglaEstado);

  ss.setSpreadsheetTimeZone('America/Lima');

  ss.setActiveSheet(estudiantes);
  ss.moveActiveSheet(1);
  ss.setActiveSheet(registro);
  ss.moveActiveSheet(2);
  ss.setActiveSheet(justificaciones);
  ss.moveActiveSheet(3);
  ss.setActiveSheet(estudiantes);

  ui.alert(
    '✓ Configuración Completada',
    'El archivo "Qr Asistencia" ha sido configurado correctamente para IEP MILLENIUM.',
    ui.ButtonSet.OK
  );
}

function registrarInasistencias() {
  const SCRIPT_PROPERTIES = PropertiesService.getScriptProperties();
  const hoy = new Date();
  const tz = Session.getScriptTimeZone() || 'America/Lima';
  const fechaHoyStr = Utilities.formatDate(hoy, tz, 'dd/MM/yyyy');

  // 1. VERIFICAR SI HOY ES UN DÍA LABORABLE
  const hojaCalendario = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(HOJA_CALENDARIO);
  if (hojaCalendario) {
    const calendarioDatos = hojaCalendario.getDataRange().getValues();
    for (let i = 1; i < calendarioDatos.length; i++) {
      const fechaCelda = new Date(calendarioDatos[i][0]);
      const fechaCeldaStr = Utilities.formatDate(fechaCelda, tz, 'dd/MM/yyyy');
      if (fechaCeldaStr === fechaHoyStr) {
        const esLaborable = String(calendarioDatos[i][1]).toUpperCase();
        if (esLaborable === 'NO') {
          console.log(`Hoy (${fechaHoyStr}) es un día no laborable. No se registrarán faltas.`);
          return; // Detiene la ejecución
        }
        break; // Fecha encontrada, no es necesario seguir buscando
      }
    }
  }

  // 2. OBTENER LISTA COMPLETA DE ALUMNOS Y ASISTENCIAS DE HOY
  const todosLosAlumnos = getEstudiantesFromCache();
  const dnisAlumnos = Object.keys(todosLosAlumnos);
  
  const fechaKey = Utilities.formatDate(hoy, tz, 'yyyy-MM-dd');
  const dnisAsistieron = [];
  dnisAlumnos.forEach(dni => {
    const propertyKey = `asistencia_${dni}_${fechaKey}`;
    if (SCRIPT_PROPERTIES.getProperty(propertyKey)) {
      dnisAsistieron.push(dni);
    }
  });

  // 3. DETERMINAR QUIÉNES FALTARON
  const dnisFaltaron = dnisAlumnos.filter(dni => !dnisAsistieron.includes(dni));

  // 4. REGISTRAR LAS FALTAS EN LA HOJA DE REGISTRO
  if (dnisFaltaron.length > 0) {
    const hojaRegistro = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(HOJA_REGISTRO);
    const nuevasFilas = [];
    const horaFalta = 'N/A'; // O la hora que definas para el cierre
    const estadoFalta = 'Falta';

    dnisFaltaron.forEach(dni => {
      const alumno = todosLosAlumnos[dni];
      if (alumno) {
        nuevasFilas.push([fechaHoyStr, horaFalta, dni, alumno.nombre, estadoFalta]);
      }
    });

    if (nuevasFilas.length > 0) {
      hojaRegistro.getRange(hojaRegistro.getLastRow() + 1, 1, nuevasFilas.length, nuevasFilas[0].length).setValues(nuevasFilas);
      SpreadsheetApp.flush();
    }
  }
  
  console.log(`Proceso de inasistencias completado. Se registraron ${dnisFaltaron.length} faltas.`);
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Asistencia QR')
    .addItem('Abrir Calendario de Feriados', 'abrirSidebarCalendario')
    .addSeparator()
    .addItem('Actualizar Caché de Alumnos', 'actualizarCacheAlumnos')
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

  const datos = hojaCalendario.getDataRange().getValues();
  const nonWorkingDays = [];
  const tz = Session.getScriptTimeZone() || 'America/Lima';

  for (let i = 1; i < datos.length; i++) {
    const fecha = new Date(datos[i][0]);
    if (fecha.getFullYear() === year && (fecha.getMonth() + 1) === month) {
      if (String(datos[i][1]).toUpperCase() === 'NO') {
        nonWorkingDays.push(Utilities.formatDate(fecha, tz, 'yyyy-MM-dd'));
      }
    }
  }
  return nonWorkingDays;
}

function updateNonWorkingDay(dateString, isNonWorking) {
  const hojaCalendario = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(HOJA_CALENDARIO);
  if (!hojaCalendario) {
    throw new Error('La hoja CALENDARIO_ANUAL no existe.');
  }
  const datos = hojaCalendario.getDataRange().getValues();
  const fechaBuscada = new Date(dateString);
  const tz = Session.getScriptTimeZone() || 'America/Lima';
  
  // Ajustar la fechaBuscada a la zona horaria del script para evitar errores de un día
  fechaBuscada.setMinutes(fechaBuscada.getMinutes() + fechaBuscada.getTimezoneOffset());

  for (let i = 1; i < datos.length; i++) {
    const fechaCelda = new Date(datos[i][0]);
    if (fechaCelda.getFullYear() === fechaBuscada.getFullYear() &&
        fechaCelda.getMonth() === fechaBuscada.getMonth() &&
        fechaCelda.getDate() === fechaBuscada.getDate()) {
      
      hojaCalendario.getRange(i + 1, 2).setValue(isNonWorking ? 'NO' : '');
      SpreadsheetApp.flush();
      return { success: true, message: 'Fecha actualizada' };
    }
  }
  throw new Error('La fecha no fue encontrada en el calendario.');
}