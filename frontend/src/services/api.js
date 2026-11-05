const GAS_URL = 'https://script.google.com/macros/s/AKfycbypcAyDZRhiv_3z-5OqjkZ5MkAmZeHzzg2LF_NiRvXBrGHE-wiHYASf08STy2GMWDh0/exec';
const SPREADSHEET_ID = '1S78EzSmPc7jlyd0_hKzaUSPGaCL45_ZOaivyNft_t-A';
const GID_JUSTIFICACIONES = '870985132';

// Obtener fecha de hoy en formato 'YYYY-MM-DD' en la zona horaria oficial de Perú (America/Lima)
export const getFechaHoyLocal = () => {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  } catch (e) {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
};

// Normalizar cualquier fecha a formato estándar DD/MM/YYYY
export const normalizarFecha = (str) => {
  if (!str) return '';
  str = String(str).replace(/['"]/g, '').trim();
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      const y = parts[2];
      return `${d}/${m}/${y}`;
    }
  }
  if (str.includes('-')) {
    const parts = str.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
    }
  }
  return str;
};

// Parser robusto para líneas de CSV con comillas
const parseCSVLine = (line) => {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};

const request = async (url, options={}) => {
  const r = await fetch(url, options);
  const data = await r.json().catch(() => ({success:false, message:'Respuesta inválida'}));
  if (!r.ok) throw new Error(data.message || 'Error de servidor');
  return data;
};

export const registrarAsistencia = (dni, tipo = 'entrada') => request(GAS_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain' },
  body: JSON.stringify({ action: 'registrar', dni: dni, tipo: tipo })
});

