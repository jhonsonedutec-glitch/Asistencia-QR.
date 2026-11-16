# 📄 FICHA TÉCNICA DEL SISTEMA
## Sistema Integral de Asistencia QR, Portal Familiar y Cafetería Escolar
### Institución Educativa Particular (IEP) MILLENIUM — Bagua, Amazonas

---

## 1. Información General del Software

| Parámetro | Detalle |
| :--- | :--- |
| **Nombre del Sistema** | Sistema Escolar Integral IEP MILLENIUM |
| **Versión Actual** | v2.6.0 (Preparación de Arquitectura Firebase & Respaldo) |
| **Última Actualización** | 15 de Noviembre de 2026 |
| **Tipo de Aplicación** | Aplicación Web Progresiva / SPA (Single Page Application) |
| **Sede / Ubicación** | 29 de Agosto N° 169 - Bagua - Capital, Amazonas, Perú |
| **Contacto de Soporte** | quintanahumanluis@gmail.com |
| **Repositorio** | `https://github.com/jhonsonedutec-glitch/Asistencia-QR..git` |
| **Entorno de Producción** | Vercel (Frontend) + Google Apps Script Serverless (Backend) |

---

## 2. Pila Tecnológica (Tech Stack)

### 2.1. Frontend
* **Core:** React 19 (Hooks, Context, Web Audio API).
* **Empaquetador & Build Tool:** Vite v8.2.1.
* **Enrutamiento:** `react-router-dom` v7.
* **Estilos y Diseño:** Tailwind CSS con tema Dark Mode institucional, layouts responsivos y animaciones fluidas.
* **Librerías Clave:**
  * `html5-qrcode`: Motor de escaneo por cámara de códigos QR con balance automático de exposición.
  * `qrcode.react`: Generación vectorial (SVG/Canvas) de códigos QR para carnets y pagos Yape.
  * `recharts`: Renderizado de gráficas estadísticas interactivas para tableros de control directivo.

### 2.2. Backend & API Serverless
* **Plataforma:** Google Apps Script (GAS) en motor JavaScript V8.
* **Arquitectura de API:** Endpoint único RESTful vía Web App con manejo de `doGet` y `doPost` (CORS amigable mediante payloads `text/plain`).
* **Bloqueo Concurrente:** `LockService.getScriptLock()` para operaciones atómicas de saldo y caja, garantizando consistencia contra condiciones de carrera.

### 2.3. Persistencia y Almacenamiento
* **Motor de Base de Datos:** Google Sheets institucional (`SPREADSHEET_ID: 1S78EzSmPc7jlyd0_hKzaUSPGaCL45_ZOaivyNft_t-A`).
* **Almacenamiento de Multimedia (Comprobantes y Fotos):** Google Drive / Base64 Data URLs optimizadas para imágenes de comprobantes Yape y fotos del catálogo de cafetería.

---

## 3. Arquitectura del Modelo de Datos (Google Sheets)

El sistema opera sobre una base de datos relacional modelada en 9 hojas de cálculo sincronizadas:

### 3.1. `BD_Estudiantes` (Padrón Escolar)
| Columna | Nombre de Campo | Tipo | Descripción |
| :---: | :--- | :--- | :--- |
| A | DNI | String | Documento Nacional de Identidad (Llave Primaria) |
| B | Apellidos y Nombres | String | Nombre completo del alumno |
| C | Grado | String | Grado (ej. 4to Secundaria, 1er Primaria) |
| D | Nivel | String | Nivel educativo: `Primaria` o `Secundaria` |
| E | Foto | String (URL) | Enlace o fotografía del alumno para el carnet |
| F | Teléfono Apoderado | String | Número de contacto de WhatsApp del padre |

