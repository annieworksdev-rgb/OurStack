import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet } from 'react-native';
import HomeScreen from '../screens/home/HomeScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import AccountsScreen from '../screens/accounts/AccountsScreen';
import AnalysisScreen from '../screens/analysis/AnalysisScreen';
import { useThemeColor } from '../hooks/useThemeColor';

const Tab = createBottomTabNavigator();

// 将来のためのダミー画面
const PlaceholderScreen = () => (
  <View style={styles.centerContainer}>
    <Text style={styles.text}>将来の機能拡張エリア</Text>
    <Text style={styles.subText}>（現在は使用しません）</Text>
  </View>
);

export default function MainTabNavigator() {
  const colors = useThemeColor();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        // アクティブなタブの色（テーマ連動）
        tabBarActiveTintColor: colors.tint,
        // 非アクティブなタブの色
        tabBarInactiveTintColor: colors.tabIconDefault,
        // 背景色もテーマ連動
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
        // ★ここがアイコン設定の肝
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';

          if (route.name === 'HomeTab') {
            // フォーカス時は塗りつぶし、非フォーカス時はアウトライン
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'AccountsTab') {
            iconName = focused ? 'wallet' : 'wallet-outline';
          } else if (route.name === 'AnalysisTab') { 
            iconName = focused ? 'pie-chart' : 'pie-chart-outline';
          } else if (route.name === 'SettingsTab') {
            iconName = focused ? 'settings' : 'settings-outline';
          }

          // 指定された色（Active/Inactive）とサイズでアイコンを返す
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen 
        name="HomeTab" 
        component={HomeScreen} 
        options={{ title: 'ホーム' }} 
      />
      <Tab.Screen 
        name="AccountsTab" 
        component={AccountsScreen} 
        options={{ title: '資産' }} 
      />
      <Tab.Screen 
        name="AnalysisTab"
        component={AnalysisScreen} 
        options={{ title: '分析' }} 
      />
      <Tab.Screen 
        name="SettingsTab" 
        component={SettingsScreen} 
        options={{ title: '設定' }} 
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0' },
  text: { fontSize: 18, fontWeight: 'bold', color: '#aaa' },
  subText: { fontSize: 14, color: '#aaa', marginTop: 5 }
});