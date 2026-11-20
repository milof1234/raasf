import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getDatabase, Database, ref, onValue, set, remove, serverTimestamp } from 'firebase/database';
import { getAuth, Auth } from 'firebase/auth';
import { UserProfile, MessageItem, GroupChat } from '../types/chat';
import { cleanDigits, isAdminPhone, hashPassword } from '../utils/security';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyApifDrGuoHFtdU1ZZtPRUWvkFgjMFyCEY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "ya-zadolbalcya.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://ya-zadolbalcya-default-rtdb.firebaseio.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "ya-zadolbalcya",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "ya-zadolbalcya.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "736550801988",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:736550801988:web:69815bbb50bb799b296211"
};

let app: FirebaseApp | null = null;
let db: Database | null = null;
let auth: Auth | null = null;

try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  db = getDatabase(app);
  auth = getAuth(app);
} catch (err) {
  console.warn('Firebase initialization error, will use persistent fallback:', err);
}

export { app, db, auth };

// Admin profiles for +7 (925) 469-98-01 and +7 (925) 167-29-82
export const INITIAL_SEED_USERS: Record<string, UserProfile> = {
  'usr_admin': {
    id: 'usr_admin',
    name: 'milof',
    username: 'milof',
    phone: '+7 (925) 469-98-01',
    passwordHash: hashPassword('123456'),
    isAdmin: true,
    isMuted: false,
    avatar: '',
    lastSeen: Date.now(),
    isOnline: true
  },
  'usr_admin_2': {
    id: 'usr_admin_2',
    name: 'Admin',
    username: 'admin2',
    phone: '+7 (925) 167-29-82',
    passwordHash: hashPassword('123456'),
    isAdmin: true,
    isMuted: false,
    avatar: '',
    lastSeen: Date.now(),
    isOnline: true
  }
};

export const INITIAL_SEED_GROUPS: Record<string, GroupChat> = {};

export const INITIAL_SEED_MESSAGES: MessageItem[] = [];