// Dashboard Consolidado (GAS + GViz en tiempo real para trazabilidad de Entrada y Salida)
export const obtenerDashboard = async (meses = 1) => {
  try {
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=Registro_Diario`;

    const [dashRes, gvizText, estRes, justRes] = await Promise.all([
      request(`${GAS_URL}?action=dashboard&meses=${meses}`).catch(() => ({ success: false })),
      fetch(gvizUrl).then(r => r.ok ? r.text() : '').catch(() => ''),
      obtenerEstudiantes().catch(() => ({ success: false })),
      obtenerJustificaciones().catch(() => ({ success: false, justificaciones: [] }))
    ]);

    const listaJustificaciones = justRes && Array.isArray(justRes.justificaciones) ? justRes.justificaciones : [];
    const mapJustificaciones = {};
    listaJustificaciones.forEach(j => {
      const fNorm = normalizarFecha(j.fecha);
      const dniKey = String(j.dni || '').trim();
      if (fNorm && dniKey) {
        mapJustificaciones[`${fNorm}_${dniKey}`] = j.motivo || 'Permiso Justificado';
      }
    });

    const registrosBase = dashRes && Array.isArray(dashRes.registros) ? [...dashRes.registros] : [];
    registrosBase.forEach(r => {
      if (r.fecha) r.fecha = normalizarFecha(r.fecha);
      if (!r.horaSalida) r.horaSalida = '--:--';
      const key = `${r.fecha}_${r.dni}`;
      if (mapJustificaciones[key]) {
        r.estado = 'Justificado';
        r.motivo = mapJustificaciones[key];
      }
    });

    const registrosPorFechaDni = new Set();
    const fechasEnGas = new Set();
    registrosBase.forEach(r => {
      fechasEnGas.add(r.fecha);
      registrosPorFechaDni.add(`${r.fecha}_${r.dni}`);
    });

    if (gvizText) {
      const lines = gvizText.split('\n').filter(l => l.trim().length > 0);
      const gvizPorFecha = {};
      const gvizMapSalida = {};

      for (let i = 1; i < lines.length; i++) {
        const parts = parseCSVLine(lines[i]);
        const f = normalizarFecha(parts[0]);
        const h = parts[1] || '--:--';
        const d = parts[2] ? parts[2].replace(/^"|"$/g, '').trim() : '';
        const nom = parts[3] ? parts[3].replace(/^"|"$/g, '').trim() : '';
        let est = parts[4] ? parts[4].replace(/^"|"$/g, '').trim() : 'Asistió';
        const hSalida = parts[8] && parts[8] !== 'null' && parts[8].trim() !== '' ? parts[8].replace(/^"|"$/g, '').trim() : '--:--';
        
        if (f && d) {
          const key = `${f}_${d}`;
          if (mapJustificaciones[key]) {
            est = 'Justificado';
          }
          if (!gvizPorFecha[f]) gvizPorFecha[f] = [];
          gvizPorFecha[f].push({ fecha: f, hora: h, horaSalida: hSalida, dni: d, nombre: nom, estado: est, motivo: mapJustificaciones[key] || '' });
          if (hSalida !== '--:--') {
            gvizMapSalida[key] = hSalida;
          }
        }
      }

      // Actualizar horaSalida si está disponible en GViz
      registrosBase.forEach(r => {
        const key = `${r.fecha}_${r.dni}`;
        if (gvizMapSalida[key] && (!r.horaSalida || r.horaSalida === '--:--')) {
          r.horaSalida = gvizMapSalida[key];
        }
      });

      const estudiantesLista = estRes && Array.isArray(estRes.estudiantes) ? estRes.estudiantes : [];

      for (const fKey in gvizPorFecha) {
        if (!fechasEnGas.has(fKey)) {
          const escaneados = gvizPorFecha[fKey];
          const dnisEscaneados = new Set(escaneados.map(e => e.dni));

          escaneados.forEach(e => {
            const key = `${e.fecha}_${e.dni}`;
            registrosBase.push({
              fecha: e.fecha,
              timestamp: Date.now(),
              hora: e.hora,
              horaSalida: e.horaSalida || '--:--',
              dni: e.dni,
              nombre: e.nombre,
              estado: e.estado,
              motivo: e.motivo || ''
            });
            registrosPorFechaDni.add(key);
          });

          estudiantesLista.forEach(est => {
            const dniVal = String(est.dni || '').trim();
            const key = `${fKey}_${dniVal}`;
            if (dniVal && !dnisEscaneados.has(dniVal) && !registrosPorFechaDni.has(key)) {
              let estadoFinal = 'Falta';
              let motivoFinal = '';
              if (mapJustificaciones[key]) {
                estadoFinal = 'Justificado';
                motivoFinal = mapJustificaciones[key];
              }
              registrosBase.push({
                fecha: fKey,
                timestamp: Date.now(),
                hora: '--:--',
                horaSalida: '--:--',
                dni: dniVal,
                nombre: est.nombre,
                estado: estadoFinal,
                motivo: motivoFinal
              });
              registrosPorFechaDni.add(key);
            }
          });
        }
      }

      // Incluir justificaciones en fechas donde no hubo escaneos
      listaJustificaciones.forEach(j => {
        const fNorm = normalizarFecha(j.fecha);
        const dniVal = String(j.dni || '').trim();
        const key = `${fNorm}_${dniVal}`;
        if (!registrosPorFechaDni.has(key)) {
          registrosBase.push({
            fecha: fNorm,
            timestamp: Date.now(),
            hora: '--:--',
            horaSalida: '--:--',
            dni: dniVal,
            nombre: j.nombre || 'Estudiante',
            estado: 'Justificado',
            motivo: j.motivo
          });
          registrosPorFechaDni.add(key);
        }
      });
    }

    const asistencias = registrosBase.filter(r => r.estado && r.estado.includes('Asisti')).length;
    const tardanzas = registrosBase.filter(r => r.estado === 'Tardanza').length;
    const faltas = registrosBase.filter(r => r.estado === 'Falta').length;
    const justificados = registrosBase.filter(r => r.estado === 'Justificado').length;
    const total = registrosBase.length;
    const porcentaje = total > 0 ? Math.round(((asistencias + tardanzas + justificados) / total) * 100) : 0;

    return {
      success: true,
      filtros: { meses },
      metricas: { total, asistencias, tardanzas, faltas, justificados, porcentaje },
      registros: registrosBase
    };
  } catch (err) {
    console.error('Error al obtener dashboard:', err);
    return {
      success: false,
      message: err.message,
      registros: [],
      metricas: { total: 0, asistencias: 0, tardanzas: 0, faltas: 0, justificados: 0, porcentaje: 0 }
    };
  }
};


// --- Módulo de Justificaciones y Permisos ---
export const obtenerJustificaciones = async () => {
  try {
    const exportUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${GID_JUSTIFICACIONES}`;
    const [resExport, estRes] = await Promise.all([
      fetch(exportUrl).then(r => r.ok ? r.text() : '').catch(() => ''),
      obtenerEstudiantes().catch(() => ({ success: false }))
    ]);

    let rawText = resExport;
    if (!rawText || !rawText.toLowerCase().includes('dni')) {
      const gvizUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=Justificaciones`;
      rawText = await fetch(gvizUrl).then(r => r.ok ? r.text() : '').catch(() => '');
    }

    if (!rawText || !rawText.toLowerCase().includes('dni')) {
      const gasRes = await request(`${GAS_URL}?action=obtener_justificaciones`).catch(() => null);
      if (gasRes && gasRes.success && Array.isArray(gasRes.justificaciones)) {
        return { success: true, justificaciones: gasRes.justificaciones };
      }
    }

    const estudiantes = estRes && Array.isArray(estRes.estudiantes) ? estRes.estudiantes : [];
    const estMap = {};
    estudiantes.forEach(e => {
      if (e.dni) estMap[String(e.dni).trim()] = e;
    });

    const lines = (rawText || '').split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const lista = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = parseCSVLine(lines[i]);
      if (parts.length >= 2) {
        const fecha = normalizarFecha(parts[0]);
        const dni = parts[1] ? parts[1].replace(/^"|"$/g, '').trim() : '';
        const motivo = parts.slice(2).join(', ').replace(/^"|"$/g, '').trim();

        if (dni && /^\d{8}$/.test(dni)) {
          const est = estMap[dni];
          lista.push({
            id: `JUST-${fecha}-${dni}-${i}`,
            fila: i + 1,
            fecha: fecha,
            dni: dni,
            motivo: motivo || 'Sin detalle especificado',
            nombre: est ? est.nombre : 'Estudiante no registrado',
            grado: est ? est.grado : '',
            nivel: est ? est.nivel : '',
            gradoCompleto: est ? (est.nivel ? `${est.grado} - ${est.nivel}` : est.grado) : ''
          });
        }
      }
    }

    lista.reverse();

    return {
      success: true,
      justificaciones: lista
    };
  } catch (err) {
    console.error('Error al obtener justificaciones:', err);
    return {
      success: false,
      message: err.message,
      justificaciones: []
    };
  }
};

export const eliminarJustificacion = (dni, fecha) => request(GAS_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain' },
  body: JSON.stringify({ action: 'eliminar_justificacion', dni, fecha })
});

export const buscarEstudiantePorDni = dni => request(`${GAS_URL}?action=buscar_estudiante&dni=${dni}`);

export const justificarFalta = (dni, fecha, motivo) => request(GAS_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain' },
  body: JSON.stringify({ action: 'justificar', dni, fecha, motivo })
});

export const obtenerEstudiantes = () => request(`${GAS_URL}?action=estudiantes`);

export const obtenerHistorialPadre = async (dni) => {
  try {
    const [res, justRes] = await Promise.all([
      request(`${GAS_URL}?action=consulta_padre&dni=${dni}`),
      obtenerJustificaciones().catch(() => ({ success: false, justificaciones: [] }))
    ]);

    const justifsEstudiante = (justRes && Array.isArray(justRes.justificaciones)) 
      ? justRes.justificaciones.filter(j => String(j.dni).trim() === String(dni).trim())
      : [];
    const mapJ = {};
    justifsEstudiante.forEach(j => {
      mapJ[normalizarFecha(j.fecha)] = j.motivo;
    });

    try {
      const gvizUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=Registro_Diario`;
      const gRes = await fetch(gvizUrl);
      if (gRes.ok) {
        const text = await gRes.text();
        const lines = text.split('\n').filter(l => l.trim().length > 0);
        const mapSalida = {};
        for (let i = 1; i < lines.length; i++) {
          const parts = parseCSVLine(lines[i]);
          const f = parts[0] ? normalizarFecha(parts[0]) : '';
          const d = parts[2] ? parts[2].replace(/^"|"$/g, '').trim() : '';
          const hSalida = parts[8] && parts[8] !== 'null' && parts[8].trim() !== '' ? parts[8].replace(/^"|"$/g, '').trim() : '--:--';
          if (f && d === String(dni).trim() && hSalida !== '--:--') {
            mapSalida[f] = hSalida;
          }
        }
        if (res && res.success && Array.isArray(res.historial)) {
          const fechasEnHistorial = new Set();
          res.historial.forEach(h => {
            const fNorm = normalizarFecha(h.fecha);
            fechasEnHistorial.add(fNorm);
            if (mapSalida[fNorm]) {
              h.horaSalida = mapSalida[fNorm];
            } else if (!h.horaSalida) {
              h.horaSalida = '--:--';
            }
            if (mapJ[fNorm]) {
              h.estado = 'Justificado';
              h.motivo = mapJ[fNorm];
            }
          });

          // Agregar fechas justificadas que no estaban en Registro_Diario
          for (const fJustif in mapJ) {
            if (!fechasEnHistorial.has(fJustif)) {
              res.historial.push({
                fecha: fJustif,
                hora: '--:--',
                horaSalida: '--:--',
                estado: 'Justificado',
                motivo: mapJ[fJustif]
              });
              fechasEnHistorial.add(fJustif);
            }
          }

          // Recalcular estadísticas del estudiante
          let asist = 0, tard = 0, falt = 0, just = 0;
          res.historial.forEach(h => {
            if (h.estado === 'Justificado') just++;
            else if (h.estado.includes('Asisti')) asist++;
            else if (h.estado === 'Tardanza') tard++;
            else if (h.estado === 'Falta') falt++;
          });
          res.estadisticas = { asistencias: asist, tardanzas: tard, faltas: falt, justificados: just };
        }
      }
    } catch (e) {
      // Continuar si falla GViz
    }
    return res;
  } catch (err) {
    throw err;
  }
};

