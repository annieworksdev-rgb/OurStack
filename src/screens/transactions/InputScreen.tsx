import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker'; // 日付選択
import { collection, doc, writeBatch, increment, deleteField, Timestamp } from 'firebase/firestore';
import { db, auth } from '../../services/firebase/config';
import { useMasterData } from '../../store/MasterContext';
import { Transaction, TransactionType, ID } from '../../types';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useThemeColor } from '../../hooks/useThemeColor';

export default function InputScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { transaction } = route.params || {};
  const isEditMode = !!transaction;
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

  useEffect(() => {
    // 1. チャージの場合の有効な口座リスト（電子マネーのみ）
    // 2. それ以外（振替など）の場合は全口座
    const validToAccounts = accounts.filter(a => {
      if (type === 'charge') return a.type === 'e_money';
      return true;
    });

    // 現在選択されている toAccountId が、有効なリストの中に存在するかチェック
    const isValidSelection = validToAccounts.some(a => a.id === toAccountId);

    // もし選択中のIDがリストになければ（例: メイン銀行 が選択されているのにリストは PayPayしかない）、
    // 強制的にリストの先頭（PayPay）を選択状態にする
    if (!isValidSelection && validToAccounts.length > 0) {
      setToAccountId(validToAccounts[0].id);
    }
  }, [type, accounts, toAccountId]); // typeが変わるたびにチェック！

  useEffect(() => {
    if (transaction) {
      setType(transaction.type);
      
      let initialDate = new Date();
      if (typeof transaction.date === 'string') {
        initialDate = new Date(transaction.date); // String -> Date
      } else if (transaction.date?.toDate) {
        initialDate = transaction.date.toDate();  // Timestamp -> Date
      } else {
        initialDate = new Date(transaction.date); // Fallback
      }
      setDate(initialDate);

      setAmount(transaction.amount.toString());
      setMemo(transaction.memo || '');
      
      // 科目・口座の復元
      if (transaction.categoryId) setCategoryId(transaction.categoryId);
      if (transaction.sourceAccountId) setFromAccountId(transaction.sourceAccountId);
      
      // 入金先・振替先の復元
      // 以前のロジックに基づき、収入ならtarget、振替ならtargetを見る
      if (transaction.targetAccountId) {
        if (transaction.type === 'income') {
           setFromAccountId(transaction.targetAccountId); // UI上は「入金先」としてfromAccountStateを使う仕様のため
        } else {
           setToAccountId(transaction.targetAccountId);
        }
      }
    }
  }, [transaction]);

  // --- フィルタリングロジック (CollectionViewSource) ---
  
  // 1. 科目の選択肢（収入or支出でフィルタ）
  const currentCategories = categories.filter(c => c.type === type);

  // 2. 「入金先」口座の選択肢（チャージの場合は電子マネーのみに限定）
  const toAccountOptions = accounts.filter(a => {
    if (type === 'charge') return a.type === 'e_money'; // チャージは電子マネーのみ
    return true;
  });

  // --- 削除処理 ---
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
              const t = transaction; // 短縮用
              const valAmount = t.amount;

              // 1. 残高を元に戻す（逆操作）
              // C#なら「Rollback Logic」です
              if (t.type === 'expense') {
                // 支出の削除 = お金が戻ってくる (+)
                const ref = doc(db, `users/${auth.currentUser?.uid}/accounts`, t.sourceAccountId);
                batch.update(ref, { balance: increment(valAmount) });
              
              } else if (t.type === 'income') {
                // 収入の削除 = お金が消える (-)
                // ※保存時のロジックに合わせて targetAccountId を参照
                const targetId = t.targetAccountId || t.sourceAccountId; // 念のため両方ケア
                if(targetId) {
                    const ref = doc(db, `users/${auth.currentUser?.uid}/accounts`, targetId);
                    batch.update(ref, { balance: increment(-valAmount) });
                }

              } else {
                // 振替・チャージの削除 = 出金元に戻し(+), 入金先から引く(-)
                const sourceRef = doc(db, `users/${auth.currentUser?.uid}/accounts`, t.sourceAccountId);
                const targetRef = doc(db, `users/${auth.currentUser?.uid}/accounts`, t.targetAccountId);
                
                batch.update(sourceRef, { balance: increment(valAmount) });
                batch.update(targetRef, { balance: increment(-valAmount) });
              }

              // 2. 明細自体を削除
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
      const batch = writeBatch(db);

      // =========================================================
      // ステップ1: 編集モードなら、まずは「旧データの取り消し」を行う
      // （handleDeleteのロジックとほぼ同じです）
      // =========================================================
      if (isEditMode && transaction) {
        const t = transaction;
        const oldAmount = t.amount;

        if (t.type === 'expense') {
          // 旧: 支出を取り消す（出金元にお金を戻す +）
          const ref = doc(db, `users/${user.uid}/accounts`, t.sourceAccountId);
          batch.update(ref, { balance: increment(oldAmount) });

        } else if (t.type === 'income') {
          // 旧: 収入を取り消す（入金先からお金を引く -）
          const targetId = t.targetAccountId || t.sourceAccountId;
          if (targetId) {
            const ref = doc(db, `users/${user.uid}/accounts`, targetId);
            batch.update(ref, { balance: increment(-oldAmount) });
          }

        } else {
          // 旧: 振替を取り消す（出金元に戻し +、入金先から引く -）
          const sourceRef = doc(db, `users/${user.uid}/accounts`, t.sourceAccountId);
          const targetRef = doc(db, `users/${user.uid}/accounts`, t.targetAccountId);
          batch.update(sourceRef, { balance: increment(oldAmount) });
          batch.update(targetRef, { balance: increment(-oldAmount) });
        }
      }

      // =========================================================
      // ステップ2: 新しい入力内容で「残高更新」を行う
      // （新規作成時と同じロジックです）
      // =========================================================
      
      // 保存先のドキュメント参照（編集なら既存ID、新規なら新ID）
      const docRef = isEditMode && transaction
        ? doc(db, `users/${user.uid}/transactions`, transaction.id)
        : doc(collection(db, `users/${user.uid}/transactions`)); // 新規ID採番

      // 保存するデータオブジェクト作成
      const transactionData: any = {
        // IDは編集時も保持、新規時は生成したRefのID
        id: docRef.id, 
        type,
        date: date, // Date型でOK
        amount: valAmount,
        memo,
        updatedAt: new Date(), // 更新日時
        // 新規作成時のみ必要なフィールド
        ...(isEditMode ? {} : { 
          createdBy: user.uid, 
          createdAt: new Date(),
          approvalStatus: 'confirmed',
          scope: 'private',
        })
      };

      if (type === 'expense') {
        // --- 新: 支出 ---
        transactionData.sourceAccountId = fromAccountId;
        transactionData.targetAccountId = deleteField(); // 以前の値が残らないように消す
        transactionData.categoryId = categoryId;
        transactionData.categoryName = categories.find(c => c.id === categoryId)?.name;

        // 残高: 出金元を減らす
        const sourceRef = doc(db, `users/${user.uid}/accounts`, fromAccountId);
        batch.update(sourceRef, { balance: increment(-valAmount) });

      } else if (type === 'income') {
        // --- 新: 収入 ---
        transactionData.sourceAccountId = deleteField(); // 消す
        transactionData.targetAccountId = fromAccountId; // UIの入金先
        transactionData.categoryId = categoryId;
        transactionData.categoryName = categories.find(c => c.id === categoryId)?.name;

        // 残高: 入金先を増やす
        const targetRef = doc(db, `users/${user.uid}/accounts`, fromAccountId);
        batch.update(targetRef, { balance: increment(valAmount) });

      } else {
        // --- 新: 振替・チャージ ---
        transactionData.sourceAccountId = fromAccountId;
        transactionData.targetAccountId = toAccountId;
        transactionData.categoryId = deleteField();
        transactionData.categoryName = '';

        // 残高: 出金元を減らす ＆ 入金先を増やす
        const sourceRef = doc(db, `users/${user.uid}/accounts`, fromAccountId);
        const targetRef = doc(db, `users/${user.uid}/accounts`, toAccountId);
        
        batch.update(sourceRef, { balance: increment(-valAmount) });
        batch.update(targetRef, { balance: increment(valAmount) });
      }

      // =========================================================
      // ステップ3: ドキュメントの保存（Commit）
      // =========================================================
      
      if (isEditMode) {
        batch.update(docRef, transactionData);
      } else {
        batch.set(docRef, transactionData);
      }

      batch.commit();
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

      {/* 保存ボタン */}
      <View style={{ marginTop: 30, marginBottom: 20 }}>
        <Button 
          title={isEditMode ? "修正内容を保存" : "保存する"} 
          onPress={handleSave} 
          color={colors.tint} 
        />
      </View>

      {/* 削除ボタン（編集モードのみ表示） */}
      {isEditMode && (
        <View style={{ marginBottom: 50 }}>
          <Button 
            title="この明細を削除" 
            onPress={handleDelete} 
            color={colors.error} 
          />
        </View>
      )}

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