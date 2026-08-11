const request = async (url, options={}) => { const r=await fetch(url,options); const data=await r.json().catch(()=>({success:false,message:'Respuesta inválida'})); if(!r.ok) throw new Error(data.message||'Error de servidor'); return data; };
export const registrarAsistencia = dni => request(`/api/exec?action=registrar&dni=${dni}`,{method:'POST'});
export const obtenerDashboard = meses => request(`/api/exec?action=dashboard&meses=${meses}`);
export const buscarEstudiantePorDni = dni => request(`/api/exec?action=buscar_estudiante&dni=${dni}`);