# 🚀 RUTA TÉCNICA DE MIGRACIÓN: DE GOOGLE SHEETS A FIREBASE
## Proyecto: Sistema Escolar Integral IEP MILLENIUM (Asistencia QR, Portal Familiar y Cafetería)

---

## 1. Justificación y Objetivos de la Migración

Actualmente, el sistema opera exitosamente con **Google Sheets + Google Apps Script (GAS)** como backend. Aunque es una solución económica y accesible, presenta limitaciones inherentes para una operación en producción de alto tráfico:

| Criterio | Arquitectura Actual (Google Sheets / GAS) | Arquitectura Objetivo (Firebase) |
| :--- | :--- | :--- |
| **Tiempo de Respuesta (Latencia)** | 1.8s - 4.5s por petición (por cold-starts y límites de cuota de Apps Script). | **50ms - 150ms** (Firestore globalmente distribuido). |
| **Actualizaciones en Tiempo Real** | Polling periódico (cada 15 segundos mediante `setInterval`). | **WebSockets nativos (`onSnapshot`)**: actualización instantánea (sub-segundo) en cocina y portal. |
| **Concurrencia y Transacciones** | Bloqueo por software (`LockService`), susceptible a tiempos de espera y cuota de 30 ejecuciones simultáneas. | **Transacciones Atómicas (`runTransaction`)**: cero condiciones de carrera en cobros y recargas. |
| **Almacenamiento Multimedia** | Base64 en celdas de Sheets o enlaces manuales a Drive. | **Firebase Cloud Storage**: URLs firmadas con CDN global, optimización de caché y seguridad. |
| **Autenticación y Roles** | Consulta por DNI sin tokens criptográficos de sesión. | **Firebase Authentication**: sesiones JWT seguras, roles personalizados (`claims`: `admin`, `caja`, `docente`, `padre`). |
| **Escalabilidad** | Límite práctico de 5 a 10 millones de celdas en Sheets; lentitud con más de 10,000 filas. | **Escalabilidad masiva y automática** sin degradación de rendimiento. |

---

## 2. Arquitectura Objetivo en Firebase

```
┌────────────────────────────────────────────────────────────────────────┐
│                          CLIENTE (SPA)                                 │
│       React 19 + Vite + Tailwind CSS + Firebase SDK v10 (Modular)      │
│   (Escáner QR, Caja Rápida POS, Comandas Cocina, Portal de Padres)     │
└───────────────┬────────────────────────┬──────────────────────┬────────┘
                │                        │                      │
       Auth SDK │          Firestore SDK │          Storage SDK │
                ▼                        ▼                      ▼
┌──────────────────────┐  ┌──────────────────────┐  ┌────────────────────┐
│    Firebase Auth     │  │   Cloud Firestore    │  │  Firebase Storage  │
│  - Email/Pass Admin  │  │  (NoSQL Realtime DB) │  │  - Vouchers Yape   │
│  - DNI / Anónimo     │  │  - Colecciones ACID  │  │  - Fotos Alimentos │
│  - Custom Claims     │  │  - onSnapshot sync   │  │  - Fotos Carnet    │
└──────────────────────┘  └──────────┬───────────┘  └────────────────────┘
                                     │ Triggers / Background Tasks
                                     ▼
                          ┌──────────────────────┐
                          │   Cloud Functions    │
                          │     (Node.js v20)    │
                          │ - Auditoría de Saldo │
                          │ - Reportes Automáticos│
                          │ - Notificaciones Push│
                          └──────────────────────┘
```

---

## 3. Modelo de Datos NoSQL (Mapeo de Hojas a Colecciones)

### 3.1. Colección `estudiantes` (Reemplaza `BD_Estudiantes`)
* **Ruta:** `/estudiantes/{dni}`
* **Estructura del Documento:**
```json
{
  "dni": "62423378",
  "nombres": "JULCA BARRETO LEONARDO FARID",
  "grado": "4to Secundaria",
  "nivel": "Secundaria",
  "fotoUrl": "https://firebasestorage.googleapis.com/.../foto.jpg",
  "telefonoApoderado": "941234567",
  "activo": true,
  "creadoEn": "2026-08-10T12:00:00Z"
}
```

