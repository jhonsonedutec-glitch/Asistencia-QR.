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

  const process = useCallback(async (dni) => {
    if (!dni) {
      setResult({ success: false, message: 'No se pudo acceder a la cámara.' });
      return;
    }
    
    setLoading(true);
    setResult(null);
    
    try {
      const response = await registrarAsistencia(dni);
      setResult(response);
      playSound(response.success ? 'success' : 'error');
    } catch (e) {
      setResult({ success: false, message: e.message });
      playSound('error');
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="mx-auto max-w-xl text-center">
        <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">Registro en tiempo real</span>
        <h1 className="mt-4 text-3xl font-black text-white md:text-4xl">Escanear asistencia</h1>
        <p className="mt-2 text-slate-400">El QR debe contener únicamente el DNI del estudiante.</p>
      </div>
      
      <div className="mx-auto mt-8 max-w-lg rounded-3xl border border-blue-900/50 bg-slate-900/50 p-5 shadow-xl shadow-blue-950/5 backdrop-blur-sm">
        {loading ? (
          <div className="grid min-h-80 place-items-center">
            <div className="text-center">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-blue-600" />
              <p className="mt-4 font-semibold">Registrando asistencia...</p>
            </div>
          </div>
        ) : (
          <QRScanner onScan={process} />
        )} 
        
        {result && (
          <div className={`mt-5 rounded-2xl p-5 ${result.success ? 'bg-blue-600/50 text-white' : 'bg-red-500/50 text-white'}`}>
            <div className="text-center text-3xl">{result.success ? '✓' : '!'}</div>
            <h2 className="mt-2 text-center font-bold">{result.message}</h2>
            {result.estudiante && (
              <div className="mt-4 text-center text-sm">
                <p className="font-bold">{result.estudiante.nombre}</p>
                <p>{result.estudiante.grado} · {result.estudiante.nivel}</p>
                {result.asistencia && (
                  <p className="mt-2">{result.asistencia.fecha} · {result.asistencia.hora} · <b>{result.asistencia.estado}</b></p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}