import { useCallback, useState } from 'react';
import QRScanner from '../components/QRScanner';
import { registrarAsistencia } from '../services/api';

const playSound = (type) => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (type === 'success') {
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // High pitch beep
      gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
      oscillator.start();
      gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.3);
      oscillator.stop(audioCtx.currentTime + 0.3);
    } else {
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(150, audioCtx.currentTime); // Low pitch buzzer
      gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
      oscillator.start();
      gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.4);
      oscillator.stop(audioCtx.currentTime + 0.4);
    }
  } catch (error) {
    console.error('Audio playback failed', error);
  }
};

export default function Scanner() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Conmutador automático inteligente para los DOS turnos:
  // - Turno Mañana (Primaria):
  //     • Ingreso: Hasta las 11:15 AM (675 min) -> 'entrada'
  //     • Salida: 11:15 AM a 1:15 PM (675 a 795 min) -> 'salida'
  // - Turno Tarde (Secundaria):
  //     • Ingreso: 1:15 PM a 3:30 PM (795 a 930 min) -> 'entrada'
  //     • Salida: A partir de las 3:30 PM (> 930 min) -> 'salida'
  const [tipoRegistro, setTipoRegistro] = useState(() => {
    const ahora = new Date();
    const min = ahora.getHours() * 60 + ahora.getMinutes();
    if (min >= 675 && min < 795) return 'salida'; // Salida Turno Mañana (Primaria)
    if (min >= 930) return 'salida';              // Salida Turno Tarde (Secundaria)
    return 'entrada';                             // Ingreso Mañana (<11:15) o Ingreso Tarde (13:15 a 15:30)
  });

  const process = useCallback(async (dni) => {
    if (!dni) {
      setResult({ success: false, message: 'No se pudo acceder a la cámara.' });
      return;
    }
    
    setLoading(true);
    setResult(null);
    
    try {
      const response = await registrarAsistencia(dni, tipoRegistro);
      setResult(response);
      playSound(response.success ? 'success' : 'error');
    } catch (e) {
      setResult({ success: false, message: e.message });
      playSound('error');
    } finally {
      setLoading(false);
    }
  }, [tipoRegistro]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mx-auto max-w-xl text-center">
        <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider text-white ${
          tipoRegistro === 'salida' ? 'bg-blue-600' : 'bg-emerald-600'
        }`}>
          {tipoRegistro === 'salida' ? '🚪 Control de Salida Escolar' : '🟢 Control de Ingreso Escolar'}
        </span>
        <h1 className="mt-3 text-3xl font-black text-white md:text-4xl">
          {tipoRegistro === 'salida' ? 'Escanear Salida' : 'Escanear Asistencia'}
        </h1>
        <p className="mt-2 text-slate-400">
          {tipoRegistro === 'salida' 
            ? 'Registra la hora de retiro del alumno para trazabilidad completa.'
            : 'El código QR debe contener únicamente el DNI del estudiante.'}
        </p>
      </div>
      
      <div className="mx-auto mt-6 max-w-lg rounded-3xl border border-blue-900/50 bg-slate-900/60 p-5 shadow-2xl backdrop-blur-md">
        
        {/* Selector de Modo: ENTRADA / SALIDA */}
        <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-slate-950/80 p-1.5 border border-slate-800 shadow-inner">
          <button
            type="button"
            onClick={() => { setTipoRegistro('entrada'); setResult(null); }}
            className={`py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all ${
              tipoRegistro === 'entrada'
                ? 'bg-emerald-600 text-white shadow-lg border border-emerald-400/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <span>🟢</span>
            <span>ENTRADA</span>
            {tipoRegistro === 'entrada' && (
              <span className="ml-1 text-[10px] bg-emerald-500/30 px-1.5 py-0.5 rounded-full font-mono">ACTIVO</span>
            )}
          </button>
          
          <button
            type="button"
            onClick={() => { setTipoRegistro('salida'); setResult(null); }}
            className={`py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all ${
              tipoRegistro === 'salida'
                ? 'bg-blue-600 text-white shadow-lg border border-blue-400/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <span>🚪</span>
            <span>SALIDA</span>
            {tipoRegistro === 'salida' && (
              <span className="ml-1 text-[10px] bg-blue-500/30 px-1.5 py-0.5 rounded-full font-mono">ACTIVO</span>
            )}
          </button>
        </div>

        {loading ? (
          <div className="grid min-h-80 place-items-center">
            <div className="text-center">
              <div className={`mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-700 ${
                tipoRegistro === 'salida' ? 'border-t-blue-500' : 'border-t-emerald-500'
              }`} />
              <p className="mt-4 font-semibold text-slate-200">
                {tipoRegistro === 'salida' ? 'Registrando salida escolar...' : 'Registrando ingreso escolar...'}
              </p>
            </div>
          </div>
        ) : result ? (
          <div className={`min-h-80 flex flex-col justify-center items-center rounded-2xl p-6 ${
            result.success 
              ? (result.tipo === 'salida' ? 'bg-blue-600/20 border border-blue-500/50 text-white' : 'bg-emerald-600/20 border border-emerald-500/50 text-white')
              : 'bg-red-500/20 border border-red-500/50 text-white'
          }`}>
            <div className={`flex h-16 w-16 items-center justify-center rounded-full ${
              result.success 
                ? (result.tipo === 'salida' ? 'bg-blue-600' : 'bg-emerald-600') 
                : 'bg-red-500'
            } text-3xl font-black shadow-lg`}>
              {result.success ? (result.tipo === 'salida' ? '👋' : '✓') : '!'}
            </div>
            <h2 className="mt-4 text-center text-xl font-bold">{result.message}</h2>
            {result.estudiante && (
              <div className="mt-4 w-full rounded-xl bg-slate-900/80 p-4 text-center text-sm shadow-inner border border-slate-800">
                <p className="text-lg font-black text-blue-300">{result.estudiante.nombre}</p>
                <p className="text-slate-300 mt-1">{result.estudiante.grado} · {result.estudiante.nivel}</p>
                {result.asistencia && (
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                    <div className="inline-flex items-center gap-2 rounded-lg bg-slate-800/90 px-3 py-1.5 font-medium text-xs">
                      <span className="text-slate-400">📅 {result.asistencia.fecha}</span>
                      <span className="text-slate-600">•</span>
                      <span className="text-emerald-400 font-bold">🕒 Ent: {result.asistencia.hora || '--:--'}</span>
                      {result.asistencia.horaSalida && result.asistencia.horaSalida !== '--:--' && (
                        <>
                          <span className="text-slate-600">•</span>
                          <span className="text-blue-400 font-bold">🚪 Sal: {result.asistencia.horaSalida}</span>
                        </>
                      )}
                      <span className="text-slate-600">•</span>
                      <span className={`font-bold ${
                        result.asistencia.estado && result.asistencia.estado.includes('Asisti') 
                          ? 'text-emerald-400' 
                          : result.asistencia.estado === 'Falta' 
                          ? 'text-red-400' 
                          : 'text-amber-400'
                      }`}>
                        {result.asistencia.estado}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
            <button 
              onClick={() => setResult(null)}
              className="mt-6 w-full rounded-xl bg-slate-800 py-3 font-bold text-white shadow hover:bg-slate-700 transition"
            >
              Escanear Siguiente Alumno
            </button>
          </div>
        ) : (
          <QRScanner onScan={process} />
        )} 
      </div>
    </main>
  );
}
