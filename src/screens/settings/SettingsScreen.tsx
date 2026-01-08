import React, { useState } from 'react';
import { View, Text, Button, StyleSheet, Alert, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { regenerateDemoData } from '../../services/firebase/seed';
import { logout } from '../../services/firebase/auth';
import { useThemeColor } from '../../hooks/useThemeColor';
import { Ionicons } from '@expo/vector-icons';

export default function SettingsScreen({ navigation }: any) {
  // ★テーマカラーを取得
  const colors = useThemeColor();
  const [loading, setLoading] = useState(false);

  // ダミーデータ生成ハンドラ
  const handleDummyData = async () => {
  Alert.alert(
    "デモデータの再構築",
    "既存のマスタと明細を無視して、整合性の取れた新しいデータを50件投入します。\n（事前にFirestoreでtransactionsを削除しておくと綺麗になります）",
    [
      { text: "キャンセル", style: "cancel" },
      { 
        text: "再構築する", 
        onPress: async () => {
          setLoading(true);
          try {
            await regenerateDemoData(); // ★ここ
            Alert.alert("完了", "データを再構築しました。");
          } catch (e: any) {
            Alert.alert("エラー", e.message);
          } finally {
            setLoading(false);
          }
        }
      }
    ]
  );
};
  
return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      
      {/* 1. アカウント設定セクション (そのまま) */}
      <View style={[styles.section, { backgroundColor: colors.card }]}>
        <Text style={[styles.header, { color: colors.text }]}>アカウント設定</Text>
        <Button title="ログアウト" onPress={logout} color={colors.error} />
      </View>


      {/* ★追加: マスタ管理セクション (ここに追加！) */}
      <View style={[styles.section, { backgroundColor: colors.card }]}>
        <Text style={[styles.header, { color: colors.text }]}>マスタ管理</Text>
        
        {/* 科目管理ボタン */}
        <TouchableOpacity 
          style={[styles.menuItem, { borderBottomColor: colors.border }]}
          onPress={() => navigation.navigate('CategoryManage')}
        >
          <View style={styles.menuRow}>
            <Ionicons name="pricetags-outline" size={24} color={colors.text} style={styles.menuIcon} />
            <Text style={[styles.menuText, { color: colors.text }]}>科目の設定</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSub} />
        </TouchableOpacity>

        {/* 口座管理ボタン */}
        <TouchableOpacity 
          style={styles.menuItem} // 一番下なのでボーダーなしでもOK
          onPress={() => navigation.navigate('AccountManage')}
        >
          <View style={styles.menuRow}>
            <Ionicons name="wallet-outline" size={24} color={colors.text} style={styles.menuIcon} />
            <Text style={[styles.menuText, { color: colors.text }]}>口座の設定</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSub} />
        </TouchableOpacity>
      </View>


      {/* 3. 開発用メニューセクション (そのまま) */}
      <View style={[styles.section, { backgroundColor: colors.card }]}>
        <Text style={[styles.header, { color: colors.text }]}>開発用メニュー</Text>
        
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 20 }}>
          <Text style={[styles.description, { color: colors.textSub }]}>
            グラフ確認用のダミー支出データを50件追加します。
          </Text>
          {loading ? (
            <ActivityIndicator />
          ) : (
            <Button title="ダミーデータ生成 (Random)" onPress={handleDummyData} color={colors.tint} />
          )}
        </View>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // ★色指定（backgroundColor, color）は削除し、レイアウト定義のみ残す
  container: { flex: 1, padding: 20, paddingTop: 60 },
  section: { 
    padding: 20, borderRadius: 10, marginBottom: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 2, elevation: 2
  },
  header: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  description: { fontSize: 14, marginBottom: 15, lineHeight: 20 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15, // 指で押しやすい高さ
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: {
    marginRight: 15,
  },
  menuText: {
    fontSize: 16,
  },
});