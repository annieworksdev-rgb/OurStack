import React from 'react';
import { View, Text, Button, StyleSheet, Alert } from 'react-native';
import { logout } from '../../services/firebase/auth';
import { seedInitialData } from '../../services/firebase/seed';
import { auth } from '../../services/firebase/config';

export default function HomeScreen() {
  const user = auth.currentUser;

  const handleSeed = async () => {
    try {
      await seedInitialData();
      Alert.alert("成功", "初期データ（科目・口座）をFirestoreに保存しました！");
    } catch (e: any) {
      Alert.alert("エラー", e.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.text}>ようこそ、{user?.email} さん</Text>
      <Text style={styles.subText}>UID: {user?.uid}</Text>

      <View style={styles.section}>
        <Text style={styles.label}>開発用メニュー</Text>
        <Button title="初期データ投入 (Seed)" onPress={handleSeed} color="#f194ff" />
      </View>

      <View style={{ marginTop: 50 }}>
        <Button title="ログアウト" onPress={logout} color="red" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  text: { fontSize: 18, fontWeight: 'bold' },
  subText: { fontSize: 12, color: 'gray', marginBottom: 40 },
  section: { width: '100%', padding: 20, borderWidth: 1, borderColor: '#ddd', borderRadius: 8 },
  label: { marginBottom: 10, textAlign: 'center', fontWeight: 'bold' }
});