### 3.2. `Registro_Diario` (Marcaciones de Asistencia)
| Columna | Nombre de Campo | Tipo | Descripción |
| :---: | :--- | :--- | :--- |
| A | ID | String | Identificador único de marcación (`YYYYMMDD-DNI`) |
| B | Fecha | String | Fecha de marcación en formato `DD/MM/YYYY` |
| C | Hora | String | Hora exacta de escaneo `HH:mm:ss` |
| D | DNI | String | DNI del alumno |
| E | Estudiante | String | Nombre completo |
| F | Grado | String | Grado y sección |
| G | Nivel | String | Primaria o Secundaria |
| H | Estado | String | `Puntual` o `Tardanza` |

### 3.3. `Justificaciones` (Permisos e Inasistencias)
Almacena las solicitudes enviadas por apoderados con fecha de ausencia, motivo y archivo adjunto de evidencia.

### 3.4. `Cafeteria_Productos` (Catálogo y Menú de Cafetería)
| Columna | Nombre de Campo | Tipo | Descripción |
| :---: | :--- | :--- | :--- |
| A | ID_Producto | String | Identificador autogenerado (`PROD-TIMESTAMP`) |
| B | Nombre | String | Nombre del plato, bebida o snack |
| C | Categoría | String | Desayunos, Platos preparados, Bebidas, etc. |
| D | Precio | Number | Precio unitario en Soles (S/) |
| E | Disponible | Boolean | `TRUE` si está habilitado en el catálogo |
| F | Menu_Hoy | Boolean | `TRUE` si se ofrece en el menú del día |
| G | Foto | String (URL/Base64) | Imagen del producto para el portal de compras |

### 3.5. `Cafeteria_Pedidos` (Comandas de Cocina)
| Columna | Nombre de Campo | Tipo | Descripción |
| :---: | :--- | :--- | :--- |
| A | ID_Pedido | String | Código de pedido (`PED-TIMESTAMP-RANDOM`) |
| B | Fecha_Registro | String | Fecha de registro `DD/MM/YYYY` |
| C | Hora_Registro | String | Hora de registro `HH:mm:ss` |
| D | DNI | String | DNI del alumno |
| E | Estudiante | String | Nombres y apellidos |
| F | Grado | String | Grado escolar |
| G | Detalle_Productos | String (JSON/Text) | Lista de productos y cantidades compradas |
| H | Total | Number | Monto total de la comanda en S/ |
| I | Turno_Entrega | String | `RECREO`, `ALMUERZO` o `MOSTRADOR` |
| J | Indicaciones | String | Notas especiales (ej. "sin mayonesa") |
| K | Metodo_Pago | String | `SALDO_ESTUDIANTE`, `EFECTIVO`, `YAPE_DIRECTO` |
| L | Estado | String | `PENDIENTE`, `EN_PREPARACION`, `LISTO_ENTREGA`, `ENTREGADO` |
| M | Atendido_Por | String | Caja o personal responsable |
| N | Fecha_Entrega_Plan | String | Fecha objetivo de entrega |

### 3.6. `Cafeteria_Recargas` (Comprobantes Yape)
| Columna | Nombre de Campo | Tipo | Descripción |
| :---: | :--- | :--- | :--- |
| A | ID_Recarga | String | Código único (`YAPE-TIMESTAMP-RANDOM`) |
| B | Fecha | String | Fecha de solicitud |
| C | Hora | String | Hora de solicitud |
| D | DNI | String | DNI del alumno |
| E | Estudiante | String | Nombre del alumno |
| F | Grado | String | Grado del alumno |
| G | Monto | Number | Monto recargado en S/ |
| H | Metodo | String | Yape |
| I | Codigo_Operacion | String | Número o código de operación del voucher |
| J | Comprobante_URL | String (URL/Base64) | Imagen del comprobante de pago |
| K | Estado | String | `Pendiente`, `Aprobada`, `Rechazada` |
| L | Validado_Por | String | Usuario o caja que validó la recarga |
| M | Fecha_Validacion | String | Timestamp de aprobación o rechazo |

