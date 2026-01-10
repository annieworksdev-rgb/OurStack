import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Image, Modal, 
  Dimensions, SafeAreaView, Platform, StatusBar, TextInput, Alert, KeyboardAvoidingView 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { collection, query, where, orderBy, getDocs, Timestamp, doc, updateDoc } from 'firebase/firestore';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { LineChart } from 'react-native-chart-kit';
import { db, auth } from '../../services/firebase/config';
import { useMasterData } from '../../store/MasterContext';
import { useThemeColor } from '../../hooks/useThemeColor';
import { processRecurringTransactions } from '../../services/recurringService';

const SCREEN_WIDTH = Dimensions.get('window').width;

// カレンダー設定
LocaleConfig.locales['jp'] = {
  monthNames: ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'],
  monthNamesShort: ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'],
  dayNames: ['日曜日','月曜日','火曜日','水曜日','木曜日','金曜日','土曜日'],
  dayNamesShort: ['日','月','火','水','木','金','土'],
  today: '今日'
};
LocaleConfig.defaultLocale = 'jp';

type ViewMode = 'daily' | 'calendar' | 'summary' | 'assets';

export default function HomeScreen({ navigation }: any) {
  const { accounts, categories } = useMasterData();
  const colors = useThemeColor();
  
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState('');

  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [monthlyStats, setMonthlyStats] = useState({ income: 0, expense: 0 });
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [editingBudgets, setEditingBudgets] = useState<Record<string, string>>({});

  const [assetHistoryMap, setAssetHistoryMap] = useState<Record<string, {date: string, balance: number, day: number}[]>>({});
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [selectedChartAccount, setSelectedChartAccount] = useState<string>('total');

  useEffect(() => {
    const checkRecurring = async () => {
      const user = auth.currentUser;
      if (user) {
        try {
          const count = await processRecurringTransactions(user.uid);
          if (count > 0) {
            // 新しく作られたらデータを再ロードして、ユーザーに通知
            Alert.alert('お知らせ', `${count}件の定期支出を自動入力しました。`);
            loadData(); // 履歴リストを更新
            // loadAssetTrends(); // 必要なら資産推移も更新
          }
        } catch (e) {
          console.error("Auto creation failed", e);
        }
      }
    };
    
    checkRecurring();
  }, []);

  // --- loadData (日次・カレンダー・サマリー用) ---
  const loadData = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setLoading(true);
    try {
      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59);
      const transRef = collection(db, `users/${user.uid}/transactions`);
      const qMonth = query(transRef, where('date', '>=', startOfMonth), where('date', '<=', endOfMonth), orderBy('date', 'desc'));
      const snapshot = await getDocs(qMonth);
      const monthList = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id, ...data,
          date: data.date instanceof Timestamp ? data.date.toDate() : new Date(data.date),
        };
      });
      setRecentTransactions(monthList);
      let income = 0; let expense = 0;
      monthList.forEach((t: any) => {
        if (t.type === 'income') income += t.amount;
        if (t.type === 'expense') expense += t.amount;
      });
      setMonthlyStats({ income, expense });
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useFocusEffect(useCallback(() => { loadData(); }, [currentMonth]));

  // --- 資産推移データの読み込み (Assetsモード用・1ヶ月単位) ---
  const loadAssetTrends = async () => {
    // ※月が変わるたびに計算しなおす必要があるのでキャッシュ判定は外す
    const user = auth.currentUser;
    if (!user) return;
    setLoadingAssets(true);

    try {
      // 期間: 「選択した月の1日」 〜 「今日」
      // ※過去の残高を知るには、今日(最新残高)から選択月まで遡って計算する必要があるため
      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const today = new Date();

      // 未来の月を選択していたら何もしない
      if (startOfMonth > today) {
        setAssetHistoryMap({});
        setLoadingAssets(false);
        return;
      }

      const transRef = collection(db, `users/${user.uid}/transactions`);
      const q = query(
        transRef,
        where('date', '>=', startOfMonth), // 選択月の初日から
        where('date', '<=', today),        // 今日まで取得
        orderBy('date', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const historyList = snapshot.docs.map(doc => ({
        ...doc.data(),
        date: doc.data().date.toDate(),
      })) as any[];

      // 現在残高の取得
      const currentBalances: Record<string, number> = { total: 0 };
      accounts.forEach(acc => {
        if (!acc.isArchived) {
          currentBalances[acc.id] = acc.balance || 0;
          currentBalances['total'] += acc.balance || 0;
        }
      });

      const historyMap: Record<string, {date: string, balance: number, day: number}[]> = {};
      Object.keys(currentBalances).forEach(key => historyMap[key] = []);

      const transMap: Record<string, any[]> = {};
      historyList.forEach(t => {
        const k = `${t.date.getFullYear()}-${t.date.getMonth()+1}-${t.date.getDate()}`;
        if (!transMap[k]) transMap[k] = [];
        transMap[k].push(t);
      });

      // 今日から選択月の1日まで遡る
      const cursor = new Date(today);
      cursor.setHours(23, 59, 59, 999);

      while (cursor >= startOfMonth) {
        const dateKey = `${cursor.getFullYear()}-${cursor.getMonth()+1}-${cursor.getDate()}`;
        // 表示用ラベル (日のみ)
        const displayDate = `${cursor.getDate()}`;
        
        // ★重要: cursorが「選択中の月」のときだけ履歴に残す
        // (今日〜選択月末までの間の計算結果は、グラフには不要なので捨てるが計算には使う)
        const isTargetMonth = cursor.getMonth() === currentMonth.getMonth() && cursor.getFullYear() === currentMonth.getFullYear();

        if (isTargetMonth) {
          Object.keys(currentBalances).forEach(accId => {
            historyMap[accId].push({
              date: displayDate,
              balance: currentBalances[accId],
              day: cursor.getDate()
            });
          });
        }

        // 逆算処理
        const todaysTrans = transMap[dateKey] || [];
        todaysTrans.forEach(t => {
          const amount = t.amount;
          if (t.type === 'expense') {
            if (currentBalances[t.sourceAccountId] !== undefined) {
              currentBalances[t.sourceAccountId] += amount;
              currentBalances['total'] += amount;
            }
          } else if (t.type === 'income') {
            if (currentBalances[t.sourceAccountId] !== undefined) {
              currentBalances[t.sourceAccountId] -= amount;
              currentBalances['total'] -= amount;
            }
          } else if (t.type === 'transfer') {
            if (currentBalances[t.sourceAccountId] !== undefined) currentBalances[t.sourceAccountId] += amount;
            if (currentBalances[t.targetAccountId] !== undefined) currentBalances[t.targetAccountId] -= amount;
          }
        });

        cursor.setDate(cursor.getDate() - 1);
      }

      // 古い順(1日→末日)に並べ替え
      Object.keys(historyMap).forEach(key => historyMap[key].reverse());
      setAssetHistoryMap(historyMap);

    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAssets(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (viewMode === 'assets') {
        loadAssetTrends();
      }
    }, [viewMode, currentMonth]) // 月が変わったら再計算
  );


  // --- データ加工 (他モード用) ---
  const groupedTransactions = useMemo(() => {
    const groups: { dateStr: string; dateObj: Date; total: number; items: any[] }[] = [];
    recentTransactions.forEach((item) => {
      const d = item.date;
      const dateKey = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      let lastGroup = groups[groups.length - 1];
      if (!lastGroup || lastGroup.dateStr !== dateKey) {
        lastGroup = { dateStr: dateKey, dateObj: d, total: 0, items: [] };
        groups.push(lastGroup);
      }
      lastGroup.items.push(item);
      if (item.type === 'expense') lastGroup.total -= item.amount;
      else if (item.type === 'income') lastGroup.total += item.amount;
    });
    return groups;
  }, [recentTransactions]);

  const dailyTotals = useMemo(() => {
    const totals: Record<string, { income: number, expense: number }> = {};
    recentTransactions.forEach(item => {
      const d = item.date;
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!totals[dateStr]) totals[dateStr] = { income: 0, expense: 0 };
      if (item.type === 'income') totals[dateStr].income += item.amount;
      if (item.type === 'expense') totals[dateStr].expense += item.amount;
    });
    return totals;
  }, [recentTransactions]);

  const selectedDateTransactions = useMemo(() => {
    if (!selectedDate) return [];
    return recentTransactions.filter(item => {
      const d = item.date;
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return dateStr === selectedDate;
    });
  }, [recentTransactions, selectedDate]);

  const categorySummary = useMemo(() => {
    const summaryMap: Record<string, number> = {};
    let totalExpense = 0;
    let totalBudget = 0;
    recentTransactions.forEach((item) => {
      if (item.type === 'expense') {
        const catId = item.categoryId || 'unknown';
        summaryMap[catId] = (summaryMap[catId] || 0) + item.amount;
        totalExpense += item.amount;
      }
    });
    const summaryList = categories
      .filter(c => c.type === 'expense')
      .map(cat => {
        const amount = summaryMap[cat.id] || 0;
        const budget = cat.budget || 0;
        totalBudget += budget;
        const percentage = budget > 0 ? (amount / budget) * 100 : 0;
        const remaining = budget - amount;
        return {
          categoryId: cat.id, name: cat.name, icon: cat.icon || 'help', color: cat.color || colors.textSub,
          amount, budget, percentage, remaining, isOver: remaining < 0
        };
      });
    summaryList.sort((a, b) => b.amount - a.amount);
    return { list: summaryList, totalExpense, totalBudget };
  }, [recentTransactions, categories]);


  // --- アクション ---
  const changeMonth = (increment: number) => {
    const newDate = new Date(currentMonth);
    newDate.setDate(1); 
    newDate.setMonth(newDate.getMonth() + increment);
    setCurrentMonth(newDate);
    setSelectedDate('');
  };
  const totalBalance = accounts.filter(a => !a.isArchived).reduce((sum, acc) => sum + (acc.balance || 0), 0);
  const handlePressItem = (item: any) => { navigation.navigate('Input', { transaction: { ...item, date: item.date.getTime() } }); };
  const getDayOfWeek = (date: Date) => ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];

  const handleSaveBudgets = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      setLoading(true);
      const updates = Object.keys(editingBudgets).map(async (catId) => {
        const val = parseInt(editingBudgets[catId]);
        if (!isNaN(val)) {
          const catRef = doc(db, `users/${user.uid}/categories`, catId);
          await updateDoc(catRef, { budget: val });
        }
      });
      await Promise.all(updates);
      setShowBudgetModal(false);
      Alert.alert("完了", "予算を保存しました");
    } catch (e) { console.error(e); Alert.alert("エラー", "保存に失敗しました"); } finally { setLoading(false); }
  };
  const startEditBudgets = () => {
    const initialValues: Record<string, string> = {};
    categories.forEach(c => { if (c.type === 'expense') initialValues[c.id] = c.budget ? c.budget.toString() : ''; });
    setEditingBudgets(initialValues);
    setShowBudgetModal(true);
  };


  // --- UI Parts ---
  const ModeButton = ({ mode, label, icon }: { mode: ViewMode, label: string, icon: any }) => {
    const isActive = viewMode === mode;
    return (
      <TouchableOpacity 
        style={[styles.modeButton, isActive && { backgroundColor: colors.tint, borderColor: colors.tint }]} 
        onPress={() => setViewMode(mode)}
      >
        <Ionicons name={icon} size={16} color={isActive ? 'white' : colors.textSub} />
        <Text style={[styles.modeText, isActive && { color: 'white', fontWeight: 'bold' }]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  const renderTransactionItem = (item: any, showDate: boolean = false) => {
    const category = categories.find(c => c.id === item.categoryId);
    let iconName = category?.icon;
    let iconColor = category?.color || colors.text;
    if (!iconName) {
      switch(item.type) {
        case 'transfer': iconName = 'swap-horizontal'; break;
        case 'income': iconName = 'arrow-down'; iconColor = '#36A2EB'; break;
        default: iconName = 'cart';
      }
    }
    return (
      <TouchableOpacity key={item.id} style={[styles.transactionItem, { borderBottomColor: colors.border }]} onPress={() => handlePressItem(item)}>
        <View style={styles.dateIconBox}>
          <View style={[styles.iconCircle, { backgroundColor: colors.background, borderColor: iconColor, borderWidth: 1 }]}>
            <Ionicons name={iconName as any} size={18} color={iconColor} />
          </View>
        </View>
        <View style={styles.infoBox}>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <Text style={[styles.mainText, { color: colors.text }]} numberOfLines={1}>
              {category ? category.name : (item.type === 'transfer' ? '振替' : '未分類')}
            </Text>
            {item.imageUrl && (<Ionicons name="image" size={16} color={colors.textSub} style={{marginLeft: 5}} />)}
          </View>
          <Text style={[styles.subText, { color: colors.textSub }]} numberOfLines={1}>{item.memo || item.subCategory || '詳細なし'}</Text>
        </View>
        <View style={styles.amountBox}>
          <Text style={[styles.amountText, { color: item.type === 'income' ? '#36A2EB' : item.type === 'expense' ? '#FF6384' : colors.text }]}>
            {item.type === 'expense' ? '-' : ''}¥{item.amount.toLocaleString()}
          </Text>
          {showDate && (<Text style={{fontSize: 10, color: colors.textSub}}>{item.date.getDate()}日</Text>)}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={styles.container}>
        
        <ScrollView 
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} />}
          nestedScrollEnabled={true} 
        >
          {/* 1. モード切替 */}
          <View style={styles.modeContainer}>
            <ModeButton mode="daily" label="日" icon="list" />
            <ModeButton mode="calendar" label="カレンダー" icon="calendar" />
            <ModeButton mode="summary" label="月計" icon="pie-chart" />
            <ModeButton mode="assets" label="資産推移" icon="trending-up" />
          </View>

          {/* 2. 年月切り替え (★修正: 全モードで表示) */}
          <View style={[styles.dateCard, { backgroundColor: colors.card, shadowColor: colors.text }]}>
            <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.largeArrowButton}>
              <Ionicons name="chevron-back" size={32} color={colors.tint} />
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
              <Text style={[styles.yearText, { color: colors.textSub }]}>{currentMonth.getFullYear()}年</Text>
              <Text style={[styles.monthTextMain, { color: colors.text }]}>{currentMonth.getMonth() + 1}月</Text>
            </View>
            <TouchableOpacity onPress={() => changeMonth(1)} style={styles.largeArrowButton}>
              <Ionicons name="chevron-forward" size={32} color={colors.tint} />
            </TouchableOpacity>
          </View>

          {/* 3. コンテンツ */}

          {/* === A. 日次モード === */}
          {viewMode === 'daily' && (
            <>
              <View style={[styles.statsCard, { backgroundColor: colors.card, shadowColor: colors.text }]}>
                <View style={styles.statRow}>
                  <View style={styles.statItem}>
                    <Text style={[styles.statLabel, { color: colors.textSub }]}>収入</Text>
                    <Text style={[styles.statValue, { color: '#36A2EB' }]}>+¥{monthlyStats.income.toLocaleString()}</Text>
                  </View>
                  <View style={styles.dividerVertical} />
                  <View style={styles.statItem}>
                    <Text style={[styles.statLabel, { color: colors.textSub }]}>支出</Text>
                    <Text style={[styles.statValue, { color: '#FF6384' }]}>-¥{monthlyStats.expense.toLocaleString()}</Text>
                  </View>
                </View>
                <View style={styles.barContainer}>
                  <View style={{ flex: monthlyStats.income || 1, backgroundColor: '#36A2EB', height: 4 }} />
                  <View style={{ flex: monthlyStats.expense || 1, backgroundColor: '#FF6384', height: 4 }} />
                </View>
                <View style={[styles.dividerHorizontal, { backgroundColor: colors.border }]} />
                <View style={styles.totalAssetRow}>
                  <Text style={[styles.statLabel, { color: colors.textSub }]}>現在の総資産</Text>
                  <Text style={[styles.totalAssetValue, { color: colors.text }]}>¥{totalBalance.toLocaleString()}</Text>
                </View>
              </View>

              <View style={styles.listSection}>
                {groupedTransactions.map((group) => (
                  <View key={group.dateStr} style={{ marginBottom: 20 }}>
                    <View style={[styles.dateHeader, { backgroundColor: colors.background }]}>
                      <Text style={[styles.dateHeaderText, { color: colors.text }]}>
                        {group.dateObj.getMonth() + 1}/{group.dateObj.getDate()} ({getDayOfWeek(group.dateObj)})
                      </Text>
                      <Text style={[styles.dateHeaderTotal, { color: group.total >= 0 ? '#36A2EB' : '#FF6384' }]}>
                        {group.total > 0 ? '+' : ''}{group.total.toLocaleString()}円
                      </Text>
                    </View>
                    <View style={[styles.dayGroupContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      {group.items.map(item => renderTransactionItem(item))}
                    </View>
                  </View>
                ))}
                {groupedTransactions.length === 0 && <View style={{ padding: 30, alignItems: 'center' }}><Text style={{ color: colors.textSub }}>履歴がありません</Text></View>}
              </View>
            </>
          )}

          {/* === B. カレンダーモード === */}
          {viewMode === 'calendar' && (
            <View style={{ marginHorizontal: 20 }}>
              <Calendar
                key={currentMonth.toISOString()}
                current={currentMonth.toISOString().split('T')[0]}
                hideArrows={true}
                renderHeader={() => null} 
                disableMonthChange={true} 
                dayComponent={({ date, state }: any) => {
                  const dateStr = date.dateString;
                  const dayData = dailyTotals[dateStr];
                  const isSelected = dateStr === selectedDate;
                  const isToday = state === 'today';
                  let dayTextColor = colors.text;
                  if (isSelected) dayTextColor = 'white';
                  else if (state === 'disabled') dayTextColor = '#ccc';
                  else if (isToday) dayTextColor = colors.tint;
                  return (
                    <TouchableOpacity
                      onPress={() => setSelectedDate(dateStr)}
                      style={[styles.calendarDayCell, isSelected && { backgroundColor: colors.tint, borderRadius: 4 }]}
                    >
                      <Text style={{ fontSize: 12, fontWeight: isToday || isSelected ? 'bold' : 'normal', color: dayTextColor, marginBottom: 2 }}>{date.day}</Text>
                      {dayData?.income > 0 && (<Text style={{ fontSize: 8, color: isSelected ? 'white' : '#36A2EB' }} numberOfLines={1}>+{dayData.income.toLocaleString()}</Text>)}
                      {dayData?.expense > 0 && (<Text style={{ fontSize: 8, color: isSelected ? 'white' : '#FF6384' }} numberOfLines={1}>-{dayData.expense.toLocaleString()}</Text>)}
                    </TouchableOpacity>
                  );
                }}
                theme={{ calendarBackground: colors.card, textSectionTitleColor: colors.textSub }}
                style={{ borderRadius: 15, paddingBottom: 10 }}
              />
              <View style={{ marginTop: 20 }}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>{selectedDate ? `${selectedDate} の明細` : '日付を選択してください'}</Text>
                <View style={[styles.dayGroupContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {selectedDateTransactions.length > 0 ? (selectedDateTransactions.map(item => renderTransactionItem(item))) : (selectedDate && <Text style={{ padding: 20, textAlign: 'center', color: colors.textSub }}>この日の記録はありません</Text>)}
                </View>
              </View>
            </View>
          )}

          {/* === C. 月計 === */}
          {viewMode === 'summary' && (
            <View style={{ paddingHorizontal: 20 }}>
              <TouchableOpacity style={[styles.budgetSettingButton, { borderColor: colors.tint }]} onPress={startEditBudgets}>
                <Ionicons name="settings-outline" size={16} color={colors.tint} />
                <Text style={{ color: colors.tint, fontWeight: 'bold', marginLeft: 5 }}>予算を設定する</Text>
              </TouchableOpacity>
              {categorySummary.totalBudget > 0 && (
                  <View style={[styles.summaryTotalCard, { backgroundColor: colors.card }]}>
                      <Text style={[styles.summaryLabel, { color: colors.textSub }]}>今月の予算残高</Text>
                      <Text style={[styles.summaryTotalAmount, { color: categorySummary.totalBudget - categorySummary.totalExpense >= 0 ? colors.text : '#FF6384' }]}>
                          ¥{(categorySummary.totalBudget - categorySummary.totalExpense).toLocaleString()}
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.textSub, marginTop: 5 }}>予算 ¥{categorySummary.totalBudget.toLocaleString()} に対して ¥{categorySummary.totalExpense.toLocaleString()} 消費</Text>
                  </View>
              )}
              {categorySummary.totalBudget === 0 && (
                  <View style={[styles.summaryTotalCard, { backgroundColor: colors.card }]}>
                      <Text style={[styles.summaryLabel, { color: colors.textSub }]}>今月の支出合計</Text>
                      <Text style={[styles.summaryTotalAmount, { color: '#FF6384' }]}>¥{categorySummary.totalExpense.toLocaleString()}</Text>
                  </View>
              )}
              <View style={{ marginTop: 10 }}>
                {categorySummary.list.map((item) => (
                  <View key={item.categoryId} style={{ marginBottom: 20 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                      <View style={[styles.miniIconCircle, { backgroundColor: item.color }]}>
                        <Ionicons name={item.icon as any} size={14} color="white" />
                      </View>
                      <Text style={[styles.summaryCategoryName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                      <View style={{ alignItems: 'flex-end' }}>
                         <Text style={[styles.summaryAmount, { color: item.isOver ? '#FF6384' : colors.text }]}>¥{item.amount.toLocaleString()}</Text>
                         {item.budget > 0 && (<Text style={{ fontSize: 10, color: colors.textSub }}>/ {item.budget.toLocaleString()}</Text>)}
                      </View>
                    </View>
                    {item.budget > 0 ? (
                        <View style={{ height: 8, backgroundColor: '#eee', borderRadius: 4, overflow: 'hidden' }}>
                            <View style={{ height: '100%', width: `${Math.min(item.percentage, 100)}%`, backgroundColor: item.isOver ? '#FF6384' : item.color }} />
                        </View>
                    ) : (<View style={{ height: 2, backgroundColor: '#eee', borderRadius: 1 }} />)}
                    {item.isOver && (<Text style={{ fontSize: 10, color: '#FF6384', textAlign: 'right', marginTop: 2 }}>{Math.abs(item.remaining).toLocaleString()}円 オーバー</Text>)}
                  </View>
                ))}
                {categorySummary.list.length === 0 && <View style={{ padding: 30, alignItems: 'center' }}><Text style={{ color: colors.textSub }}>支出データがありません</Text></View>}
              </View>
            </View>
          )}
          
          {/* === D. 資産推移 (★修正: 1ヶ月単位) === */}
          {viewMode === 'assets' && (
            <View>
              {loadingAssets ? (
                 <Text style={{ textAlign: 'center', marginTop: 40, color: colors.textSub }}>計算中...</Text>
              ) : (
                <>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 15, paddingHorizontal: 20 }}>
                    <TouchableOpacity
                      onPress={() => setSelectedChartAccount('total')}
                      style={[styles.accountTab, selectedChartAccount === 'total' && { backgroundColor: colors.tint, borderColor: colors.tint }]}
                    >
                      <Text style={[styles.accountTabText, selectedChartAccount === 'total' && { color: 'white' }]}>全資産合計</Text>
                    </TouchableOpacity>
                    {accounts.filter(a => !a.isArchived).map(acc => (
                      <TouchableOpacity
                        key={acc.id}
                        onPress={() => setSelectedChartAccount(acc.id)}
                        style={[styles.accountTab, selectedChartAccount === acc.id && { backgroundColor: colors.tint, borderColor: colors.tint }]}
                      >
                        <Text style={[styles.accountTabText, selectedChartAccount === acc.id && { color: 'white' }]}>{acc.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <View style={{ alignItems: 'center' }}>
                    {assetHistoryMap[selectedChartAccount] && assetHistoryMap[selectedChartAccount].length > 0 ? (
                      <LineChart
                        data={{
                          // 1ヶ月分なので、日(1, 5, 10...)を表示
                          labels: assetHistoryMap[selectedChartAccount]
                            .filter((d) => d.day === 1 || d.day % 5 === 0)
                            .map(d => d.date),
                          datasets: [
                            { data: assetHistoryMap[selectedChartAccount].map(d => d.balance) },
                            { data: [0], withDots: false, color: () => 'rgba(0,0,0,0)' }
                          ]
                        }}
                        width={SCREEN_WIDTH - 20}
                        height={220}
                        yAxisLabel="¥"
                        yAxisInterval={1}
                        chartConfig={{
                          backgroundColor: colors.card,
                          backgroundGradientFrom: colors.card,
                          backgroundGradientTo: colors.card,
                          decimalPlaces: 0,
                          color: (opacity = 1) => selectedChartAccount === 'total' ? `rgba(54, 162, 235, ${opacity})` : `rgba(255, 99, 132, ${opacity})`,
                          labelColor: (opacity = 1) => colors.textSub,
                          style: { borderRadius: 16 },
                          propsForDots: { r: "0" },
                          propsForBackgroundLines: { strokeDasharray: "" }
                        }}
                        bezier
                        style={{ marginVertical: 8, borderRadius: 16 }}
                        fromZero={true} 
                      />
                    ) : (
                      <Text style={{ marginTop: 20, color: colors.textSub }}>データがありません</Text>
                    )}
                  </View>
                </>
              )}
            </View>
          )}

        </ScrollView>
        
        {/* FAB */}
        <TouchableOpacity style={[styles.fab, { backgroundColor: colors.tint }]} onPress={() => navigation.navigate('Input')}>
          <Ionicons name="add" size={32} color="white" />
        </TouchableOpacity>

        {/* Modal類 */}
        <Modal visible={!!selectedImage} transparent={true} onRequestClose={() => setSelectedImage(null)}>
           <View style={styles.modalOverlay}>
            <TouchableOpacity style={styles.modalCloseArea} onPress={() => setSelectedImage(null)} />
            {selectedImage && (
              <View style={styles.modalContent}>
                <Image source={{ uri: selectedImage }} style={styles.fullImage} resizeMode="contain" />
                <TouchableOpacity style={styles.closeButton} onPress={() => setSelectedImage(null)}><Ionicons name="close" size={30} color="white" /></TouchableOpacity>
              </View>
            )}
          </View>
        </Modal>

        <Modal visible={showBudgetModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowBudgetModal(false)}>
            <View style={[styles.budgetModalContainer, { backgroundColor: colors.background }]}>
                <View style={styles.budgetModalHeader}>
                    <Text style={[styles.budgetModalTitle, { color: colors.text }]}>予算の設定</Text>
                    <TouchableOpacity onPress={() => setShowBudgetModal(false)}>
                        <Text style={{ color: colors.tint, fontSize: 16 }}>閉じる</Text>
                    </TouchableOpacity>
                </View>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
                        <Text style={{ color: colors.textSub, marginBottom: 20 }}>科目ごとの月間予算を入力してください。{'\n'}0または空欄にすると予算なしになります。</Text>
                        {categories.filter(c => c.type === 'expense').map(cat => (
                            <View key={cat.id} style={styles.budgetInputRow}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', width: '40%' }}>
                                    <View style={[styles.miniIconCircle, { backgroundColor: cat.color || colors.textSub }]}>
                                        <Ionicons name={cat.icon as any || 'help'} size={14} color="white" />
                                    </View>
                                    <Text style={{ color: colors.text, fontWeight: 'bold' }} numberOfLines={1}>{cat.name}</Text>
                                </View>
                                <TextInput
                                    style={[styles.budgetInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                                    keyboardType="number-pad"
                                    placeholder="0"
                                    value={editingBudgets[cat.id]}
                                    onChangeText={(text) => setEditingBudgets(prev => ({ ...prev, [cat.id]: text }))}
                                    textAlign="right"
                                />
                                <Text style={{ marginLeft: 10, color: colors.text }}>円</Text>
                            </View>
                        ))}
                    </ScrollView>
                </KeyboardAvoidingView>
                <View style={[styles.budgetFooter, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
                    <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.tint }]} onPress={handleSaveBudgets}>
                        <Text style={styles.saveButtonText}>保存する</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  container: { flex: 1 },

  modeContainer: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 10 },
  modeButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: '#ddd', backgroundColor: 'white' },
  modeText: { marginLeft: 4, fontSize: 12, color: '#666' },

  dateCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', margin: 20, marginBottom: 10, padding: 15, borderRadius: 15, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 3 },
  largeArrowButton: { padding: 10 },
  yearText: { fontSize: 12, fontWeight: '600' },
  monthTextMain: { fontSize: 24, fontWeight: 'bold' },

  statsCard: { marginHorizontal: 20, marginBottom: 20, borderRadius: 15, padding: 15, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 3 },
  statRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginBottom: 10 },
  statItem: { alignItems: 'center', flex: 1 },
  statLabel: { fontSize: 12, marginBottom: 4 },
  statValue: { fontSize: 18, fontWeight: 'bold' },
  dividerVertical: { width: 1, backgroundColor: '#eee', height: 40 },
  barContainer: { flexDirection: 'row', height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: '#f0f0f0', marginBottom: 15 },
  dividerHorizontal: { height: 1, width: '100%', marginBottom: 15 },
  totalAssetRow: { alignItems: 'center' },
  totalAssetValue: { fontSize: 24, fontWeight: 'bold', marginTop: 4 },

  calendarDayCell: { width: 48, height: 48, justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: 4, paddingRight: 4 },

  listSection: { paddingHorizontal: 20 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 10 },
  dateHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 5, marginBottom: 5 },
  dateHeaderText: { fontSize: 14, fontWeight: 'bold' },
  dateHeaderTotal: { fontSize: 14, fontWeight: 'bold' },
  dayGroupContainer: { borderRadius: 12, overflow: 'hidden', borderWidth: 1 },
  transactionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 15, borderBottomWidth: 0.5 },
  dateIconBox: { alignItems: 'center', marginRight: 15, width: 40 },
  iconCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  infoBox: { flex: 1 },
  mainText: { fontSize: 16, fontWeight: '500' },
  subText: { fontSize: 12, marginTop: 2 },
  amountBox: { alignItems: 'flex-end' },
  amountText: { fontSize: 16, fontWeight: 'bold' },
  fab: { position: 'absolute', bottom: 30, right: 30, width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 4.65, elevation: 8 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  modalCloseArea: { ...StyleSheet.absoluteFillObject },
  modalContent: { width: '90%', height: '70%', justifyContent: 'center', alignItems: 'center' },
  fullImage: { width: '100%', height: '100%' },
  closeButton: { position: 'absolute', top: -40, right: 0, padding: 10 },

  budgetSettingButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 10, borderWidth: 1, borderRadius: 8, marginBottom: 20 },
  summaryTotalCard: { alignItems: 'center', padding: 20, borderRadius: 15, marginBottom: 20, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 3 },
  summaryLabel: { fontSize: 12, marginBottom: 5 },
  summaryTotalAmount: { fontSize: 32, fontWeight: 'bold' },
  miniIconCircle: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  summaryCategoryName: { flex: 1, fontSize: 14, fontWeight: '600' },
  summaryAmount: { fontSize: 16, fontWeight: 'bold', marginRight: 5 },
  
  budgetModalContainer: { flex: 1, marginTop: 50, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  budgetModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  budgetModalTitle: { fontSize: 18, fontWeight: 'bold' },
  budgetInputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  budgetInput: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 16 },
  budgetFooter: { padding: 20, borderTopWidth: 1 },
  saveButton: { paddingVertical: 15, borderRadius: 30, alignItems: 'center' },
  saveButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },

  accountTab: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: '#ddd', marginRight: 8, backgroundColor: 'white' },
  accountTabText: { fontSize: 12, color: '#666', fontWeight: '600' },
});