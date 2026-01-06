import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native'; // 画面遷移用
import { auth } from '../../services/firebase/config';
import { useRecentTransactions } from '../../hooks/useTransactions';
import { useMasterData } from '../../store/MasterContext';
import { useThemeColor } from '../../hooks/useThemeColor';

export default function HomeScreen() {
  const navigation = useNavigation<any>(); // 型エラー回避のためany
  const user = auth.currentUser;
  
  const colors = useThemeColor();

  const { transactions } = useRecentTransactions(20);
  const { categories, accounts } = useMasterData();

  const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name || '未分類';
  const getAccountName = (id: string) => accounts.find(a => a.id === id)?.name || '不明';

  const renderItem = ({ item }: { item: any }) => (
    // ★ styleに配列を使い、[基本スタイル, { 上書きしたい色 }] の形で適用します
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <View style={styles.row}>
        <Text style={styles.dateText}>{item.date.toLocaleDateString()}</Text>
        {/* 文字色もテーマに追従させる */}
        <Text style={[styles.categoryBadge, { color: colors.textSub }]}>
          {getCategoryName(item.categoryId)}
        </Text>
      </View>
      <View style={styles.row}>
        {/* メモの色 */}
        <Text style={[styles.memoText, { color: colors.text }]}>
          {item.memo || getAccountName(item.sourceAccountId)}
        </Text>
        {/* 収支の色も定義ファイルから取得 */}
        <Text style={[
          styles.amountText, 
          { color: item.type === 'income' ? colors.income : colors.expense }
        ]}>
          ¥{item.amount.toLocaleString()}
        </Text>
      </View>
    </View>
  );

  return (
    // ★ 全体の背景色
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { 
          backgroundColor: colors.card, 
          borderBottomColor: colors.border 
        }]}>
        <Text style={[styles.title, { color: colors.text }]}>OurStack</Text>
        <Text style={styles.userText}>{user?.email}</Text>
      </View>

      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: colors.textSub }]}>
            データがありません
          </Text>
        }
      />

      <View style={styles.fabContainer}>
        {/* ボタンの色は tint (アクセントカラー) を使用 */}
        <TouchableOpacity 
          style={[styles.fabButton, { backgroundColor: colors.text }]} // ここは反転色のままでもかっこいいかも
          onPress={() => navigation.navigate('InputModal')}
        >
          {/* ボタン内の文字色はカード背景色（白/黒）を使うと見やすい */}
          <Text style={[styles.fabText, { color: colors.card }]}>
            ＋ 記帳する
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, 
  header: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    padding: 20, paddingTop: 60, 
    borderBottomWidth: 1
  },
  title: { fontSize: 24, fontWeight: 'bold' },
  userText: { fontSize: 12, marginBottom: 5 },
  
  listContent: { padding: 15, paddingBottom: 100 }, // ボタンと被らないよう余白確保
  card: {
    padding: 15, marginBottom: 10, borderRadius: 8,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 2, elevation: 2
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  dateText: { fontSize: 12 },
  categoryBadge: { fontSize: 12, fontWeight: 'bold' },
  memoText: { fontSize: 14 },
  amountText: { fontSize: 16, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', marginTop: 50 },

  // フローティングボタンのスタイル
  fabContainer: {
    position: 'absolute', bottom: 30, left: 0, right: 0, 
    alignItems: 'center', justifyContent: 'center'
  },
  fabButton: {
    paddingVertical: 15, paddingHorizontal: 40,
    borderRadius: 30, elevation: 5,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3
  },
  fabText: { fontSize: 16, fontWeight: 'bold' }
});