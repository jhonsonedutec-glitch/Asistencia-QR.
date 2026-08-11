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
    // Primero, determinamos la acción y el DNI
    const action = e.parameter.action;
    let dni;

    if (action === 'registrar') {
      dni = String(e.parameter.dni || '').trim();
    } else {
      // Mantenemos la lógica anterior como fallback por si se usa de otra manera
      const data = JSON.parse(e.postData.contents || '{}');
      dni = String(data.dni || '').trim();
    }

    // Ahora que tenemos el DNI, procedemos con la lógica común
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

    // --- INICIO DE LA CORRECCIÓN (VERSIÓN SÚPER-ROBUSTA) ---
    for (let i = 1; i < datos.length; i++) {
      const fechaCelda = datos[i][0];
      if (fechaCelda) {
        let fechaRegistroObj;

        if (fechaCelda instanceof Date) {
          fechaRegistroObj = fechaCelda;
        } else {
          const partes = String(fechaCelda).split('/');
          if (partes.length === 3) {
            fechaRegistroObj = new Date(Number(partes[2]), Number(partes[1]) - 1, Number(partes[0]));
          } else {
            continue;
          }
        }
        
        if (isNaN(fechaRegistroObj.getTime())) {
            continue;
        }

        const fechaRegistro = Utilities.formatDate(fechaRegistroObj, tz, 'dd/MM/yyyy');
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
    return minutosDelDia <= 495 ? 'Asistió' : 'Tardanza';
  }
  if (String(nivel).toLowerCase().includes('secundaria')) {
    return minutosDelDia <= 855 ? 'Asistió' : 'Tardanza';
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
  estudiantes.getRange('A1:D1').setValues([['DNI', 'Nombre', 'Grado', 'Nivel']]);

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
    ['12345678', 'Juan Pérez López', '3ro', 'Primaria'],
    ['23456789', 'María López García', '4to', 'Primaria'],
    ['34567890', 'Pedro Sánchez Díaz', '1ro', 'Secundaria'],
    ['45678901', 'Ana Torres Ruiz', '5to', 'Secundaria']
  ];

  estudiantes.getRange(2, 1, estudiantesPrueba.length, 4).setValues(estudiantesPrueba);

  const rangosEncabezados = [
    estudiantes.getRange('A1:D1'),
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
    .requireValueInList(['Asistió', 'Tardanza'], true)
    .setAllowInvalid(false)
    .setHelpText('Seleccione un estado válido: Asistió o Tardanza.')
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

// Fin del script