### 3.2. Colección `billeteras` (Reemplaza `Cafeteria_Saldos`)
* **Ruta:** `/billeteras/{dni}`
* **Estructura del Documento:**
```json
{
  "dni": "62423378",
  "saldo": 4.70,
  "totalRecargado": 11.00,
  "totalConsumido": 6.30,
  "ultimaActualizacion": "2026-11-15T18:36:00Z"
}
```
* **Subcolección `/billeteras/{dni}/movimientos` (Auditoría inmutable):**
```json
{
  "idMovimiento": "MOV-1794785",
  "tipo": "CONSUMO" | "RECARGA" | "AJUSTE_MANUAL" | "REEMBOLSO",
  "monto": 3.50,
  "saldoAnterior": 8.20,
  "saldoRestante": 4.70,
  "motivo": "Lonchera Recreo: Sándwich de Pollo Especial",
  "referenciaId": "PED-20261115-01",
  "fechaHora": "2026-11-15T17:57:38Z"
}
```

### 3.3. Colección `asistencias` (Reemplaza `Registro_Diario`)
* **Ruta:** `/asistencias/{YYYY-MM-DD_DNI}` (El ID compuesto previene automáticamente dobles registros por día).
* **Estructura:**
```json
{
  "fecha": "2026-11-15",
  "hora": "08:05:12",
  "dni": "62423378",
  "estudiante": "JULCA BARRETO LEONARDO FARID",
  "grado": "4to Secundaria",
  "nivel": "Secundaria",
  "estado": "PUNTUAL" | "TARDANZA",
  "metodo": "QR_ESCANER" | "MANUAL",
  "timestamp": "2026-11-15T13:05:12Z"
}
```

### 3.4. Colección `cafeteria_productos` (Reemplaza `Cafeteria_Productos`)
* **Ruta:** `/cafeteria_productos/{productoId}`
* **Estructura:**
```json
{
  "nombre": "Sándwich de Pollo Especial",
  "categoria": "Sándwiches y hamburguesas",
  "precio": 3.50,
  "disponible": true,
  "menuHoy": true,
  "fotoUrl": "https://firebasestorage.googleapis.com/.../sandwich.jpg",
  "orden": 1,
  "creadoEn": "2026-10-01T10:00:00Z"
}
```

### 3.5. Colección `cafeteria_pedidos` (Reemplaza `Cafeteria_Pedidos`)
* **Ruta:** `/cafeteria_pedidos/{pedidoId}`
* **Estructura:**
```json
{
  "idPedido": "PED-20261115_183600-288",
  "fechaRegistro": "2026-11-15",
  "horaRegistro": "18:36:00",
  "fechaEntrega": "2026-11-15",
  "dni": "62423378",
  "estudiante": "JULCA BARRETO LEONARDO FARID",
  "grado": "4to Secundaria",
  "items": [
    { "id": "PROD-1", "nombre": "Chicha Morada Casera (500ml)", "cantidad": 1, "precio": 0.50 }
  ],
  "total": 0.50,
  "turnoEntrega": "RECREO" | "ALMUERZO" | "MOSTRADOR",
  "indicaciones": "bien frío",
  "metodoPago": "SALDO_BILLETERA" | "EFECTIVO" | "YAPE_DIRECTO",
  "estado": "PENDIENTE" | "EN_PREPARACION" | "LISTO_ENTREGA" | "ENTREGADO",
  "atendidoPor": "Caja 1",
  "entregadoEn": "2026-11-15T18:37:10Z"
}
```

