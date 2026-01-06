import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useMasterData } from '../../store/MasterContext';
import { useThemeColor } from '../../hooks/useThemeColor';

export default function AccountsScreen() {
  const { accounts } = useMasterData();
  const colors = useThemeColor();

  const totalAssets = accounts.reduce((sum, acc) => sum + acc.balance, 0);

  const renderItem = ({ item }: { item: any }) => {
    const isNegative = item.balance < 0;
    return (
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <View>
          <Text style={[styles.accountName, { color: colors.text }]}>{item.name}</Text>
          <Text style={[styles.accountType, { color: colors.textSub }]}>
            {getTypeLabel(item.type)}
          </Text>
        </View>
        <Text style={[
          styles.balance, 
          { color: isNegative ? colors.expense : colors.text }
        ]}>
          ¥{item.balance.toLocaleString()}
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      
      {/* ヘッダー: 色指定を動的スタイルへ移動 */}
      <View style={[
        styles.headerCard, 
        { 
          backgroundColor: colors.tint,
          shadowColor: colors.text // 影の色もテーマに合わせて反転（ダークモードでは影が見えにくいですが許容範囲）
        }
      ]}>
        {/* 文字色に colors.background (白/黒) を使うことで、tint (青/白) とのコントラストを確保 */}
        <Text style={[styles.headerLabel, { color: colors.background }]}>純資産総額</Text>
        <Text style={[styles.headerAmount, { color: colors.background }]}>¥{totalAssets.toLocaleString()}</Text>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.textSub }]}>口座一覧</Text>

      <FlatList
        data={accounts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 50 }}
      />
    </View>
  );
}

// 区分名を日本語化するヘルパー
const getTypeLabel = (type: string) => {
  switch(type) {
    case 'cash': return '現金';
    case 'bank': return '銀行口座';
    case 'credit_card': return 'クレジットカード';
    case 'e_money': return '電子マネー';
    case 'investment': return '投資・資産';
    default: return type;
  }
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60 },
  
  headerCard: {
    padding: 20, borderRadius: 15, marginBottom: 30,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 5, elevation: 6
  },
  headerLabel: { 
    fontSize: 14, marginBottom: 5 
  },
  headerAmount: { 
    fontSize: 32, fontWeight: 'bold' 
  },

  sectionTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 10, marginLeft: 5 },

  card: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 15, marginBottom: 10, borderRadius: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 2, elevation: 1
  },
  accountName: { fontSize: 16, fontWeight: 'bold' },
  accountType: { fontSize: 12, marginTop: 2 },
  balance: { fontSize: 18, fontWeight: 'bold' }, // 等幅フォント(Variant)を使うと桁が揃って綺麗ですが、まずは標準で
});