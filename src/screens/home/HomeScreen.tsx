import React from 'react';
import { View, Text, Button, StyleSheet, Alert, FlatList, TouchableOpacity } from 'react-native';
import { logout } from '../../services/firebase/auth';
import { seedInitialData } from '../../services/firebase/seed';
import { auth } from '../../services/firebase/config';
import { useRecentTransactions } from '../../hooks/useTransactions'; // 作ったフック
import { useMasterData } from '../../store/MasterContext'; // マスタデータ

export default function HomeScreen() {
  const user = auth.currentUser;
  
  // 1. 直近データの取得（ViewModelからのデータバインディング）
  const { transactions, loading } = useRecentTransactions(10); // 10件取得
  
  // 2. マスタデータの取得（ID解決用）
  const { categories, accounts } = useMasterData();

  // ヘルパー：IDからカテゴリ名を取得
  const getCategoryName = (id: string) => {
    return categories.find(c => c.id === id)?.name || '未分類';
  };

  // ヘルパー：IDから口座名を取得
  const getAccountName = (id: string) => {
    return accounts.find(a => a.id === id)?.name || '不明';
  };

  // リストの1行分のレンダリング定義 (ItemTemplate)
  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.dateText}>
          {item.date.toLocaleDateString()}
        </Text>
        <Text style={styles.categoryBadge}>
          {getCategoryName(item.categoryId)}
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.memoText}>{item.memo || getAccountName(item.sourceAccountId)}</Text>
        <Text style={[
          styles.amountText, 
          { color: item.type === 'income' ? 'blue' : 'red' }
        ]}>
          ¥{item.amount.toLocaleString()}
        </Text>
      </View>
    </View>
  );

  // Seed実行関数
  const handleSeed = async () => {
    try {
      await seedInitialData();
      Alert.alert("成功", "マスタデータを初期化・更新しました");
    } catch (e: any) {
      Alert.alert("エラー", e.message);
    }
  };

  return (
    <View style={styles.container}>
      {/* ヘッダー部分 */}
      <View style={styles.header}>
        <Text style={styles.title}>最近の動き</Text>
        <Button title="ログアウト" onPress={logout} color="gray" />
      </View>

      {/* リスト表示部分 */}
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>データがありません</Text>}
      />

      {/* デバッグ用エリア */}
      <View style={styles.debugArea}>
        <Text style={{fontSize:10, color:'#999'}}>開発用メニュー</Text>
        <Button title="マスタデータ初期化(Seed)" onPress={handleSeed} color="#f194ff" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, paddingTop: 60, backgroundColor: '#fff', 
    borderBottomWidth: 1, borderBottomColor: '#ddd' 
  },
  title: { fontSize: 20, fontWeight: 'bold' },
  
  listContent: { padding: 15 },
  card: {
    backgroundColor: '#fff', padding: 15, marginBottom: 10, borderRadius: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 2, elevation: 2
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  dateText: { color: '#888', fontSize: 12 },
  categoryBadge: { fontSize: 12, fontWeight: 'bold', color: '#555' },
  memoText: { fontSize: 14, color: '#333' },
  amountText: { fontSize: 16, fontWeight: 'bold' },
  
  emptyText: { textAlign: 'center', marginTop: 50, color: '#999' },
  debugArea: { padding: 20, borderTopWidth: 1, borderColor: '#ddd' }
});