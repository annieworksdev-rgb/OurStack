// src/services/firebase/config.ts
import { initializeApp } from 'firebase/app';
// React Nativeでログイン状態を永続化するために必要なインポート
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebaseコンソールから取得したキーをここに貼り付け
const firebaseConfig = {
  apiKey: "AIzaSyCrdlX2sPqY8kYJrQcy7NtHyJdUxX7aQ4Q",
  authDomain: "ourstack-annieworks.firebaseapp.com",
  projectId: "ourstack-annieworks",
  storageBucket: "ourstack-annieworks.firebasestorage.app",
  messagingSenderId: "644216018162",
  appId: "1:644216018162:web:c2282c072b32a3033a2c6b"
};

// 1. アプリの初期化
const app = initializeApp(firebaseConfig);

// 2. Authの初期化（重要！）
// Web版と違い、React Nativeでは明示的にAsyncStorageを使って
// 「永続化（Persistence）」を設定しないと、リロードするたびにログアウトしてしまいます。
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

// 3. Firestore（DB）の初期化
const db = getFirestore(app);

// シングルトンインスタンスとしてエクスポート
// C#の Dependency Injection のように、アプリ全体でこのインスタンスを使い回します
export { auth, db };