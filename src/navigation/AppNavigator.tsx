import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../services/firebase/config';
import { MasterProvider } from '../store/MasterContext';
import MainTabNavigator from './MainTabNavigator';

// 画面のインポート
import InputScreen from '../screens/transactions/InputScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import HomeScreen from '../screens/home/HomeScreen';
import CategoryManageScreen from '../screens/settings/CategoryManageScreen';
import AccountManageScreen from '../screens/settings/AccountManageScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Firebaseのログイン状態を監視するリスナー
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe; // クリーンアップ
  }, []);

  if (loading) {
    // ローディング中は何も表示しない（またはスプラッシュ画像）
    return null; 
  }

  return (
    // 1. データ供給 (Provider) で全体を包む
    <MasterProvider>
      <NavigationContainer>
        <Stack.Navigator>
          {user ? (
            // ログイン済み：タブ画面 + モーダル画面の構成
            <Stack.Group>
              {/* メインのタブ画面 */}
              <Stack.Screen 
                name="Main" 
                component={MainTabNavigator} 
                options={{ headerShown: false }} 
              />
              {/* 入力画面（モーダルとして設定） */}
              <Stack.Screen 
                name="InputModal" 
                component={InputScreen} 
                options={{ 
                  presentation: 'modal', // 下から出てくる設定
                  title: '支出入力'
                }} 
              />
              <Stack.Screen 
                name="CategoryManage" 
                component={CategoryManageScreen} 
                options={{ title: '科目の管理', headerBackTitle: '設定' }} // ヘッダーに戻るボタンが付きます
              />
              <Stack.Screen 
                name="AccountManage" 
                component={AccountManageScreen} 
                options={{ title: '口座の管理', headerBackTitle: '設定' }} 
              />
            </Stack.Group>
          ) : (
            // 未ログイン
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </MasterProvider>
  );
}