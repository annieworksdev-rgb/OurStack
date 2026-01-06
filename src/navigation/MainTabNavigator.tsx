import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text } from 'react-native'; // アイコンの代わり
import HomeScreen from '../screens/home/HomeScreen';

// まだ作っていない画面のプレースホルダー
const SettingsScreen = () => <View><Text>設定画面</Text></View>;
// 入力ボタン用のダミー（実際には表示されない）
const Placeholder = () => null;

const Tab = createBottomTabNavigator();

export default function MainTabNavigator({ navigation }: any) {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="HomeTab" component={HomeScreen} options={{ title: 'ホーム' }} />
      
      {/* ここがポイント：
        真ん中の「入力」タブを押した時、通常の画面遷移をキャンセル(preventDefault)し、
        親のStack Navigatorにある 'InputModal' へ遷移させる
      */}
      <Tab.Screen 
        name="InputButton" 
        component={Placeholder} 
        options={{
          title: '入力',
          tabBarLabelStyle: { fontWeight: 'bold', fontSize: 14 },
          tabBarIconStyle: { display: 'none' }, // アイコン省略（後で設定）
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault(); // タブ切り替えを阻止
            navigation.navigate('InputModal'); // モーダルを開く
          },
        }}
      />
      
      <Tab.Screen name="SettingsTab" component={SettingsScreen} options={{ title: '設定' }} />
    </Tab.Navigator>
  );
}