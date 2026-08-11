import {useEffect,useState,useMemo} from 'react';
import {obtenerDashboard} from '../services/api';
import {ResponsiveContainer,BarChart,Bar,XAxis,YAxis,Tooltip,Cell,CartesianGrid} from 'recharts';

export default function Dashboard(){
  const [months,setMonths]=useState(1);
  const [selectedDate, setSelectedDate] = useState('');
  const [data,setData]=useState(null);
  const [error,setError]=useState('');
  const [loading, setLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  useEffect(()=>{
    setLoading(true);
    obtenerDashboard(months).then(res => {
      setData(res);
      setLoading(false);
    }).catch(e=>{
      setError(e.message);
      setLoading(false);
    })
  },[months]);

  // Local filtering based on selected date
  const filteredData = useMemo(() => {
    if (!data) return null;
    let registros = data.registros || [];
    
    if (selectedDate) {
      // selectedDate comes as YYYY-MM-DD
      const [y, m, d] = selectedDate.split('-');
      const formattedDate = `${d}/${m}/${y}`; // Matches GAS 'dd/MM/yyyy'
      registros = registros.filter(r => r.fecha === formattedDate);
    }
    
    const asistencias = registros.filter(r => r.estado === 'Asistió').length;
    const tardanzas = registros.filter(r => r.estado === 'Tardanza').length;
    const faltas = registros.filter(r => r.estado === 'Falta').length;
    const justificados = registros.filter(r => r.estado === 'Justificado').length;
    const total = registros.length;
    // Justificados count positively towards attendance percentage
    const porcentaje = total > 0 ? Math.round(((asistencias + tardanzas + justificados) / total) * 100) : 0;

    return {
      registros,
      metricas: { total, asistencias, tardanzas, faltas, justificados, porcentaje }
    };
  }, [data, selectedDate]);

  const studentHistory = useMemo(() => {
    if (!selectedStudent || !data) return null;
    const regs = data.registros.filter(r => r.dni === selectedStudent);
    if (!regs.length) return null;
    
    const asistencias = regs.filter(r => r.estado === 'Asistió').length;
    const tardanzas = regs.filter(r => r.estado === 'Tardanza').length;
    const faltas = regs.filter(r => r.estado === 'Falta').length;
    const justificados = regs.filter(r => r.estado === 'Justificado').length;
    const total = regs.length;
    const porcentaje = total > 0 ? Math.round(((asistencias + tardanzas + justificados) / total) * 100) : 0;
    
    return { 
      nombre: regs[0].nombre, 
      dni: selectedStudent, 
      regs, 
      metricas: { total, asistencias, tardanzas, faltas, justificados, porcentaje } 
    };
  }, [selectedStudent, data]);

  const downloadCSV = () => {
    if (!filteredData || !filteredData.registros.length) return;
    const headers = ['Fecha,Hora,DNI,Estudiante,Estado'];
    const rows = filteredData.registros.map(r => `${r.fecha},${r.hora},${r.dni},"${r.nombre}",${r.estado}`);
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + headers.concat(rows).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `asistencia_${selectedDate || 'historico'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const m = filteredData?.metricas || {total:0, asistencias:0, tardanzas:0, faltas:0, justificados:0, porcentaje:0};
  
  const chart = [
    {name:'Asistió', total: m.asistencias, color: '#10b981'}, // emerald-500
    {name:'Tardanza', total: m.tardanzas, color: '#f59e0b'}, // amber-500
    {name:'Falta', total: m.faltas, color: '#ef4444'}, // red-500
    {name:'Justif.', total: m.justificados, color: '#8b5cf6'} // violet-500
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 relative">
      {/* Header & Controls */}
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-8">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-blue-400">Dirección</span>
          <h1 className="mt-1 text-3xl font-black text-white md:text-4xl shadow-sm">Dashboard Ejecutivo</h1>
          <p className="mt-2 text-slate-400">Análisis y resumen de asistencia estudiantil.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <button 
            onClick={downloadCSV}
            className="rounded-xl border border-blue-600 bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-inner hover:bg-blue-700 transition self-end sm:self-auto mb-1"
          >
            Descargar CSV
          </button>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-400 ml-1">Filtrar por Fecha</label>
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-2.5 text-sm text-white shadow-inner focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-400 ml-1">Periodo Base</label>
            <select 
              value={months} 
              onChange={(e) => setMonths(Number(e.target.value))}
              className="rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-2.5 text-sm text-white shadow-inner focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            >
              <option value={1}>Último Mes</option>
              <option value={3}>Últimos 3 Meses</option>
              <option value={6}>Último Semestre</option>
              <option value={12}>Último Año</option>
            </select>
          </div>
        </div>
      </div>

      {error && <div className="mb-6 rounded-2xl bg-red-500/20 border border-red-500/50 p-4 text-red-200">{error}</div>}
      {loading && <div className="mb-6 text-blue-400 text-sm font-semibold animate-pulse">Actualizando datos...</div>}

      {/* KPI Cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative overflow-hidden rounded-3xl border border-emerald-900/40 bg-gradient-to-b from-slate-800/80 to-slate-900/80 p-6 shadow-xl backdrop-blur-md">
          <p className="text-sm font-medium text-emerald-400">Asistencias</p>
          <p className="mt-2 text-4xl font-black text-white">{m.asistencias}</p>
        </div>
        <div className="relative overflow-hidden rounded-3xl border border-amber-900/40 bg-gradient-to-b from-slate-800/80 to-slate-900/80 p-6 shadow-xl backdrop-blur-md">
          <p className="text-sm font-medium text-amber-400">Tardanzas</p>
          <p className="mt-2 text-4xl font-black text-white">{m.tardanzas}</p>
        </div>
        <div className="relative overflow-hidden rounded-3xl border border-red-900/40 bg-gradient-to-b from-slate-800/80 to-slate-900/80 p-6 shadow-xl backdrop-blur-md">
          <p className="text-sm font-medium text-red-400">Faltas</p>
          <p className="mt-2 text-4xl font-black text-white">{m.faltas}</p>
        </div>
        <div className="relative overflow-hidden rounded-3xl border border-blue-900/40 bg-gradient-to-b from-slate-800/80 to-slate-900/80 p-6 shadow-xl backdrop-blur-md">
          <p className="text-sm font-medium text-blue-400">Asistencia Global</p>
          <p className="mt-2 text-4xl font-black text-white">{m.porcentaje}%</p>
          <div className="mt-3 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
             <div className="h-full bg-blue-500 rounded-full" style={{width: `${m.porcentaje}%`}}></div>
          </div>
        </div>
      </section>

      {/* Charts & Table */}
      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        
        {/* Chart */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-xl backdrop-blur-sm">
          <h2 className="mb-6 font-bold text-white text-lg">Comparativo de Estado</h2>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" tick={{fill: '#94a3b8', fontSize: 13}} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} stroke="#94a3b8" tick={{fill: '#94a3b8', fontSize: 13}} axisLine={false} tickLine={false} />
                <Tooltip 
                  cursor={{fill: '#334155', opacity: 0.2}}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '0.75rem', color: '#f8fafc' }}
                  itemStyle={{ color: '#f8fafc' }}
                />
                <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={80}>
                  {chart.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/50 shadow-xl backdrop-blur-sm flex flex-col h-full lg:max-h-[380px]">
          <div className="border-b border-slate-800 p-6 shrink-0">
            <h2 className="font-bold text-white text-lg">Registros Recientes {selectedDate && '(Filtrados)'}</h2>
            <p className="text-xs text-slate-400 mt-1">Haz clic en un estudiante para ver su historial.</p>
          </div>
          <div className="overflow-auto flex-1 custom-scrollbar">
            <table className="w-full text-left text-sm whitespace-nowrap relative">
              <thead className="bg-slate-800/80 text-slate-400 sticky top-0 z-10 backdrop-blur-sm">
                <tr>
                  <th className="px-6 py-4 font-semibold">Fecha</th>
                  <th className="px-6 py-4 font-semibold">Hora</th>
                  <th className="px-6 py-4 font-semibold">Estudiante</th>
                  <th className="px-6 py-4 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {(filteredData?.registros || []).map((r, i) => (
                  <tr 
                    key={i} 
                    onClick={() => setSelectedStudent(r.dni)}
                    className="transition-colors hover:bg-slate-800/60 text-slate-300 cursor-pointer"
                  >
                    <td className="px-6 py-4">{r.fecha}</td>
                    <td className="px-6 py-4 text-slate-400">{r.hora}</td>
                    <td className="px-6 py-4 font-medium text-blue-400 hover:text-blue-300 transition-colors">{r.nombre}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        r.estado === 'Asistió' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                        r.estado === 'Tardanza' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 
                        r.estado === 'Justificado' ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20' : 
                        'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {r.estado}
                      </span>
                    </td>
                  </tr>
                ))}
                {(!filteredData?.registros || filteredData.registros.length === 0) && (
                  <tr>
                    <td colSpan="4" className="px-6 py-10 text-center text-slate-500">
                      No hay registros para este periodo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Student History Modal */}
      {selectedStudent && studentHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl relative flex flex-col overflow-hidden max-h-[90vh]">
            
            <div className="p-6 border-b border-slate-800 flex justify-between items-start bg-slate-800/50">
              <div>
                <h3 className="text-xl font-bold text-white">{studentHistory.nombre}</h3>
                <p className="text-sm text-slate-400 mt-1">DNI: {studentHistory.dni} · Periodo: {months} mes(es)</p>
              </div>
              <button 
                onClick={() => setSelectedStudent(null)} 
                className="text-slate-400 hover:text-white text-3xl leading-none -mt-2"
              >
                &times;
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-center">
                  <div className="text-2xl font-black text-emerald-400">{studentHistory.metricas.asistencias}</div>
                  <div className="text-xs font-semibold text-emerald-500/70 uppercase tracking-wider mt-1">Asistencias</div>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-center">
                  <div className="text-2xl font-black text-amber-400">{studentHistory.metricas.tardanzas}</div>
                  <div className="text-xs font-semibold text-amber-500/70 uppercase tracking-wider mt-1">Tardanzas</div>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-center">
                  <div className="text-2xl font-black text-red-400">{studentHistory.metricas.faltas}</div>
                  <div className="text-xs font-semibold text-red-500/70 uppercase tracking-wider mt-1">Faltas</div>
                </div>
                <div className="bg-violet-500/10 border border-violet-500/20 rounded-2xl p-4 text-center">
                  <div className="text-2xl font-black text-violet-400">{studentHistory.metricas.justificados}</div>
                  <div className="text-xs font-semibold text-violet-500/70 uppercase tracking-wider mt-1">Permisos</div>
                </div>
              </div>

              <h4 className="font-bold text-slate-300 mb-3">Detalle de registros</h4>
              <div className="rounded-2xl border border-slate-700 overflow-hidden">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-800 text-slate-400">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Fecha</th>
                      <th className="px-4 py-3 font-semibold">Hora</th>
                      <th className="px-4 py-3 font-semibold">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {studentHistory.regs.map((r, i) => (
                      <tr key={i} className="bg-slate-900/50 hover:bg-slate-800/50 text-slate-300">
                        <td className="px-4 py-3">{r.fecha}</td>
                        <td className="px-4 py-3 text-slate-400">{r.hora}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                            r.estado === 'Asistió' ? 'text-emerald-400' : 
                            r.estado === 'Tardanza' ? 'text-amber-400' : 
                            r.estado === 'Justificado' ? 'text-violet-400' : 
                            'text-red-400'
                          }`}>
                            {r.estado}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
