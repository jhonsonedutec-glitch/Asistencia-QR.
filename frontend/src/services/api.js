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