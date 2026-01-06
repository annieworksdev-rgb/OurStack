import React from 'react';
import { View, Text, Button, StyleSheet, Alert, ScrollView } from 'react-native';
import { seedInitialData } from '../../services/firebase/seed';
import { logout } from '../../services/firebase/auth';
import { useThemeColor } from '../../hooks/useThemeColor'; // ★追加

export default function SettingsScreen() {
  // ★テーマカラーを取得
  const colors = useThemeColor();

  const handleSeed = async () => {
    Alert.alert(
      "初期データ投入",
      "マスタデータ（科目・口座）を初期状態に戻しますか？（既存のデータは上書きされます）",
      [
        { text: "キャンセル", style: "cancel" },
        { 
          text: "実行", 
          style: 'destructive',
          onPress: async () => {
            try {
              await seedInitialData();
              Alert.alert("完了", "マスタデータをリセットしました");
            } catch (e: any) {
              Alert.alert("エラー", e.message);
            }
          }
        }
      ]
    );
  };

  return (
    // ★ styleを配列にして、動的な背景色を上書き適用
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      
      {/* アカウント設定セクション */}
      <View style={[styles.section, { backgroundColor: colors.card }]}>
        <Text style={[styles.header, { color: colors.text }]}>アカウント設定</Text>
        <Button title="ログアウト" onPress={logout} color={colors.error} />
      </View>

      {/* 開発用メニューセクション */}
      <View style={[styles.section, { backgroundColor: colors.card }]}>
        <Text style={[styles.header, { color: colors.text }]}>開発用メニュー</Text>
        <Text style={[styles.description, { color: colors.textSub }]}>
          科目や口座のマスタデータがおかしくなった場合に実行してください。
        </Text>
        {/* ボタンの色もテーマのアクセントカラーに合わせる */}
        <Button title="マスタデータ初期化 (Seed)" onPress={handleSeed} color={colors.tint} />
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
  description: { fontSize: 14, marginBottom: 15, lineHeight: 20 }
});