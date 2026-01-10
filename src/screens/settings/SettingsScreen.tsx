import React from 'react';
import { View, Text, Button, StyleSheet, Alert, ScrollView, TouchableOpacity } from 'react-native';
import { logout } from '../../services/firebase/auth';
import { useThemeColor } from '../../hooks/useThemeColor';
import { Ionicons } from '@expo/vector-icons';

export default function SettingsScreen({ navigation }: any) {
  const colors = useThemeColor();

  // 課金状態反転（ダミー処理）
  const handleToggleSubscription = () => {
    Alert.alert("Dev", "課金状態を反転しました（処理は未実装）");
  };
  
  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      
      {/* 1. アカウント設定 */}
      <View style={[styles.section, { backgroundColor: colors.card }]}>
        <Text style={[styles.header, { color: colors.text }]}>アカウント設定</Text>
        <Button title="ログアウト" onPress={logout} color={colors.error} />
      </View>

      {/* 2. 入力設定 (★追加: 繰り返し入力へのリンク) */}
      <View style={[styles.section, { backgroundColor: colors.card }]}>
        <Text style={[styles.header, { color: colors.text }]}>入力設定</Text>
        <TouchableOpacity 
          style={styles.menuItem}
          onPress={() => navigation.navigate('RecurringList')}
        >
          <View style={styles.menuRow}>
            <Ionicons name="repeat" size={24} color={colors.text} style={styles.menuIcon} />
            <Text style={[styles.menuText, { color: colors.text }]}>繰り返し入力の管理</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSub} />
        </TouchableOpacity>
      </View>

      {/* 3. マスタ管理 */}
      <View style={[styles.section, { backgroundColor: colors.card }]}>
        <Text style={[styles.header, { color: colors.text }]}>マスタ管理</Text>
        
        <TouchableOpacity 
          style={[styles.menuItem, { borderBottomColor: colors.border, borderBottomWidth: 1 }]}
          onPress={() => navigation.navigate('CategoryManage')}
        >
          <View style={styles.menuRow}>
            <Ionicons name="pricetags-outline" size={24} color={colors.text} style={styles.menuIcon} />
            <Text style={[styles.menuText, { color: colors.text }]}>科目の設定</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSub} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.menuItem}
          onPress={() => navigation.navigate('AccountManage')}
        >
          <View style={styles.menuRow}>
            <Ionicons name="wallet-outline" size={24} color={colors.text} style={styles.menuIcon} />
            <Text style={[styles.menuText, { color: colors.text }]}>口座の設定</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSub} />
        </TouchableOpacity>
      </View>

      {/* 4. 開発用メニュー (★修正: ダミーデータ削除・課金反転ボタンのみ) */}
      <View style={[styles.section, { backgroundColor: colors.card }]}>
        <Text style={[styles.header, { color: colors.text }]}>開発用メニュー</Text>
        
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 20 }}>
          <Button title="課金状態を反転 (Dev)" onPress={handleToggleSubscription} color={colors.tint} />
        </View>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60 },
  section: { 
    padding: 20, borderRadius: 10, marginBottom: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 2, elevation: 2
  },
  header: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  description: { fontSize: 14, marginBottom: 15, lineHeight: 20 },
  menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15 },
  menuRow: { flexDirection: 'row', alignItems: 'center' },
  menuIcon: { marginRight: 15 },
  menuText: { fontSize: 16 },
});