// --- Registro Manual ---
export const obtenerGrados = () => request(`${GAS_URL}?action=grados_disponibles`);

export const obtenerEstudiantesPorGrado = grado => request(`${GAS_URL}?action=estudiantes_por_grado&grado=${encodeURIComponent(grado)}`);

export const obtenerAsistenciaDia = fecha => request(`${GAS_URL}?action=asistencia_dia&fecha=${encodeURIComponent(fecha)}`);

export const registrarManualLote = (registros, fecha) => request(GAS_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain' },
  body: JSON.stringify({ action: 'registrar_manual_lote', registros, fecha })
});

// --- Calendario Anual (Días No Laborables / Feriados) ---
export const obtenerDiasNoLaborables = async () => {
  try {
    const url = 'https://docs.google.com/spreadsheets/d/1S78EzSmPc7jlyd0_hKzaUSPGaCL45_ZOaivyNft_t-A/gviz/tq?tqx=out:csv&sheet=CALENDARIO_ANUAL';
    const res = await fetch(url);
    if (!res.ok) return [];
    const text = await res.text();
    const lines = text.split('\n').filter(l => l.trim().length > 0);
    const noLaborables = [];

    const normalizarFecha = (str) => {
      if (!str) return '';
      str = str.replace(/['"]/g, '').trim();
      if (str.includes('/')) {
        const parts = str.split('/');
        if (parts.length === 3) {
          const d = parts[0].padStart(2, '0');
          const m = parts[1].padStart(2, '0');
          const y = parts[2];
          return `${d}/${m}/${y}`;
        }
      }
      if (str.includes('-')) {
        const parts = str.split('-');
        if (parts.length === 3 && parts[0].length === 4) {
          return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
        }
      }
      return str;
    };

    lines.slice(1).forEach(l => {
      const parts = l.split(',').map(p => p.replace(/^"|"$/g, '').trim());
      if (parts[1] && parts[1].toUpperCase() === 'NO') {
        const fNorm = normalizarFecha(parts[0]);
        if (fNorm) noLaborables.push(fNorm);
      }
    });

    return noLaborables;
  } catch (err) {
    console.error('Error al obtener dias no laborables:', err);
    return [];
  }
};


// --- Módulo de Docentes y Tareas Escolares ---
export const verificarDocente = async (dni) => {
  try {
    const res = await request(`${GAS_URL}?action=login_docente&dni=${dni}`).catch(() => null);
    if (res && res.success && res.docente) {
      return res;
    }

    // Fallback GViz en tiempo real directo a BD_Docentes
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=BD_Docentes`;
    const gRes = await fetch(gvizUrl);
    if (gRes.ok) {
      const text = await gRes.text();
      const lines = text.split('\n').filter(l => l.trim().length > 0);
      for (let i = 1; i < lines.length; i++) {
        const parts = parseCSVLine(lines[i]);
        const dFila = parts[0] ? parts[0].replace(/^"|"$/g, '').trim() : '';
        const nomFila = parts[1] ? parts[1].replace(/^"|"$/g, '').trim() : '';
        const nivFila = parts[2] ? parts[2].replace(/^"|"$/g, '').trim() : '';
        const telFila = parts[3] ? parts[3].replace(/^"|"$/g, '').trim() : '';
        if (dFila === String(dni).trim()) {
          return {
            success: true,
            docente: {
              dni: dFila,
              nombre: nomFila,
              nivel: nivFila,
              telefono: telFila,
              estado: 'Activo'
            }
          };
        }
      }
      return { success: false, message: 'DNI no encontrado en el padrón de docentes. Solicita tu registro en BD_Docentes.' };
    }

    return res || { success: false, message: 'No se pudo verificar el docente.' };
  } catch (err) {
    return { success: false, message: 'Error de conexión: ' + err.message };
  }
};

export const obtenerTareas = async (grado = '', dniDocente = '') => {
  try {
    let url = `${GAS_URL}?action=obtener_tareas`;
    if (grado) url += `&grado=${encodeURIComponent(grado)}`;
    if (dniDocente) url += `&dniDocente=${encodeURIComponent(dniDocente)}`;
    
    // Intentar primero con GAS
    const res = await request(url).catch(() => null);
    if (res && res.success && Array.isArray(res.tareas)) {
      return res;
    }

    // Fallback GViz en tiempo real si GAS está desplegando
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=Tareas_Escolares`;
    const gRes = await fetch(gvizUrl);
    if (gRes.ok) {
      const text = await gRes.text();
      const lines = text.split('\n').filter(l => l.trim().length > 0);
      const headerLine = lines[0] ? lines[0].toLowerCase() : '';

      // Si la hoja Tareas_Escolares no existe aun en Google Sheets, GViz devuelve por defecto
      // la primera hoja (BD_Estudiantes con 104 alumnos). Validamos los encabezados reales de Tareas:
      if (!headerLine.includes('tarea') && !headerLine.includes('descripcion')) {
        return { success: true, tareas: [] };
      }

      const tareas = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = parseCSVLine(lines[i]);
        const id = parts[0] ? parts[0].replace(/^"|"$/g, '').trim() : '';
        
        // Toda tarea valida tiene ID con prefijo TAR-
        if (!id || !id.startsWith('TAR-')) continue;

        const fReg = parts[1] ? normalizarFecha(parts[1]) : '';
        const g = parts[2] ? parts[2].replace(/^"|"$/g, '').trim() : '';
        const c = parts[3] ? parts[3].replace(/^"|"$/g, '').trim() : '';
        const doc = parts[4] ? parts[4].replace(/^"|"$/g, '').trim() : '';
        const desc = parts[5] ? parts[5].replace(/^"|"$/g, '').trim() : '';
        const fEnt = parts[6] ? normalizarFecha(parts[6]) : '';
        const est = parts[7] ? parts[7].replace(/^"|"$/g, '').trim() : 'Activa';
        const dDoc = parts[8] ? parts[8].replace(/^"|"$/g, '').trim() : '';
        if (grado && grado !== 'TODOS') {
          const gNorm = g.toLowerCase().replace(/[\s-]+/g, '');
          const fNorm = grado.toLowerCase().replace(/[\s-]+/g, '');
          if (gNorm !== fNorm && !gNorm.includes(fNorm) && !fNorm.includes(gNorm)) {
            continue;
          }
        }
        if (dniDocente && dDoc && dDoc !== dniDocente) continue;

        tareas.push({
          id,
          fechaRegistro: fReg,
          grado: g,
          curso: c,
          docente: doc,
          descripcion: desc,
          fechaEntrega: fEnt,
          estado: est,
          dniDocente: dDoc
        });
      }
      return { success: true, tareas: tareas.reverse() };
    }

    return { success: true, tareas: [] };
  } catch (err) {
    console.error('Error al obtener tareas:', err);
    return { success: false, message: err.message, tareas: [] };
  }
};

export const registrarTarea = (data) => request(GAS_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain' },
  body: JSON.stringify({ action: 'registrar_tarea', ...data })
});

export const finalizarTarea = (idTarea, dniDocente) => request(GAS_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain' },
  body: JSON.stringify({ action: 'finalizar_tarea', idTarea, dniDocente })
});

export const eliminarTarea = (idTarea, dniDocente) => request(GAS_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain' },
  body: JSON.stringify({ action: 'eliminar_tarea', idTarea, dniDocente })
});
