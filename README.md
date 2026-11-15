# 🏫 IEP MILLENIUM — Sistema Integral de Control de Asistencia QR, Portal Familiar y Cafetería Escolar

Sistema web integral desarrollado a medida para la **IEP MILLENIUM** (Bagua - Capital). Permite la gestión inteligente de asistencia escolar mediante códigos QR, portal interactivo para padres de familia con lonchera virtual, y un completo sistema de Punto de Venta (POS) y cocina para la cafetería institucional **"Las Palmeras"**.

---

## 🌟 Principales Módulos del Sistema

### 1. 📲 Control de Asistencia Inteligente por QR
* **Escaneo en Tiempo Real:** Compatible con cámaras web, smartphones, tablets y pistolas lectoras de código de barras USB/Bluetooth.
* **Reglas Automatizadas de Asistencia:**
  * **Nivel Primaria:** Entrada 08:00 AM | Tolerancia hasta 08:15 AM (posteriormente se registra como Tardanza).
  * **Nivel Secundaria:** Entrada 14:00 (02:00 PM) | Tolerancia hasta 14:15 (posteriormente se registra como Tardanza).
* **Control Anti-Duplicados:** Prevención automática de doble marcación por DNI en el mismo día.
* **Feedback Sonoro y Visual:** Confirmaciones auditivas diferenciadas para ingresos puntuales, tardanzas o advertencias.

### 2. 📊 Dashboard Directivo y Reportes en Vivo
* Métricas en tiempo real de asistencia diaria: Presentes, Tardanzas, Inasistencias y Justificados.
* Gráficos estadísticos dinámicos por nivel y grado.
* Registro manual para contingencias y gestión de justificaciones documentadas.

### 3. 👨‍👩‍👧‍👦 Portal de Familias y Lonchera Digital (`/padres`)
* **Acceso Seguro:** Ingreso directo con el número de DNI del alumno.
* **Trazabilidad de Asistencia:** Consulta del historial detallado de entradas y faltas justificadas.
* **Billetera Digital Escolar:** Consulta en tiempo real del saldo disponible y recargas.
* **Pedidos de Lonchera Programada:**
  * Catálogo visual de productos con el distintivo institucional de la Cafetería **"Las Palmeras"**.
  * Selección de entrega programada: **Para la hora de Recreo** o **Para la hora de Almuerzo**.
  * Campo de indicaciones especiales para cocina (ej: *"sin mayonesa"*, *"bebida tibia"*).
  * Validación preventiva de saldo: alerta inmediata si el saldo es insuficiente antes de enviar.
* **Recargas Yape con Subida de Comprobante:** Formulario para adjuntar captura del voucher de Yape y código de operación.
* **Historial Integral de 3 Vías:** Pestañas separadas para seguimiento de **Consumos**, **Recargas** (Pendiente / Aprobada / Rechazada) y **Pedidos**.

### 4. 🍽️ Cafetería y Restaurante "Las Palmeras" (`/cafeteria`)
* **Punto de Venta Rápido (POS):**
  * Búsqueda ágil de alumnos por **DNI** o por **Nombre y Apellidos**.
  * Escáner QR de carnet estudiantil incorporado en la pantalla de cobro.
  * Múltiples modalidades de cobro: **Saldo Alumno (Billetera)**, **Efectivo** (con cálculo automático de vuelto en modal de alta visibilidad) y **Yape en Caja**.
* **Comandas y Pantalla de Cocina:**
  * Visualización organizada de pedidos del día con filtros por turno (**Recreo** / **Almuerzo**) y estado.
  * Flujo de estados: `Pendiente` ➔ `En Preparación` ➔ `Listo para Entrega` ➔ `Entregado`.
  * **Anulación con Reembolso Automático:** Botón `[ 🗑️ ]` para cancelar pedidos erróneos con devolución automática a la billetera del estudiante y descarte del arqueo de ventas.
* **Validación de Recargas Yape:**
  * Bandeja de auditoría con visor de comprobantes a pantalla completa.
  * Aprobación en 1 clic con acreditación instantánea de saldo al alumno.
* **Gestor de Menú y Precios:**
  * Creación y edición de productos, categorías, precios y fotos en alta calidad.
  * Conmutador para marcar qué productos están disponibles en el menú de hoy.
* **Reportes Financieros y Arqueo de Caja:**
  * Balance de ventas por periodo (**Hoy**, **Esta Semana**, **Este Mes**, **Histórico Total**).
  * Arqueo desglosado por método de pago: Saldo Estudiante, Efectivo y Yape en Caja.
  * Saldo total en custodia de billeteras de alumnos.
  * **Herramienta de Reinicio a Cero (`RESET`):** Botón administrativo con palabra de seguridad para purgar datos de prueba (pedidos, ventas, recargas y saldos a S/ 0.00) protegiendo el catálogo de productos.