### 3.7. `Cafeteria_Saldos` (Billeteras Digitales de Alumnos)
| Columna | Nombre de Campo | Tipo | Descripción |
| :---: | :--- | :--- | :--- |
| A | DNI | String | Llave primaria del estudiante |
| B | Estudiante | String | Nombre completo |
| C | Grado | String | Grado |
| D | Nivel | String | Primaria / Secundaria |
| E | Saldo | Number | Saldo actual disponible en Soles (S/) |
| F | Total_Recargado | Number | Sumatoria histórica de recargas aprobadas |
| G | Total_Consumido | Number | Sumatoria histórica de consumos realizados |
| H | Ultima_Actualizacion| String | Fecha y hora del último movimiento |

### 3.8. `Cafeteria_Ventas` (Arqueo y Registro Financiero)
Almacena cada transacción completada en el POS o por comanda entregada, con el método de pago utilizado, desglose de montos y saldos anterior/restante para arqueo de caja diario.

---

## 4. Módulos y Reglas de Negocio Implementadas

```
+---------------------------------------------------------------------------------+
|                       MÓDULOS DEL SISTEMA IEP MILLENIUM                         |
+--------------------------+------------------------------+-----------------------+
|  1. ASISTENCIA QR        |  2. PORTAL DE FAMILIAS       |  3. CAFETERÍA ADMIN   |
|  - Escáner Cámara        |  - Consulta de Asistencia    |  - POS Caja Rápida    |
|  - Tolerancia Primaria   |  - Billetera Digital         |  - Comandas Cocina    |
|  - Tolerancia Secundaria |  - Menú y Lonchera Virtual   |  - Validar Yapes      |
|  - Bloqueo de duplicados |  - Recarga Yape con Voucher  |  - Menú y Precios     |
|  - Generador Carnets     |  - Trazabilidad de 3 Vías    |  - Reportes & RESET   |
+--------------------------+------------------------------+-----------------------+
```

### 4.1. Módulo de Asistencia QR
* **Horarios y Tolerancias:**
  * Primaria: 08:00 AM entrada. De 08:01 a 08:15 AM se considera tolerancia puntual. A partir de 08:16 AM registra **Tardanza**.
  * Secundaria: 14:00 (02:00 PM) entrada. De 14:01 a 14:15 tolerancia. A partir de 14:16 registra **Tardanza**.
* **Bloqueo Duplicado:** Una vez escaneado el DNI, se bloquea cualquier segundo escaneo durante la misma jornada.

### 4.2. Portal de Padres y Lonchera Digital
* **Identidad Visual:** Banner oficial con el logotipo de la Cafetería y Restaurante **"Las Palmeras"**.
* **Protección Preventiva de Saldo:** Antes de emitir cualquier pedido de lonchera, el sistema verifica que `Saldo_Disponible >= Total_Pedido`. Si el saldo es insuficiente, muestra la alerta interactiva bloqueando la transacción en descubierto.
* **Turno de Entrega Programado:** Permite elegir entre entrega en el **Recreo** o en el **Almuerzo**, con indicaciones libres para el chef.
* **Trazabilidad 360°:** El padre cuenta con 3 pestañas especializadas en su historial:
  1. *Consumos:* Detalle de qué consumió el estudiante, precios y saldo restante.
  2. *Recargas:* Estado en tiempo real del voucher enviado (Pendiente, Aprobada, Rechazada).
  3. *Pedidos:* Seguimiento del estado de preparación de la lonchera.

### 4.3. Cafetería POS y Administración
* **Despacho Inteligente de Loncheras al Escanear QR:**
  * Al escanear el carnet QR de un alumno en la Caja Rápida (POS), el sistema detecta de forma automática si tiene una lonchera o pedido programado para hoy (`Cafeteria_Pedidos`).
  * Despliega una tarjeta destacada con el detalle completo del pedido (productos, turno, notas especiales e indicación de pago ya realizado por el padre).
  * Habilita un botón de acción rápida `[ ✅ Entregar Lonchera ]` tanto en la tarjeta del estudiante como en el botón principal del ticket de venta (evitando el estado deshabilitado de S/ 0.00).
  * Con 1 solo clic se marca como `ENTREGADO` en la base de datos, suena el aviso sonoro y se notifica al portal del padre, evitando dobles cobros y agilizando la atención en el recreo.
