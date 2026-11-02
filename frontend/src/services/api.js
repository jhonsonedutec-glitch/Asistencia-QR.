const GAS_URL = 'https://script.google.com/macros/s/AKfycbypcAyDZRhiv_3z-5OqjkZ5MkAmZeHzzg2LF_NiRvXBrGHE-wiHYASf08STy2GMWDh0/exec';
const SPREADSHEET_ID = '1S78EzSmPc7jlyd0_hKzaUSPGaCL45_ZOaivyNft_t-A';

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

export const registrarAsistencia = dni => request(GAS_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain' },
  body: JSON.stringify({ action: 'registrar', dni: dni })
});

// Dashboard Consolidado (GAS + GViz en tiempo real para evitar inconsistencias de formato)
export const obtenerDashboard = async (meses = 1) => {
  try {
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=Registro_Diario`;

    const [dashRes, gvizText, estRes] = await Promise.all([
      request(`${GAS_URL}?action=dashboard&meses=${meses}`).catch(() => ({ success: false })),
      fetch(gvizUrl).then(r => r.ok ? r.text() : '').catch(() => ''),
      obtenerEstudiantes().catch(() => ({ success: false }))
    ]);

    const registrosBase = dashRes && Array.isArray(dashRes.registros) ? [...dashRes.registros] : [];
    registrosBase.forEach(r => {
      if (r.fecha) r.fecha = normalizarFecha(r.fecha);
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

      for (let i = 1; i < lines.length; i++) {
        const parts = parseCSVLine(lines[i]);
        const f = normalizarFecha(parts[0]);
        const h = parts[1] || '--:--';
        const d = parts[2] ? parts[2].replace(/^"|"$/g, '').trim() : '';
        const nom = parts[3] ? parts[3].replace(/^"|"$/g, '').trim() : '';
        const est = parts[4] ? parts[4].replace(/^"|"$/g, '').trim() : 'Asistió';
        if (f && d) {
          if (!gvizPorFecha[f]) gvizPorFecha[f] = [];
          gvizPorFecha[f].push({ fecha: f, hora: h, dni: d, nombre: nom, estado: est });
        }
      }

      const estudiantesLista = estRes && Array.isArray(estRes.estudiantes) ? estRes.estudiantes : [];

      for (const fKey in gvizPorFecha) {
        if (!fechasEnGas.has(fKey)) {
          const escaneados = gvizPorFecha[fKey];
          const dnisEscaneados = new Set(escaneados.map(e => e.dni));

          escaneados.forEach(e => {
            registrosBase.push({
              fecha: e.fecha,
              timestamp: Date.now(),
              hora: e.hora,
              dni: e.dni,
              nombre: e.nombre,
              estado: e.estado
            });
            registrosPorFechaDni.add(`${e.fecha}_${e.dni}`);
          });

          estudiantesLista.forEach(est => {
            const dniVal = String(est.dni || '').trim();
            if (dniVal && !dnisEscaneados.has(dniVal) && !registrosPorFechaDni.has(`${fKey}_${dniVal}`)) {
              registrosBase.push({
                fecha: fKey,
                timestamp: Date.now(),
                hora: '--:--',
                dni: dniVal,
                nombre: est.nombre,
                estado: 'Falta'
              });
              registrosPorFechaDni.add(`${fKey}_${dniVal}`);
            }
          });
        }
      }
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


export const buscarEstudiantePorDni = dni => request(`${GAS_URL}?action=buscar_estudiante&dni=${dni}`);

export const justificarFalta = (dni, fecha, motivo) => request(GAS_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain' },
  body: JSON.stringify({ action: 'justificar', dni, fecha, motivo })
});

export const obtenerEstudiantes = () => request(`${GAS_URL}?action=estudiantes`);

export const obtenerHistorialPadre = dni => request(`${GAS_URL}?action=consulta_padre&dni=${dni}`);

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
