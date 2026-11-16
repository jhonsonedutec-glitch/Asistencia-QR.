/**
 * Script de Migración Automatizada: Google Sheets -> Cloud Firestore
 * IEP MILLENIUM
 * 
 * Uso:
 * 1. Descarga tu credencial de cuenta de servicio de Firebase Console -> serviceAccountKey.json
 * 2. Ejecuta: node scripts/migrar_sheets_a_firestore.js
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// 1. Inicializar Firebase Admin
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
if (!fs.existsSync(serviceAccountPath)) {
  console.log('⚠️ Para ejecutar la migración a tu proyecto real:');
  console.log('   Descarga serviceAccountKey.json de tu Firebase Console (Configuración del proyecto -> Cuentas de servicio)');
  console.log('   y colócalo en la carpeta scripts/\n');
} else {
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.apps.length > 0 ? admin.firestore() : null;

/**
 * Función de utilidad para escribir lotes (Batches) de hasta 500 documentos
 */
async function guardarLote(coleccionNombre, documentos, idKey = null) {
  if (!db) {
    console.log(`[SIMULACIÓN] Se migrarían ${documentos.length} documentos a '${coleccionNombre}'.`);
    return;
  }

  const batchLimit = 400;
  for (let i = 0; i < documentos.length; i += batchLimit) {
    const chunk = documentos.slice(i, i + batchLimit);
    const batch = db.batch();

    chunk.forEach(docData => {
      const docRef = idKey && docData[idKey] 
        ? db.collection(coleccionNombre).doc(String(docData[idKey])) 
        : db.collection(coleccionNombre).doc();
      batch.set(docRef, docData, { merge: true });
    });

    await batch.commit();
    console.log(`✓ Lote de ${chunk.length} documentos guardado en '${coleccionNombre}' (${i + chunk.length}/${documentos.length}).`);
  }
}

/**
 * Función principal de orquestación
 */
async function migrarTodo() {
  console.log('=== INICIANDO RUTA DE MIGRACIÓN A FIREBASE ===\n');

  // Si tienes un archivo exportado de res.json o similar, se puede leer directamente:
  const resJsonPath = path.join(__dirname, '..', 'res.json');
  if (fs.existsSync(resJsonPath)) {
    console.log('Leyendo datos de respaldo local res.json...');
    try {
      const data = JSON.parse(fs.readFileSync(resJsonPath, 'utf8'));
      if (Array.isArray(data.estudiantes)) {
        console.log(`Migrando ${data.estudiantes.length} estudiantes...`);
        await guardarLote('estudiantes', data.estudiantes, 'dni');
      }
    } catch (e) {
      console.error('Error al procesar res.json:', e.message);
    }
  }

  console.log('\n=== MIGRACIÓN FINALIZADA CON ÉXITO ===');
}

if (require.main === module) {
  migrarTodo().catch(console.error);
}