* **Búsqueda Inteligente:** Búsqueda en vivo en la caja por **DNI** o por **Nombre y Apellidos** (insensible a acentos y mayúsculas).
* **Cobro en Efectivo:** Entrada de monto recibido con cálculo de vuelto y ventana modal gigante para evitar errores humanos en caja.
* **Escanear QR en Comandas de Cocina:** Incorporación de lector QR y buscador en la pestaña de Comandas para ubicar y despachar pedidos directamente desde la cocina.
* **Anulación de Pedidos con Reembolso:**
  * Al pulsar el botón `[ 🗑️ ]` en cualquier comanda, se solicita confirmación.
  * Si el pedido fue pagado con la billetera del alumno, **se reembolsa el importe de inmediato** a `Cafeteria_Saldos`.
  * Se elimina la fila de `Cafeteria_Pedidos` y de `Cafeteria_Ventas`, evitando distorsiones en las métricas contables.
* **Herramienta de Reinicio a Cero (`RESET`):**
  * Ubicada en la pestaña de **Reportes Directivos**.
  * Permite limpiar todas las órdenes de prueba, ventas y recargas acumuladas durante las fases de ensayo, colocando los saldos de alumnos en S/ 0.00.
  * **Mecanismo de Seguridad:** Requiere ingresar la palabra clave `RESET`.
  * **Protección de Catálogo:** No toca la hoja `Cafeteria_Productos`, manteniendo íntegro el menú de platos, categorías y precios configurados.

---

## 5. Endpoints de la API Backend (Google Apps Script)

| Acción (`action`) | Método | Parámetros Principales | Función Backend |
| :--- | :---: | :--- | :--- |
| `registrar` | POST | `dni`, `tipo` | Registra asistencia con reglas de hora/tolerancia |
| `cafeteria_guardar_producto` | POST | Objeto `producto` | Crea o actualiza producto en el menú |
| `cafeteria_eliminar_producto` | POST | `idProducto` | Elimina producto del catálogo |
| `cafeteria_toggle_menu_hoy` | POST | `idProducto`, `menuHoy` | Activa/desactiva plato en el menú del día |
| `cafeteria_solicitar_recarga_yape` | POST | `dni`, `monto`, `codigoOperacion`, `comprobanteBase64` | Registra solicitud de recarga |
| `cafeteria_procesar_recarga` | POST | `idRecarga`, `aprobar`, `motivoRechazo`, `validadoPor` | Valida voucher y acredita saldo |
| `cafeteria_crear_pedido` | POST | Objeto `pedido` completo | Registra comanda y descuenta saldo |
| `cafeteria_cambiar_estado_pedido` | POST | `idPedido`, `nuevoEstado`, `atendidoPor` | Cambia estado de preparación |
| `cafeteria_eliminar_pedido` | POST | `idPedido`, `reembolsar` | **Anula comanda y reembolsa saldo** |
| `cafeteria_resetear_datos_prueba` | POST | `confirmacion: "RESET"` | **Reinicia pedidos, ventas y saldos a cero** |
| `cafeteria_registrar_venta` | POST | Objeto `venta` POS | Registra venta en mostrador (saldo/efectivo/yape) |
| `cafeteria_ajustar_saldo` | POST | `dni`, `tipo`, `monto`, `motivo`, `autorizadoPor` | Ajuste manual auditado de saldo |
| `cafeteria_obtener_productos` | GET | `soloMenuHoy` | Retorna catálogo de productos |
| `cafeteria_obtener_pedidos` | GET | `fecha`, `turno`, `estado` | Retorna comandas filtradas |
| `cafeteria_obtener_recargas` | GET | `estado` | Retorna solicitudes Yape para validar |
| `cafeteria_obtener_saldos` | GET | - | Retorna tabla de saldos de estudiantes |
| `cafeteria_obtener_reporte` | GET | `periodo` (`HOY`, `SEMANA`, `MES`, `TODO`) | Retorna métricas, totales y arqueo |
| `cafeteria_historial_estudiante` | GET | `dni` | Retorna consumos, recargas y pedidos del alumno |

