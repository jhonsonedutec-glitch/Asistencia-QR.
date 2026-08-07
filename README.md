# IEP MILLENIUM — Sistema de Control de Asistencia por QR

Proyecto base full-stack con React + Vite + Tailwind CSS + html5-qrcode, Vercel Functions, Google Apps Script y Google Sheets.

## Estructura
- `frontend/`: aplicación React.
- `api/`: funciones serverless de Vercel (proxy hacia Apps Script).
- `apps-script/Code.gs`: API REST y lógica de asistencia.

## Configuración rápida
1. Crea un Google Sheet con `BD_Estudiantes`, `Registro_Diario` y `Justificaciones`.
2. Copia el ID del Sheet a `SPREADSHEET_ID` en `apps-script/Code.gs`.
3. Configura la zona horaria del proyecto Apps Script como GMT-05:00 / Lima.
4. Implementa Apps Script como aplicación web y copia su URL.
5. En Vercel crea `GAS_API_URL` con esa URL.
6. En `frontend` ejecuta `npm install` y `npm run dev`.
7. Para producción: `npm run build`.

## Reglas
- Primaria: entrada 08:00, tolerancia hasta 08:15.
- Secundaria: entrada 14:00, tolerancia hasta 14:15.
- El QR contiene únicamente el DNI.
- Se bloquea el segundo registro del mismo DNI en el mismo día.

## Datos institucionales
IEP MILLENIUM — 29 de agosto N° 169 - Bagua - Capital
Correo: quintanahumanluis@gmail.com
