import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';
import HomeScreen from '../screens/home/HomeScreen';
import SettingsScreen from '../screens/settings/SettingsScreen'; // 作った設定画面

const Tab = createBottomTabNavigator();

// 将来のためのダミー画面
const PlaceholderScreen = () => (
  <View style={styles.centerContainer}>
    <Text style={styles.text}>将来の機能拡張エリア</Text>
    <Text style={styles.subText}>（現在は使用しません）</Text>
  </View>
);

export default function MainTabNavigator() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen 
        name="HomeTab" 
        component={HomeScreen} 
        options={{ title: 'ホーム' }} 
      />
      
      {/* ダミーとして残しておくタブ */}
      <Tab.Screen 
        name="DummyTab" 
        component={PlaceholderScreen} 
        options={{ title: '分析(仮)' }} 
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