---

## 6. Control de Versiones y Registro Histórico de Cambios (Changelog)

### [v2.6.0] - 15/11/2026
* **Respaldo de Seguridad Integral:** Se generó una copia fiel y completa del código fuente, configuraciones y documentación en `D:\Trabajos de Programacion\Copias originales de Proyectos\Asistencia-QR-BACKUP-2026-11-15\`.
* **Ruta de Migración a Firebase:**
  * Creación del documento de arquitectura [RUTA_MIGRACION_FIREBASE.md](file:///d:/Trabajos%20de%20Programacion/Asistencia-QR.-main/Asistencia-QR.-main/RUTA_MIGRACION_FIREBASE.md) con el diseño de 6 fases para migrar de Google Sheets a Cloud Firestore, Auth, Storage y Hosting.
  * Mapeo de datos NoSQL de 9 colecciones (`estudiantes`, `billeteras`, `asistencias`, `cafeteria_productos`, `cafeteria_pedidos`, `cafeteria_recargas`, `cafeteria_ventas`, `justificaciones`, `comunicados`).
  * Scaffolding de infraestructura: archivos de reglas `firestore.rules`, `storage.rules`, índices `firestore.indexes.json` y configuración `firebase.json`.
  * Script inicial de migración de datos por lotes: `scripts/migrar_sheets_a_firestore.js`.
  * Plantilla modular del cliente en `frontend/src/services/firebase.example.js`.

### [v2.5.1] - 15/11/2026
* **Módulo Cafetería (Despacho Inteligente en POS y Comandas):**
  * Al escanear el carnet QR de un estudiante en la Caja Rápida (POS), el sistema detecta de inmediato sus pedidos de lonchera programados para hoy por el padre.
  * Muestra tarjeta informativa con los platos solicitados, turno de recreo/almuerzo e indicación de que ya fueron pagados previamente.
  * Habilita botón de entrega directa `[ ✅ Entregar Lonchera ]` tanto en la cabecera como en el botón principal del ticket de venta, agilizando la atención a 1 solo clic sin recargos.
  * Incorporación de lector QR y buscador por DNI/nombre en la pantalla de **Comandas de Cocina** para despacho directo desde mostrador o cocina.
  * **Hotfix de Estabilidad:** Inclusión de `normalizarFechaSafe` con fallback resiliente en el selector de alumnos de caja, eliminando el error de consola `ReferenceError` y asegurando renderizado continuo.

### [v2.5.0] - 15/11/2026
* **Módulo Cafetería:** Se implementó la anulación de pedidos con botón de papelera `[ 🗑️ ]` en la vista de comandas, con reembolso automático a la billetera digital y descarte en la hoja de ventas.
* **Módulo Reportes:** Se incorporó la función administrativa de **Reinicio de Datos de Prueba a Cero (`RESET`)** con confirmación tipográfica, protegiendo el catálogo de productos.
* **Punto de Venta (POS):** Incorporación de modalidad de pago en efectivo con modal de vuelto a pantalla completa, y búsqueda dual por DNI o Nombre del alumno.
* **Portal Familiar:** Integración del logotipo oficial de "Las Palmeras", validación preventiva de saldo con alertas interactivas, y trazabilidad total de consumos, recargas y pedidos.

### [v2.0.0] - 10/10/2026
* Lanzamiento del subsistema de Cafetería escolar: Menú digital, catálogo de productos y comandas en cocina.
* Integración del sistema de recargas Yape con comprobante fotográfico.
* Sistema de Billetera Virtual del Estudiante con saldo en custodia.

### [v1.5.0] - 07/10/2026
* Migración de arquitectura de vistas a `react-router-dom` v7 para navegación fluida por URLs reales.
* Limpieza integral de codificación UTF-8 en todo el código base y refactorización de scripts de backend en Google Apps Script.

### [v1.0.0] - Agosto 2026
* Despliegue inicial del Sistema de Asistencia QR para Primaria y Secundaria en la IEP MILLENIUM.
* Generador e impresor masivo de carnets estudiantiles con código QR.
