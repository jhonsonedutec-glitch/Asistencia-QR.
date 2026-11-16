// Configuración e inicialización del cliente Firebase (Modular SDK v10)
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSy_SAMPLE_KEY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "iep-millenium-asistencia.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "iep-millenium-asistencia",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "iep-millenium-asistencia.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789:web:abcdef"
};

// Evitar inicializaciones múltiples en Hot Module Reload
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export default app;