### 5. 🪪 Generador de Carnets QR Institucionales (`/generador`)
* Generación automática e impresión masiva de carnets con fotografía, QR encriptado (DNI), nivel, grado y diseño institucional.

---

## 🏗️ Arquitectura y Tecnologías

```
┌─────────────────────────────────────────────────────────────┐
│                       CLIENTE (SPA)                         │
│   React 19 + Vite + Tailwind CSS + Lucide / Audio API       │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / CORS (fetch text/plain)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   BACKEND SERVERLESS (GAS)                  │
│       Google Apps Script Web App (API REST doPost/doGet)     │
└──────────────────────────────┬──────────────────────────────┘
                               │ Lectura / Escritura Atómica
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 BASE DE DATOS (Google Sheets)               │
│  - BD_Estudiantes           - Cafeteria_Productos          │
│  - Registro_Diario          - Cafeteria_Pedidos            │
│  - Justificaciones          - Cafeteria_Recargas           │
│  - Comunicados              - Cafeteria_Saldos             │
│                             - Cafeteria_Ventas             │
└─────────────────────────────────────────────────────────────┘
```

* **Frontend:** React 19, Vite, Tailwind CSS, React Router v7, html5-qrcode, qrcode.react, recharts.
* **Backend:** Google Apps Script (JavaScript V8) implementado como Aplicación Web (Web App REST API).
* **Base de Datos:** Google Sheets institucional como base de datos cloud de alta disponibilidad y bajo costo.
* **Despliegue:** Vercel (Frontend CI/CD automático vinculado a GitHub) + Google Cloud Platform.

---

## 📂 Estructura del Repositorio

```text
├── apps-script/
│   └── Code.gs               # Backend completo: API REST, lógica de asistencia y cafetería
├── frontend/
│   ├── src/
│   │   ├── components/       # Componentes reusables (QRScanner, Header, Footer, etc.)
│   │   ├── pages/            # Vistas principales:
│   │   │   ├── Scanner.jsx        # Lector QR de Asistencia
│   │   │   ├── Dashboard.jsx      # Panel de Control y Métricas
│   │   │   ├── ConsultaPadres.jsx # Portal de Familias y Lonchera Digital
│   │   │   ├── CafeteriaAdmin.jsx # Sistema POS, Cocina y Reportes de Cafetería
│   │   │   ├── Generator.jsx      # Generador de Carnets Estudiantiles
│   │   │   ├── ManualEntry.jsx    # Registro Manual de Asistencia
│   │   │   └── Comunicados.jsx    # Módulo de Comunicados Institucionales
│   │   ├── services/
│   │   │   └── api.js        # Cliente HTTP centralizado para Google Apps Script
│   │   ├── App.jsx           # Enrutamiento principal (React Router)
│   │   └── main.jsx          # Punto de entrada de la aplicación
│   ├── package.json          # Dependencias y scripts de construcción
│   └── vite.config.js        # Configuración de compilación Vite
├── FICHA_TECNICA.md          # Especificación técnica formal y changelog detallado
└── README.md                 # Documentación ejecutiva del proyecto
```

---

## 🚀 Despliegue y Puesta en Marcha

### 1. Requisitos Previos
* Node.js v18+ instalado.
* Cuenta de Google con acceso a Google Drive y Google Sheets.

### 2. Configuración del Frontend
```bash
# Entrar a la carpeta frontend
cd frontend

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo local
npm run dev

# Compilar para producción
npm run build
```

### 3. Actualización del Backend (Google Apps Script)
Cada vez que se modifique `apps-script/Code.gs`:
1. Abre tu proyecto en [Google Apps Script](https://script.google.com).
2. Pega el código de `apps-script/Code.gs` y guarda los cambios (`Ctrl + S`).
3. Haz clic en **Implementar** > **Administrar implementaciones**.
4. Selecciona tu implementación activa y pulsa el ícono de **Lápiz (Editar)**.
5. En la sección **Versión**, selecciona **Nueva versión**.
6. Haz clic en **Implementar**.

---

## 🏫 Datos Institucionales
* **Institución Educativa:** IEP MILLENIUM
* **Ubicación:** 29 de agosto N° 169 - Bagua - Capital, Amazonas, Perú.
* **Contacto:** quintanahumanluis@gmail.com
