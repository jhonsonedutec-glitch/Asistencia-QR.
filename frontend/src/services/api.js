const request = async (url, options={}) => { const r=await fetch(url,options); const data=await r.json().catch(()=>({success:false,message:'Respuesta inválida'})); if(!r.ok) throw new Error(data.message||'Error de servidor'); return data; };
export const registrarAsistencia = dni => request('/api/attendance',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dni})});
export const obtenerDashboard = meses => request(`/api/dashboard?meses=${meses}`);
export const buscarEstudiantePorDni = dni => request(`/api/attendance?action=buscar_estudiante&dni=${dni}`);