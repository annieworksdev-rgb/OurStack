import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, Button, StyleSheet, Alert, 
  ScrollView, TouchableOpacity, Platform, KeyboardAvoidingView 
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons'; // アイコン用
import { collection, doc, writeBatch, increment, deleteField } from 'firebase/firestore';
import { db, auth } from '../../services/firebase/config';
import { useMasterData } from '../../store/MasterContext';
import { TransactionType } from '../../types';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useThemeColor } from '../../hooks/useThemeColor';

export default function InputScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { transaction } = route.params || {};
  const isEditMode = !!transaction;
  const { categories, accounts } = useMasterData();
  const colors = useThemeColor();

  // --- State ---
  const [type, setType] = useState<TransactionType>('expense');
  const [date, setDate] = useState(new Date());
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');

  // 選択ID
  const [categoryId, setCategoryId] = useState('');
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');

  // 日付ピッカー制御
  const [showDatePicker, setShowDatePicker] = useState(false);

  // --- 初期化 & 依存関係ロジック (既存のまま維持) ---
  useEffect(() => {
    // 新規作成時のみ初期値をセット
    if (!isEditMode && accounts.length > 0) {
      if (!fromAccountId) setFromAccountId(accounts[0].id);
      if (!toAccountId) setToAccountId(accounts[0].id);
    }
    
    // 科目の初期選択
    if (!isEditMode) {
      const filteredCats = categories.filter(c => c.type === type);
      if (filteredCats.length > 0) {
        setCategoryId(filteredCats[0].id);
      }
    }
  }, [accounts, categories, type, isEditMode]);

  useEffect(() => {
    // 口座の整合性チェック
    const validToAccounts = accounts.filter(a => {
      if (type === 'charge') return a.type === 'e_money';
      return true;
    });

    const isValidSelection = validToAccounts.some(a => a.id === toAccountId);
    if (!isValidSelection && validToAccounts.length > 0) {
      setToAccountId(validToAccounts[0].id);
    }
  }, [type, accounts, toAccountId]);

  useEffect(() => {
    if (transaction) {
      setType(transaction.type);
      
      let initialDate = new Date();
      if (typeof transaction.date === 'string') {
        initialDate = new Date(transaction.date);
      } else if (transaction.date?.toDate) {
        initialDate = transaction.date.toDate();
      } else {
        initialDate = new Date(transaction.date);
      }
      setDate(initialDate);

      setAmount(transaction.amount.toString());
      setMemo(transaction.memo || '');
      
      if (transaction.categoryId) setCategoryId(transaction.categoryId);
      if (transaction.sourceAccountId) setFromAccountId(transaction.sourceAccountId);
      
      if (transaction.targetAccountId) {
        if (transaction.type === 'income') {
           setFromAccountId(transaction.targetAccountId);
        } else {
           setToAccountId(transaction.targetAccountId);
        }
      }
    }
  }, [transaction]);

  // --- フィルタリング ---
  const currentCategories = categories.filter(c => c.type === type);
  const toAccountOptions = accounts.filter(a => {
    if (type === 'charge') return a.type === 'e_money';
    return true;
  });

  // --- 削除処理 (既存ロジック維持) ---
  const handleDelete = async () => {
    if (!isEditMode || !transaction) return;

    Alert.alert(
      "削除の確認",
      "この明細を削除しますか？\n（口座残高も元に戻ります）",
      [
        { text: "キャンセル", style: "cancel" },
        { 
          text: "削除する", 
          style: 'destructive',
          onPress: async () => {
            try {
              const batch = writeBatch(db);
              const t = transaction;
              const valAmount = t.amount;

              if (t.type === 'expense') {
                const ref = doc(db, `users/${auth.currentUser?.uid}/accounts`, t.sourceAccountId);
                batch.update(ref, { balance: increment(valAmount) });
              } else if (t.type === 'income') {
                const targetId = t.targetAccountId || t.sourceAccountId;
                if(targetId) {
                    const ref = doc(db, `users/${auth.currentUser?.uid}/accounts`, targetId);
                    batch.update(ref, { balance: increment(-valAmount) });
                }
              } else {
                const sourceRef = doc(db, `users/${auth.currentUser?.uid}/accounts`, t.sourceAccountId);
                const targetRef = doc(db, `users/${auth.currentUser?.uid}/accounts`, t.targetAccountId);
                batch.update(sourceRef, { balance: increment(valAmount) });
                batch.update(targetRef, { balance: increment(-valAmount) });
              }

              const transRef = doc(db, `users/${auth.currentUser?.uid}/transactions`, t.id);
              batch.delete(transRef);
              await batch.commit();
              navigation.goBack();
            } catch (e: any) {
              Alert.alert("エラー", e.message);
            }
          }
        }
      ]
    );
  };

  // --- 保存処理 (既存ロジック維持) ---
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
      const batch = writeBatch(db);

      // 1. 旧データの取り消し
      if (isEditMode && transaction) {
        const t = transaction;
        const oldAmount = t.amount;

        if (t.type === 'expense') {
          const ref = doc(db, `users/${user.uid}/accounts`, t.sourceAccountId);
          batch.update(ref, { balance: increment(oldAmount) });
        } else if (t.type === 'income') {
          const targetId = t.targetAccountId || t.sourceAccountId;
          if (targetId) {
            const ref = doc(db, `users/${user.uid}/accounts`, targetId);
            batch.update(ref, { balance: increment(-oldAmount) });
          }
        } else {
          const sourceRef = doc(db, `users/${user.uid}/accounts`, t.sourceAccountId);
          const targetRef = doc(db, `users/${user.uid}/accounts`, t.targetAccountId);
          batch.update(sourceRef, { balance: increment(oldAmount) });
          batch.update(targetRef, { balance: increment(-oldAmount) });
        }
      }

      // 2. 新規/更新データの作成
      const docRef = isEditMode && transaction
        ? doc(db, `users/${user.uid}/transactions`, transaction.id)
        : doc(collection(db, `users/${user.uid}/transactions`));

      const transactionData: any = {
        id: docRef.id, 
        type,
        date: date,
        amount: valAmount,
        memo,
        updatedAt: new Date(),
        ...(isEditMode ? {} : { 
          createdBy: user.uid, 
          createdAt: new Date(),
          approvalStatus: 'confirmed',
          scope: 'private',
        })
      };

      if (type === 'expense') {
        transactionData.sourceAccountId = fromAccountId;
        transactionData.targetAccountId = deleteField();
        transactionData.categoryId = categoryId;
        transactionData.categoryName = categories.find(c => c.id === categoryId)?.name;

        const sourceRef = doc(db, `users/${user.uid}/accounts`, fromAccountId);
        batch.update(sourceRef, { balance: increment(-valAmount) });

      } else if (type === 'income') {
        transactionData.sourceAccountId = deleteField();
        transactionData.targetAccountId = fromAccountId; 
        transactionData.categoryId = categoryId;
        transactionData.categoryName = categories.find(c => c.id === categoryId)?.name;

        const targetRef = doc(db, `users/${user.uid}/accounts`, fromAccountId);
        batch.update(targetRef, { balance: increment(valAmount) });

      } else {
        transactionData.sourceAccountId = fromAccountId;
        transactionData.targetAccountId = toAccountId;
        transactionData.categoryId = deleteField();
        transactionData.categoryName = '';

        const sourceRef = doc(db, `users/${user.uid}/accounts`, fromAccountId);
        const targetRef = doc(db, `users/${user.uid}/accounts`, toAccountId);
        batch.update(sourceRef, { balance: increment(-valAmount) });
        batch.update(targetRef, { balance: increment(valAmount) });
      }

      if (isEditMode) {
        batch.update(docRef, transactionData);
      } else {
        batch.set(docRef, transactionData);
      }

      await batch.commit();
      navigation.goBack();

    } catch (e: any) {
      Alert.alert("エラー", e.message);
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) setDate(selectedDate);
  };

  // --- UIコンポーネント ---

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        
        {/* 1. 区分タブ */}
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

        {/* 2. 金額入力（メイン） */}
        <View style={styles.amountContainer}>
          <Text style={[styles.yenMark, { color: colors.text }]}>¥</Text>
          <TextInput
            style={[styles.amountInput, { color: colors.text }]}
            placeholder="0"
            placeholderTextColor={colors.textSub}
            keyboardType="number-pad"
            value={amount}
            onChangeText={setAmount}
            autoFocus
          />
        </View>

        {/* 3. 日付選択（ボタン化） */}
        <View style={styles.dateRow}>
          <TouchableOpacity 
            style={[styles.dateButton, { backgroundColor: colors.card, borderColor: colors.border }]} 
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={20} color={colors.text} style={{ marginRight: 8 }} />
            <Text style={[styles.dateText, { color: colors.text }]}>
              {date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
            </Text>
          </TouchableOpacity>
          {(showDatePicker || Platform.OS === 'ios') && (Platform.OS === 'ios' ? (
             // iOSはインライン表示させたい場合は要調整だが、今回はModal的に扱うか、ボタンタップで表示
             // ここでは簡易的に非表示(DateTimePickerの仕様に依存)
             <View style={{ display: 'none' }}><DateTimePicker value={date} onChange={onDateChange} /></View>
          ) : (
             showDatePicker && <DateTimePicker value={date} onChange={onDateChange} />
          ))}
           {/* iOS用のPicker呼び出しハック（実機で動作確認推奨） */}
           {Platform.OS === 'ios' && (
             <DateTimePicker 
               value={date} 
               mode="date" 
               display="compact"
               onChange={onDateChange}
               style={{ marginLeft: 'auto' }}
             />
           )}
        </View>

        {/* 4. マスタ選択エリア */}
        
        {/* 科目選択 (支出・収入のみ) */}
        {(type === 'expense' || type === 'income') && (
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.textSub }]}>科目</Text>
            <View style={styles.gridContainer}>
              {currentCategories.map(cat => (
                <TouchableOpacity 
                  key={cat.id}
                  style={[
                    styles.catButton, 
                    { borderColor: colors.border, backgroundColor: colors.card },
                    categoryId === cat.id && { backgroundColor: colors.tint, borderColor: colors.tint }
                  ]}
                  onPress={() => setCategoryId(cat.id)}
                >
                  <Ionicons 
                    name={cat.icon as any || 'pricetag'} 
                    size={24} 
                    color={categoryId === cat.id ? 'white' : colors.text} 
                  />
                  <Text style={[
                    styles.catText, 
                    { color: categoryId === cat.id ? 'white' : colors.text }
                  ]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
              {/* 科目がない場合のメッセージ */}
              {currentCategories.length === 0 && (
                <Text style={{ color: colors.textSub, padding: 10 }}>科目がありません。設定から追加してください。</Text>
              )}
            </View>
          </View>
        )}

        {/* 口座選択A：出金元（収入以外）or 入金先（収入） */}
        {/* ロジック上、収入の入金先も fromAccountId を使っているので、ここで共通化 */}
        {(type !== 'income' || type === 'income') && (
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.textSub }]}>
              {type === 'income' ? '入金先' : '支払い元'}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.accountScroll}>
              {accounts.map(acc => (
                <TouchableOpacity
                  key={acc.id}
                  style={[
                    styles.accButton,
                    { borderColor: colors.border, backgroundColor: colors.card },
                    fromAccountId === acc.id && { borderColor: colors.tint, borderWidth: 2, backgroundColor: colors.card }
                  ]}
                  onPress={() => setFromAccountId(acc.id)}
                >
                   <Ionicons 
                    name={acc.type === 'cash' ? 'wallet-outline' : 'card-outline'} 
                    size={16} 
                    color={fromAccountId === acc.id ? colors.tint : colors.textSub} 
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[
                    styles.accText, 
                    { color: fromAccountId === acc.id ? colors.tint : colors.text }
                  ]}>
                    {acc.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* 矢印 (振替・チャージのみ) */}
        {(type === 'transfer' || type === 'charge') && (
          <View style={{ alignItems: 'center', marginVertical: 5 }}>
            <Ionicons name="arrow-down-circle" size={24} color={colors.textSub} />
          </View>
        )}

        {/* 口座選択B：入金先（振替・チャージのみ） */}
        {(type === 'transfer' || type === 'charge') && (
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.textSub }]}>入金先</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.accountScroll}>
              {toAccountOptions.map(acc => (
                <TouchableOpacity
                  key={acc.id}
                  style={[
                    styles.accButton,
                    { borderColor: colors.border, backgroundColor: colors.card },
                    toAccountId === acc.id && { borderColor: colors.tint, borderWidth: 2 }
                  ]}
                  onPress={() => setToAccountId(acc.id)}
                >
                  <Text style={[
                    styles.accText, 
                    { color: toAccountId === acc.id ? colors.tint : colors.text }
                  ]}>
                    {acc.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* 5. メモ */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.textSub }]}>メモ</Text>
          <TextInput
            style={[styles.inputMemo, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]}
            placeholder="コンビニ、ランチなど"
            placeholderTextColor={colors.textSub}
            value={memo}
            onChangeText={setMemo}
          />
        </View>

        {/* 削除ボタン（編集モードのみ） */}
        {isEditMode && (
          <TouchableOpacity onPress={handleDelete} style={{ alignItems: 'center', marginTop: 20 }}>
            <Text style={{ color: colors.error, fontSize: 16 }}>この明細を削除</Text>
          </TouchableOpacity>
        )}

      </ScrollView>

      {/* フッター保存ボタン */}
      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <TouchableOpacity 
          style={[styles.saveButton, { backgroundColor: colors.tint }]} 
          onPress={handleSave}
        >
          <Text style={styles.saveText}>{isEditMode ? '変更を保存' : '保存する'}</Text>
        </TouchableOpacity>
      </View>

    </KeyboardAvoidingView>
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
  segmentBtnFirst: { borderTopLeftRadius: 5, borderBottomLeftRadius: 5 },
  segmentBtnLast: { borderTopRightRadius: 5, borderBottomRightRadius: 5 },
  segmentText: { fontSize: 12, fontWeight: 'bold' },

  // 金額
  amountContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  yenMark: { fontSize: 30, fontWeight: 'bold', marginRight: 10 },
  amountInput: { fontSize: 40, fontWeight: 'bold', minWidth: 100, textAlign: 'center' },

  // 日付
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  dateButton: { 
    flexDirection: 'row', alignItems: 'center', 
    paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, borderWidth: 1 
  },
  dateText: { fontSize: 16, fontWeight: '600' },

  // 各セクション
  section: { marginBottom: 20 },
  label: { fontSize: 13, marginBottom: 8, fontWeight: '600' },

  // 科目グリッド
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', marginHorizontal: -5 },
  catButton: { 
    width: '22%', aspectRatio: 1, 
    justifyContent: 'center', alignItems: 'center', 
    margin: '1.5%', borderRadius: 12, borderWidth: 1 
  },
  catText: { fontSize: 11, marginTop: 4, textAlign: 'center' },

  // 口座スクロール
  accountScroll: { flexDirection: 'row' },
  accButton: { 
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10, 
    borderRadius: 20, borderWidth: 1, marginRight: 10 
  },
  accText: { fontWeight: 'bold', fontSize: 14 },

  // メモ
  inputMemo: { height: 44, borderRadius: 8, paddingHorizontal: 12, borderWidth: 1 },

  // フッター
  footer: { 
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 20, borderTopWidth: 1, paddingBottom: Platform.OS === 'ios' ? 40 : 20 
  },
  saveButton: { height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: {height: 2, width: 0}, elevation: 5 },
  saveText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
});