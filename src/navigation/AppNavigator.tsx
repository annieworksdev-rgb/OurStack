import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../services/firebase/config';

// 画面のインポート
import LoginScreen from '../screens/auth/LoginScreen';
import HomeScreen from '../screens/home/HomeScreen';

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
    <NavigationContainer>
      <Stack.Navigator>
        {user ? (
          // ログイン中のみ表示される画面群
          <Stack.Screen name="Home" component={HomeScreen} />
        ) : (
          // 未ログイン時のみ表示される画面
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}