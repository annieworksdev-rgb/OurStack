import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker'; // 日付選択
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db, auth } from '../../services/firebase/config';
import { useMasterData } from '../../store/MasterContext';
import { Transaction, TransactionType, ID } from '../../types';
import { useNavigation } from '@react-navigation/native';
import { useThemeColor } from '../../hooks/useThemeColor';

export default function InputScreen() {
  const navigation = useNavigation();
  const { categories, accounts } = useMasterData();
  const colors = useThemeColor();

  // --- State (ViewModel properties) ---
  const [type, setType] = useState<TransactionType>('expense'); // 初期値：支出
  const [date, setDate] = useState(new Date());
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');

  // 選択ID
  const [categoryId, setCategoryId] = useState('');
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');

  // 日付ピッカーの表示制御（Android用）
  const [showDatePicker, setShowDatePicker] = useState(false);

  // --- 初期値設定ロジック ---
  useEffect(() => {
    // マスタ読み込み完了時、とりあえず先頭の口座を選択状態にする
    if (accounts.length > 0) {
      if (!fromAccountId) setFromAccountId(accounts[0].id);
      if (!toAccountId) setToAccountId(accounts[0].id);
    }
    // 科目は現在のTypeに合わせてフィルタして先頭を選択
    const filteredCats = categories.filter(c => c.type === type);
    if (filteredCats.length > 0) {
      setCategoryId(filteredCats[0].id);
    }
  }, [accounts, categories, type]); // typeが変わったら科目の選択肢もリセット

  // --- フィルタリングロジック (CollectionViewSource) ---
  
  // 1. 科目の選択肢（収入or支出でフィルタ）
  const currentCategories = categories.filter(c => c.type === type);

  // 2. 「入金先」口座の選択肢（チャージの場合は電子マネーのみに限定）
  const toAccountOptions = accounts.filter(a => {
    if (type === 'charge') return a.type === 'e_money'; // チャージは電子マネーのみ
    return true;
  });

  // --- 保存処理 ---
  const handleSave = async () => {
    if (!amount) {
      Alert.alert("エラー", "金額を入力してください");
      return;
    }
    const valAmount = parseInt(amount);
    if (isNaN(valAmount)) return;

    const user = auth.currentUser;
    if (!user) return;

    try {
      // データの組み立て
      const newTransaction: Partial<Transaction> = {
        type,
        date: date as any,
        amount: valAmount,
        memo,
        createdBy: user.uid,
        createdAt: new Date() as any,
        approvalStatus: 'confirmed',
        scope: 'private',
      };

      // 区分ごとの必須項目セット
      if (type === 'expense') {
        // 支出: [出金元] から出ていく
        newTransaction.sourceAccountId = fromAccountId;
        newTransaction.targetAccountId = undefined; // 宛先なし
        newTransaction.categoryId = categoryId;
        newTransaction.categoryName = categories.find(c => c.id === categoryId)?.name;

      } else if (type === 'income') {
        // 収入： [発生] -> 入金先 (sourceAccountIdに入れますが、UI上は「入金先」)
        newTransaction.sourceAccountId = undefined; // 外部からの収入なのでSourceはnull (型エラーが出る場合は 'external' 等の固定文字を入れる)
        newTransaction.targetAccountId = fromAccountId; // UI上の「入金先」選択値を入れる
        newTransaction.categoryId = categoryId;
        newTransaction.categoryName = categories.find(c => c.id === categoryId)?.name;

      } else {
        // 振替・チャージ： 出金元 -> 入金先
        newTransaction.sourceAccountId = fromAccountId;
        newTransaction.targetAccountId = toAccountId;
        // 科目は「なし」またはシステム固定値
        newTransaction.categoryId = undefined;
        newTransaction.categoryName = '';
      }

      await addDoc(collection(db, `users/${user.uid}/transactions`), newTransaction);
      navigation.goBack();

    } catch (e: any) {
      Alert.alert("エラー", e.message);
    }
  };

  // 日付変更ハンドラ
  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) setDate(selectedDate);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      
      {/* 1. 区分切り替えタブ (Segmented Control) */}
      <View style={styles.segmentContainer}>
        {(['expense', 'income', 'transfer', 'charge'] as TransactionType[]).map((t, index, array) => (
          <TouchableOpacity
            key={t}
            style={[
              styles.segmentBtn,
              index === 0 && styles.segmentBtnFirst,
              index === array.length - 1 && styles.segmentBtnLast,

              type === t && { backgroundColor: colors.tint },
              { borderColor: colors.tint }
            ]}
            onPress={() => setType(t)}
          >
            <Text style={[
              styles.segmentText,
              type === t ? { color: '#fff' } : { color: colors.tint }
            ]}>
              {t === 'expense' ? '支出' : t === 'income' ? '収入' : t === 'transfer' ? '振替' : 'チャージ'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 2. 日付入力 */}
      <View style={styles.rowItem}>
        <Text style={[styles.label, {color: colors.text}]}>日付</Text>
        {Platform.OS === 'android' ? (
          <View>
             <Button title={date.toLocaleDateString()} onPress={() => setShowDatePicker(true)} color={colors.textSub} />
             {showDatePicker && <DateTimePicker value={date} mode="date" onChange={onDateChange} />}
          </View>
        ) : (
          <DateTimePicker value={date} mode="date" display="default" onChange={onDateChange} />
        )}
      </View>

      {/* 3. 金額入力 */}
      <View style={styles.inputGroup}>
        <Text style={[styles.label, {color: colors.text}]}>金額</Text>
        <TextInput 
          style={[styles.inputAmount, { color: colors.text, borderColor: colors.border }]} 
          keyboardType="numeric" 
          value={amount} 
          onChangeText={setAmount} 
          placeholder="0"
          placeholderTextColor={colors.placeholder}
          autoFocus
        />
      </View>

      {/* 4. 動的フォームエリア */}
      <View style={[styles.formCard, { backgroundColor: colors.card }]}>
        
        {/* 科目 (振替・チャージ以外で表示) */}
        {(type === 'expense' || type === 'income') && (
          <View style={styles.pickerRow}>
            <Text style={[styles.pickerLabel, {color: colors.textSub}]}>科目</Text>
            <Picker
              selectedValue={categoryId}
              style={{ flex: 1, color: colors.text }}
              onValueChange={v => setCategoryId(v)}>
              {currentCategories.map(c => <Picker.Item key={c.id} label={c.name} value={c.id} />)}
            </Picker>
          </View>
        )}

        {/* 出金元口座 (収入以外で表示) */}
        {type !== 'income' && (
          <View style={styles.pickerRow}>
            <Text style={[styles.pickerLabel, {color: colors.textSub}]}>出金元</Text>
            <Picker
              selectedValue={fromAccountId}
              style={{ flex: 1, color: colors.text }}
              onValueChange={v => setFromAccountId(v)}>
              {accounts.map(a => <Picker.Item key={a.id} label={a.name} value={a.id} />)}
            </Picker>
          </View>
        )}

        {/* 矢印アイコン (振替・チャージ時のみ) */}
        {(type === 'transfer' || type === 'charge') && (
          <View style={{ alignItems: 'center', marginVertical: -5 }}>
            <Text style={{ fontSize: 20, color: colors.textSub }}>↓</Text>
          </View>
        )}

        {/* 入金先口座 (支出以外で表示) */}
        {type !== 'expense' && (
          <View style={styles.pickerRow}>
            <Text style={[styles.pickerLabel, {color: colors.textSub}]}>
              {type === 'income' ? '入金先' : '入金先'}
            </Text>
            <Picker
              selectedValue={type === 'income' ? fromAccountId : toAccountId} // 収入時はfromAccountを使う仕様にした場合
              // ※補足: 収入の「入金先」を fromAccountId に入れるか、targetAccountId に入れるかは設計次第。
              // ここでは「収入も fromAccount (現在の所持金が増える場所)」として扱っていますが、
              // もしUI的に分けたい場合はロジック調整が必要です。
              // 今回は簡単のため、収入時の入金先 = fromAccountId としています。
              onValueChange={v => type === 'income' ? setFromAccountId(v) : setToAccountId(v)}
              style={{ flex: 1, color: colors.text }}>
              
              {/* 収入時は全口座、チャージ時は電子マネーのみ */}
              {(type === 'income' ? accounts : toAccountOptions).map(a => 
                <Picker.Item key={a.id} label={a.name} value={a.id} />
              )}
            </Picker>
          </View>
        )}

      </View>

      {/* 5. メモ */}
      <View style={styles.inputGroup}>
        <Text style={[styles.label, {color: colors.text}]}>メモ</Text>
        <TextInput 
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]} 
          value={memo} 
          onChangeText={setMemo} 
          placeholder="内容を入力"
          placeholderTextColor={colors.placeholder}
        />
      </View>

      <View style={{ marginTop: 30, marginBottom: 50 }}>
        <Button title="保存する" onPress={handleSave} color={colors.tint} />
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  
  // 区分タブ
  segmentContainer: { flexDirection: 'row', justifyContent: 'center', marginBottom: 20 },
  segmentBtn: { 
    paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, 
    flex: 1, alignItems: 'center',
  },
  segmentBtnFirst: {
    borderTopLeftRadius: 5, borderBottomLeftRadius: 5,
  },
  segmentBtnLast: {
    borderTopRightRadius: 5, borderBottomRightRadius: 5,
  },
  segmentText: { fontSize: 12, fontWeight: 'bold' },

  rowItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 },
  label: { fontSize: 14, fontWeight: 'bold', marginBottom: 5 },
  
  inputGroup: { marginBottom: 20 },
  inputAmount: { 
    fontSize: 30, fontWeight: 'bold', textAlign: 'right', 
    borderBottomWidth: 1, padding: 5 
  },
  input: { 
    borderWidth: 1, padding: 12, borderRadius: 8, fontSize: 16 
  },

  formCard: { borderRadius: 10, marginBottom: 20, padding: 10 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: '#ddd' },
  pickerLabel: { width: 60, fontSize: 14, fontWeight: 'bold' },
});