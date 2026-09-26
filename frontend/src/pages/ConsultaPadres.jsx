import React, { useState } from 'react';
import { obtenerHistorialPadre } from '../services/api';

const ConsultaPadres = () => {
  const [dni, setDni] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (dni.length !== 8) {
      setError('El DNI debe tener 8 dígitos numéricos.');
      return;
    }
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const result = await obtenerHistorialPadre(dni);
      if (result.success) {
        setData(result);
      } else {
        setError(result.message || 'No se encontró el historial para este DNI.');
      }
    } catch (err) {
      setError('Hubo un problema de conexión. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Portal de Padres</h2>
          <p className="text-gray-600">Consulta el historial de asistencia de tu hijo/a ingresando su DNI.</p>
        </div>

        <div className="bg-white rounded-xl shadow-md overflow-hidden mb-8">
          <div className="p-6">
            <form onSubmit={handleSearch} className="flex gap-4 items-center">
              <input
                type="text"
                placeholder="Ingresar DNI (8 dígitos)"
                className="flex-1 px-4 py-3 text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                value={dni}
                onChange={(e) => setDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
                maxLength={8}
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || dni.length !== 8}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : 'Consultar'}
              </button>
            </form>

            {error && (
              <div className="mt-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded">
                <p>{error}</p>
              </div>
            )}
          </div>
        </div>

        {data && data.estudiante && (
          <div className="bg-white rounded-xl shadow-md overflow-hidden animate-fade-in-up">
            <div className="bg-blue-600 p-6 text-white">
              <h3 className="text-xl font-bold">{data.estudiante.nombre}</h3>
              <p className="text-blue-100 mt-1">DNI: {data.estudiante.dni} | {data.estudiante.grado} - {data.estudiante.nivel}</p>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-green-50 p-4 rounded-lg border border-green-100 text-center">
                  <div className="text-sm text-green-600 font-semibold mb-1">Asistencias</div>
                  <div className="text-3xl font-bold text-green-700">{data.estadisticas?.asistencias || 0}</div>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100 text-center">
                  <div className="text-sm text-yellow-600 font-semibold mb-1">Tardanzas</div>
                  <div className="text-3xl font-bold text-yellow-700">{data.estadisticas?.tardanzas || 0}</div>
                </div>
                <div className="bg-red-50 p-4 rounded-lg border border-red-100 text-center">
                  <div className="text-sm text-red-600 font-semibold mb-1">Faltas</div>
                  <div className="text-3xl font-bold text-red-700">{data.estadisticas?.faltas || 0}</div>
                </div>
              </div>

              <h4 className="font-bold text-gray-800 mb-4 border-b pb-2">Últimos Registros</h4>
              
              {(!data.historial || data.historial.length === 0) ? (
                <p className="text-gray-500 text-center py-4">No hay registros de asistencia disponibles.</p>
              ) : (
                <div className="space-y-3">
                  {data.historial.map((registro, idx) => {
                    let badgeColor = 'bg-gray-100 text-gray-800';
                    if (registro.estado.includes('Asisti')) badgeColor = 'bg-green-100 text-green-800';
                    else if (registro.estado === 'Tardanza') badgeColor = 'bg-yellow-100 text-yellow-800';
                    else if (registro.estado === 'Falta') badgeColor = 'bg-red-100 text-red-800';

                    return (
                      <div key={idx} className="flex justify-between items-center p-4 hover:bg-gray-50 border border-gray-100 rounded-lg transition-colors">
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900">{registro.fecha}</span>
                          <span className="text-sm text-gray-500">{registro.hora || '--:--'}</span>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${badgeColor}`}>
                          {registro.estado}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConsultaPadres;
