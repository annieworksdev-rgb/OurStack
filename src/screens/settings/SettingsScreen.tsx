import React, { useState } from 'react';
import { View, Text, Button, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { seedInitialData, addDummyTransactions } from '../../services/firebase/seed';
import { logout } from '../../services/firebase/auth';
import { useThemeColor } from '../../hooks/useThemeColor'; // ★追加

export default function SettingsScreen() {
  // ★テーマカラーを取得
  const colors = useThemeColor();
  const [loading, setLoading] = useState(false);

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

  // ダミーデータ生成ハンドラ
  const handleDummyData = async () => {
    Alert.alert(
      "ダミーデータ生成",
      "過去3ヶ月分の支出データを50件ランダムに生成します。\n口座残高も更新されます。",
      [
        { text: "キャンセル", style: "cancel" },
        { 
          text: "生成する", 
          onPress: async () => {
            setLoading(true);
            try {
              await addDummyTransactions();
              Alert.alert("完了", "データを生成しました。\nホーム画面をリフレッシュして確認してください。");
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
        
        {/* 既存のマスタ初期化ボタン */}
        <View style={{ marginBottom: 20 }}>
          <Text style={[styles.description, { color: colors.textSub }]}>
            マスタデータをリセットします。
          </Text>
          <Button title="マスタデータ初期化 (Seed)" onPress={handleSeed} color={colors.tint} />
        </View>

        {/* ★追加: ダミーデータ生成ボタン */}
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
  description: { fontSize: 14, marginBottom: 15, lineHeight: 20 }
});