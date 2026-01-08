import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import { Ionicons } from '@expo/vector-icons';
import { useMasterData } from '../../store/MasterContext';
import { useThemeColor } from '../../hooks/useThemeColor';
import { Transaction } from '../../types';

// グラフ用の色パレット（C#のColor配列のようなもの）
const CHART_COLORS = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF'];

export default function AnalysisScreen() {
  const { transactions, categories } = useMasterData();
  const colors = useThemeColor();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const changeMonth = (increment: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + increment);
    setCurrentDate(newDate);
  };

  const targetTransactions = useMemo(() => {
    return transactions.filter(t => {
      // t.date は Date型 または FirestoreのTimestamp型 なので変換を考慮
      const tDate = t.date instanceof Date ? t.date : (t.date as any).toDate();
      
      return (
        tDate.getFullYear() === currentDate.getFullYear() &&
        tDate.getMonth() === currentDate.getMonth() &&
        t.type === 'expense' // 支出のみ
      );
    });
  }, [transactions, currentDate]);

  // --- データ集計ロジック (LINQ: GroupBy + Sum + OrderByDescending) ---
  const chartData = useMemo(() => {
    const sums: { [key: string]: number } = {};
    let total = 0;

    targetTransactions.forEach(t => {
      const catId = t.categoryId || 'unknown';
      sums[catId] = (sums[catId] || 0) + t.amount;
      total += t.amount;
    });

    if (total === 0) return [];

    return Object.keys(sums)
      .map((catId, index) => {
        const amount = sums[catId];
        const category = categories.find(c => c.id === catId);
        const percentage = (amount / total) * 100;
        
        return {
          value: amount,
          color: CHART_COLORS[index % CHART_COLORS.length],
          text: `${Math.round(percentage)}%`,
          categoryName: category ? category.name : '不明',
          categoryId: catId
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [targetTransactions, categories]);

  // 合計金額
  const totalExpense = chartData.reduce((sum, item) => sum + item.value, 0);

  // --- レンダリング ---
  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ★追加: 月切り替えヘッダー */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.arrowBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        
        <Text style={[styles.dateLabel, { color: colors.text }]}>
          {currentDate.getFullYear()}年{currentDate.getMonth() + 1}月
        </Text>
        
        <TouchableOpacity onPress={() => changeMonth(1)} style={styles.arrowBtn}>
          <Ionicons name="chevron-forward" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* グラフエリア */}
      <View style={[styles.chartContainer, { backgroundColor: colors.card }]}>
        {chartData.length > 0 ? (
          <View style={{ alignItems: 'center' }}>
            <PieChart
              data={chartData}
              donut
              radius={120}
              innerRadius={80}
              innerCircleColor={colors.card}
              centerLabelComponent={() => {
                return (
                  <View style={{ justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ fontSize: 14, color: colors.textSub }}>
                      {currentDate.getMonth() + 1}月の支出
                    </Text>
                    <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text }}>
                      ¥{totalExpense.toLocaleString()}
                    </Text>
                  </View>
                );
              }}
            />
          </View>
        ) : (
          <View style={styles.noData}>
            <Text style={{ color: colors.textSub, marginBottom: 10 }}>データがありません</Text>
            {/* データがない時は0円と表示しておくと親切 */}
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.textSub }}>¥0</Text>
          </View>
        )}
      </View>

      {/* 内訳リスト */}
      <View style={styles.listContainer}>
        {chartData.map((item, index) => (
          <View key={item.categoryId} style={[styles.listItem, { borderBottomColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.colorBox, { backgroundColor: item.color }]} />
              <Text style={[styles.catName, { color: colors.text }]}>{item.categoryName}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.amount, { color: colors.text }]}>
                ¥{item.value.toLocaleString()}
              </Text>
              <Text style={[styles.percent, { color: colors.textSub }]}>
                ({item.text})
              </Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 20, paddingHorizontal: 20
  },
  dateLabel: { fontSize: 20, fontWeight: 'bold' },
  arrowBtn: { padding: 10 },

  chartContainer: {
    padding: 20, borderRadius: 20, alignItems: 'center', marginBottom: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 3
  },
  noData: { height: 200, justifyContent: 'center', alignItems: 'center' },

  listContainer: { marginBottom: 50 },
  listItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 0.5
  },
  colorBox: { width: 12, height: 12, borderRadius: 6, marginRight: 10 },
  catName: { fontSize: 16 },
  amount: { fontSize: 16, fontWeight: 'bold', marginRight: 10 },
  percent: { fontSize: 14 },
});