// src/services/firebase/config.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
// getAuth ではなく initializeAuth と getReactNativePersistence を使います
// @ts-ignore
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { getStorage } from "firebase/storage";

// Firebaseコンソールから取得したキーをここに貼り付け
const firebaseConfig = {
  apiKey: "AIzaSyCrdlX2sPqY8kYJrQcy7NtHyJdUxX7aQ4Q",
  authDomain: "ourstack-annieworks.firebaseapp.com",
  projectId: "ourstack-annieworks",
  storageBucket: "ourstack-annieworks.firebasestorage.app",
  messagingSenderId: "644216018162",
  appId: "1:644216018162:web:c2282c072b32a3033a2c6b"
};

// アプリの初期化
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp(); // 既存のアプリを取得
}

// ★ここがポイント：Authの初期化（React Native用の永続化設定）
// 通常の getAuth(app) だと警告が出たり、再起動でログアウトしたりします
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

// ★Firestoreの初期化（undefinedを無視する設定）
const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true
});

export { db, auth };
export const storage = getStorage(app);