### 3.6. Colección `cafeteria_recargas` (Reemplaza `Cafeteria_Recargas`)
* **Ruta:** `/cafeteria_recargas/{recargaId}`
* **Estructura:**
```json
{
  "idRecarga": "YAPE-20261115_125618-812",
  "dni": "62423378",
  "estudiante": "JULCA BARRETO LEONARDO FARID",
  "grado": "4to Secundaria",
  "monto": 5.00,
  "metodo": "Yape",
  "codigoOperacion": "12345678",
  "comprobanteUrl": "https://firebasestorage.googleapis.com/.../voucher.jpg",
  "estado": "PENDIENTE" | "APROBADA" | "RECHAZADA",
  "motivoRechazo": "",
  "validadoPor": "Caja 1",
  "validadoEn": "2026-11-15T13:44:06Z",
  "creadoEn": "2026-11-15T12:56:18Z"
}
```

### 3.7. Colección `cafeteria_ventas` (Reemplaza `Cafeteria_Ventas`)
* **Ruta:** `/cafeteria_ventas/{ventaId}` (Auditoría contable para arqueo de caja).

---

## 4. Estrategia de Migración en 6 Fases

```
[FASE 1: Setup Firebase] ──► [FASE 2: Data Extraction & Seed] ──► [FASE 3: Service Layer SDK]
                                                                           │
[FASE 6: Cutover Final] ◄── [FASE 5: Storage & Security] ◄── [FASE 4: Atomic Transactions]
```

