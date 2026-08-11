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

// ------------------------------------------------------------
// MANEJADORES DE PETICIONES (GET Y POST)
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
    const dni = String(data.dni || '').trim();

    if (!/^\d{8}$/.test(dni)) {
      return jsonResponse({ success: false, message: 'El DNI debe contener 8 dígitos numéricos.' });
    }

    const estudiante = buscarEstudiante(dni);
    if (!estudiante) {
      return jsonResponse({ success: false, message: 'Estudiante no encontrado con el DNI proporcionado.' });
    }

    const ahora = new Date();
    const tz = Session.getScriptTimeZone() || 'America/Lima';
    const fecha = Utilities.formatDate(ahora, tz, 'dd/MM/yyyy');
    const hora = Utilities.formatDate(ahora, tz, 'HH:mm:ss');
    const estado = calcularEstado(ahora, estudiante.nivel);

    const hoja = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(HOJA_REGISTRO);
    const datos = hoja.getDataRange().getValues();

    // --- INICIO DE LA CORRECCIÓN (VERSIÓN ROBUSTA) ---
    for (let i = 1; i < datos.length; i++) {
      const fechaCelda = datos[i][0]; // Puede ser un objeto Date o un string
      if (fechaCelda) { // Nos aseguramos de que la celda no esté vacía
        // Forzamos la conversión de la fecha de la hoja a un string 'dd/MM/yyyy' para una comparación segura
        const fechaRegistro = Utilities.formatDate(new Date(fechaCelda), tz, 'dd/MM/yyyy');
        const dniRegistro = String(datos[i][2]).trim();
        
        if (fechaRegistro === fecha && dniRegistro === dni) {
          return jsonResponse({
            success: false,
            duplicate: true,
            message: 'La asistencia para este estudiante ya fue registrada hoy.',
            estudiante
          });
        }
      }
    }
    // --- FIN DE LA CORRECCIÓN ---

    hoja.appendRow([fecha, hora, dni, estudiante.nombre, estado]);

    return jsonResponse({
      success: true,
      message: estado === 'Asistió' ? 'Asistencia registrada correctamente' : 'Se registró una TARDANZA',
      estudiante,
      asistencia: { fecha, hora, estado }
    });

  } catch (error) {
    return jsonResponse({ success: false, message: 'Error en el servidor: ' + error.message });
  }
}

// ------------------------------------------------------------
// FUNCIONES DE LÓGICA DE NEGOCIO
// ------------------------------------------------------------

function buscarEstudiante(dni) {
  const datos = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(HOJA_ESTUDIANTES).getDataRange().getValues();
  for (let i = 1; i < datos.length; i++) {
    if (String(datos[i][0]).trim() === dni) {
      return {
        dni: dni,
        nombre: datos[i][1],
        grado: datos[i][2],
        nivel: datos[i][3]
      };
    }
  }
  return null;
}

function calcularEstado(fechaHora, nivel) {
  const minutosDelDia = fechaHora.getHours() * 60 + fechaHora.getMinutes();
  if (String(nivel).toLowerCase().includes('primaria')) {
    return minutosDelDia <= 495 ? 'Asistió' : 'Tardanza'; // Tolerancia 8:15 AM
  }
  if (String(nivel).toLowerCase().includes('secundaria')) {
    return minutosDelDia <= 855 ? 'Asistió' : 'Tardanza'; // Tolerancia 2:15 PM
  }
  return 'Tardanza';
}

function obtenerDashboard(meses) {
  meses = Number(meses) || 1;
  const datos = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(HOJA_REGISTRO).getDataRange().getValues();
  const fechaInicio = new Date();
  fechaInicio.setMonth(fechaInicio.getMonth() - meses);
  fechaInicio.setHours(0, 0, 0, 0);

  let total = 0, asistencias = 0, tardanzas = 0;
  const registros = [];

  for (let i = datos.length - 1; i > 0; i--) {
    const fechaCelda = datos[i][0];
    if (!fechaCelda) continue;
    const fechaRegistro = fechaCelda instanceof Date ? fechaCelda : convertirFecha(fechaCelda);
    if (fechaRegistro && fechaRegistro >= fechaInicio) {
      registros.push({
        fecha: datos[i][0] instanceof Date ? Utilities.formatDate(datos[i][0], Session.getScriptTimeZone(), 'dd/MM/yyyy') : datos[i][0],
        hora: datos[i][1] instanceof Date ? Utilities.formatDate(datos[i][1], Session.getScriptTimeZone(), 'HH:mm:ss') : datos[i][1],
        dni: datos[i][2],
        nombre: datos[i][3],
        estado: datos[i][4]
      });
      total++;
      if (datos[i][4] === 'Asistió') asistencias++;
      if (datos[i][4] === 'Tardanza') tardanzas++;
    }
  }

  return {
    success: true,
    filtros: { meses },
    metricas: { total, asistencias, tardanzas, porcentaje: total > 0 ? Math.round((asistencias / total) * 100) : 0 },
    registros
  };
}

function obtenerEstudiantes() {
    const datos = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(HOJA_ESTUDIANTES).getDataRange().getValues();
    return {
        success: true,
        estudiantes: datos.slice(1).map(r => ({ dni: String(r[0]), nombre: r[1], grado: r[2], nivel: r[3] }))
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