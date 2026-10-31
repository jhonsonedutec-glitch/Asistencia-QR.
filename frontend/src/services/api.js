const GAS_URL = 'https://script.google.com/macros/s/AKfycbypcAyDZRhiv_3z-5OqjkZ5MkAmZeHzzg2LF_NiRvXBrGHE-wiHYASf08STy2GMWDh0/exec';

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

export const obtenerDashboard = meses => request(`${GAS_URL}?action=dashboard&meses=${meses}`);

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