### Fase 1: Creación y Configuración del Proyecto Firebase
1. Crear proyecto en la [Consola de Firebase](https://console.firebase.google.com/): `iep-millenium-asistencia`.
2. Habilitar **Cloud Firestore** en modo producción (Región: `southamerica-east1` São Paulo o `us-central1`).
3. Habilitar **Firebase Storage** para almacenamiento de imágenes.
4. Habilitar **Firebase Authentication** (Métodos: Email/Password para personal de cafetería/dirección, y Anonymous o Custom Token por DNI para portal de padres).
5. Instalar Firebase CLI en la estación de desarrollo:
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

### Fase 2: Script de Migración de Datos (Google Sheets ➔ Firestore)
* Desarrollar y ejecutar un script automatizado (`scripts/migrar_sheets_a_firestore.js`) utilizando `firebase-admin`:
  1. Extraer los datos actuales desde Google Sheets mediante exportación CSV/JSON o Google Sheets API.
  2. Subir en bloques (`writeBatch` de 500 registros) a las colecciones de Firestore.
  3. Verificar conteos y sumas de saldos (`Cafeteria_Saldos` vs `/billeteras`).

### Fase 3: Capa de Servicios Híbrida (`frontend/src/services/`)
* Instalar `firebase` en el frontend:
  ```bash
  cd frontend
  npm install firebase
  ```
* Crear `src/services/firebase.js` con la inicialización del cliente.
* Crear `src/services/firestoreCafeteria.js` y `src/services/firestoreAsistencia.js` con las mismas firmas que las funciones actuales de `api.js` (`obtenerProductosCafeteria`, `registrarVentaCaja`, etc.).
* Implementar un interruptor en variables de entorno:
  ```env
  VITE_USE_FIREBASE=true
  ```
  Esto permite alternar instantáneamente entre Google Apps Script y Firebase para pruebas comparativas sin romper nada en producción.

### Fase 4: Reemplazo de Polling por Listeners en Tiempo Real (`onSnapshot`)
* En `CafeteriaAdmin.jsx` (Comandas de Cocina) y `ConsultaPadres.jsx` (Historial):
  * **Antes:** `setInterval(cargarPedidos, 15000)` (demora hasta 15 segundos en enterarse de un nuevo pedido).
  * **Con Firebase:** `onSnapshot(query(collection(db, 'cafeteria_pedidos'), ...), callback)`:
    * **Latencia 0:** En el momento exacto en que un padre da clic a "Confirmar Pedido", aparece en la pantalla de la cafetería con sonido instantáneo.
    * En el momento en que la cocinera presiona "Entregar", el padre ve el estado "Entregado" sin refrescar la página.

### Fase 5: Transacciones Atómicas para Cobros y Billetera
* Para prevenir saldos negativos o doble consumo, los cobros se implementan con `runTransaction`:
```javascript
import { runTransaction, doc } from 'firebase/firestore';
import { db } from './firebase';

export async function cobrarConSaldoTransaccional(dni, totalCobro, detalleVenta) {
  const billeteraRef = doc(db, 'billeteras', dni);
  const ventaRef = doc(db, 'cafeteria_ventas', generateId());

  return await runTransaction(db, async (transaction) => {
    const billeteraSnap = await transaction.get(billeteraRef);
    if (!billeteraSnap.exists()) {
      throw new Error('El alumno no tiene billetera registrada.');
    }

    const saldoActual = billeteraSnap.data().saldo || 0;
    if (saldoActual < totalCobro) {
      throw new Error(`Saldo insuficiente (Disponible: S/ ${saldoActual.toFixed(2)}).`);
    }

    const nuevoSaldo = saldoActual - totalCobro;
    transaction.update(billeteraRef, {
      saldo: nuevoSaldo,
      totalConsumido: (billeteraSnap.data().totalConsumido || 0) + totalCobro,
      ultimaActualizacion: new Date().toISOString()
    });

    transaction.set(ventaRef, {
      dni,
      total: totalCobro,
      ...detalleVenta,
      saldoRestante: nuevoSaldo,
      timestamp: new Date().toISOString()
    });

    return { success: true, nuevoSaldo };
  });
}
```

### Fase 6: Despliegue en Firebase Hosting & Cutover
1. Configurar `firebase.json`:
   ```json
   {
     "hosting": {
       "public": "frontend/dist",
       "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
       "rewrites": [{ "source": "**", "destination": "/index.html" }]
     }
   }
   ```
2. Compilar y desplegar:
   ```bash
   cd frontend && npm run build
   firebase deploy --only hosting,firestore,storage
   ```
3. Realizar pruebas finales en paralelo.
4. Desconectar los endpoints de Apps Script una vez validada la estabilidad.

---

## 5. Estimación de Costos (Plan Gratuito Spark vs. Blaze)

Firebase cuenta con un plan gratuito (**Spark**) extremadamente generoso:

| Servicio | Límite Gratuito Diario (Spark) | Demanda Estimada IEP MILLENIUM | Costo Estimado |
| :--- | :--- | :--- | :--- |
| **Firestore Lecturas** | 50,000 lecturas/día | ~3,000 a 8,000 / día | **$0.00 (Gratis)** |
| **Firestore Escrituras** | 20,000 escrituras/día | ~300 a 1,200 / día | **$0.00 (Gratis)** |
| **Firestore Almacenamiento** | 1 GB total | ~50 MB de datos | **$0.00 (Gratis)** |
| **Cloud Storage** | 5 GB almacenamiento / 1 GB descarga/día | ~500 MB de fotos/vouchers | **$0.00 (Gratis)** |
| **Hosting Transferencia** | 10 GB/mes | ~2 GB/mes | **$0.00 (Gratis)** |

> [!TIP]
> Para la escala operativa de la IEP MILLENIUM (~300 a 800 alumnos), el sistema correrá **completamente dentro de la capa gratuita ($0.00 / mes)** de Firebase, con un rendimiento profesional infinitamente superior a Google Sheets.

---

## 6. Checklist de Implementación y Tareas Pendientes

- [x] Respaldo completo del proyecto original en `D:\Trabajos de Programacion\Copias originales de Proyectos\Asistencia-QR-BACKUP-2026-11-15\`.
- [x] Documentación técnica de la ruta de migración (`RUTA_MIGRACION_FIREBASE.md`).
- [ ] Crear proyecto en Firebase Console (`iep-millenium`).
- [ ] Crear archivo de reglas `firestore.rules` y `storage.rules`.
- [ ] Configurar SDK modular de Firebase en `frontend/src/services/firebase.js`.
- [ ] Desarrollar script de extracción y carga de Google Sheets a Firestore.
- [ ] Migrar el módulo de Cafetería y Comandas a listeners en tiempo real (`onSnapshot`).
- [ ] Migrar el módulo de Asistencia QR a Firestore.
- [ ] Desplegar en Firebase Hosting.
