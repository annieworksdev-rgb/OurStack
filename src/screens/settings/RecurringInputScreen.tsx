import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, 
  KeyboardAvoidingView, Platform, SafeAreaView 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../services/firebase/config';
import { useMasterData } from '../../store/MasterContext';
import { useThemeColor } from '../../hooks/useThemeColor';

export default function RecurringInputScreen({ route, navigation }: any) {
  const { categories, accounts, currentBookId } = useMasterData();
  const colors = useThemeColor();
  const editData = route.params?.setting || null;
  const isEditMode = !!editData;

  // State
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subCategory, setSubCategory] = useState<string | null>(null);
  const [sourceAccountId, setSourceAccountId] = useState<string | null>(null);
  const [frequency, setFrequency] = useState('monthly');
  const [day, setDay] = useState('25');
  const [endDate, setEndDate] = useState<Date | null>(null); // nullなら無期限
  const [holidayAction, setHolidayAction] = useState('none');
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  // 初期値セット
  useEffect(() => {
    navigation.setOptions({ title: isEditMode ? '設定の編集' : '繰り返し作成' });
    if (isEditMode) {
      setAmount(editData.amount.toString());
      setCategoryId(editData.categoryId);
      setSubCategory(editData.subCategory);
      setSourceAccountId(editData.sourceAccountId);
      setFrequency(editData.frequency);
      setDay(editData.day.toString());
      setHolidayAction(editData.holidayAction || 'none');
      if (editData.endDate) setEndDate(editData.endDate.toDate());
    }
  }, [editData]);

  // 保存処理
  const handleSave = async () => {
    if (!amount || !categoryId || !sourceAccountId || !day) {
      Alert.alert('エラー', '必須項目を入力してください');
      return;
    }
    const valAmount = parseInt(amount);
    const valDay = parseInt(day);
    if (valDay < 1 || valDay > 31) {
      Alert.alert('エラー', '日付は1〜31の間で指定してください');
      return;
    }

    const user = auth.currentUser;
    if (!user) return;
    setSaving(true);

    try {
      const saveData = {
        amount: valAmount,
        categoryId,
        subCategory: subCategory || null,
        sourceAccountId,
        frequency,
        day: valDay,
        endDate: endDate ? endDate : null,
        holidayAction,
        updatedAt: serverTimestamp(),
      };

      if (isEditMode) {
        await updateDoc(doc(db, `books/${currentBookId}/recurring`, editData.id), saveData);
      }else {
        // 新規作成時は nextDueDate（次回予定日）を計算して入れる必要があるが、
        // いったん「今日の次の該当日」を後でバッチ処理させるか、簡易的に今日を入れる。
        // ここでは単純に保存し、実行ロジック側で判断させる
        await addDoc(collection(db, `books/${currentBookId}/recurring`), {
          ...saveData,
          createdAt: serverTimestamp(),
          nextDueDate: null // 初回はnullにしておき、ロジック側で「未設定なら計算」させる手もある
        });
      }
      navigation.goBack();
    } catch (e) {
      console.error(e);
      Alert.alert('エラー', '保存できませんでした');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!isEditMode || !auth.currentUser) return;
    Alert.alert('削除', 'この設定を削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: async () => {
          await deleteDoc(doc(db, `books/${currentBookId}/recurring`, editData.id));
          navigation.goBack();
      }}
    ]);
  };

  // UIヘルパー
  const SelectionRow = ({ label, value, onPress }: any) => (
    <TouchableOpacity style={[styles.row, { borderBottomColor: colors.border }]} onPress={onPress}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ color: value ? colors.text : colors.textSub, marginRight: 5 }}>{value || '選択してください'}</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textSub} />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          
          {/* 金額 */}
          <View style={[styles.inputGroup, { backgroundColor: colors.card }]}>
            <Text style={[styles.label, { color: colors.textSub, marginBottom: 5 }]}>金額</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TextInput
                style={[styles.amountInput, { color: colors.text }]}
                value={amount}
                onChangeText={setAmount}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.textSub}
              />
              <Text style={{ fontSize: 18, color: colors.text }}>円</Text>
            </View>
          </View>

          {/* 詳細設定 */}
          <View style={[styles.inputGroup, { backgroundColor: colors.card, paddingVertical: 0 }]}>
            {/* 科目選択 (簡易実装: PickerやModalが望ましいが、今回はSelectをタップでAlert代用または簡易Select) */}
            {/* ※本来はきちんとしたModalSelectorを作るべきですが、コード量削減のため簡易表示にします */}
            <View style={{ padding: 15 }}>
               <Text style={[styles.label, { color: colors.textSub }]}>科目 (タップして選択)</Text>
               <ScrollView horizontal style={{ marginTop: 10 }}>
                 {categories.filter(c => c.type === 'expense').map(c => (
                   <TouchableOpacity key={c.id} onPress={() => setCategoryId(c.id)} 
                     style={[styles.chip, categoryId === c.id && { backgroundColor: colors.tint, borderColor: colors.tint }]}>
                     <Text style={categoryId === c.id ? {color:'white'} : {color:colors.text}}>{c.name}</Text>
                   </TouchableOpacity>
                 ))}
               </ScrollView>
            </View>
            <View style={{ height: 1, backgroundColor: colors.border }} />

            <View style={{ padding: 15 }}>
               <Text style={[styles.label, { color: colors.textSub }]}>出金元口座</Text>
               <ScrollView horizontal style={{ marginTop: 10 }}>
                 {accounts.filter(a => !a.isArchived).map(a => (
                   <TouchableOpacity key={a.id} onPress={() => setSourceAccountId(a.id)} 
                     style={[styles.chip, sourceAccountId === a.id && { backgroundColor: colors.tint, borderColor: colors.tint }]}>
                     <Text style={sourceAccountId === a.id ? {color:'white'} : {color:colors.text}}>{a.name}</Text>
                   </TouchableOpacity>
                 ))}
               </ScrollView>
            </View>
          </View>

          {/* サイクル設定 */}
          <View style={[styles.inputGroup, { backgroundColor: colors.card, paddingVertical: 0 }]}>
            
            {/* 頻度 */}
            <View style={{ padding: 15 }}>
               <Text style={[styles.label, { color: colors.textSub }]}>頻度</Text>
               <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
                 {['monthly:毎月','2months:2ヶ月','6months:半年','yearly:毎年'].map(f => {
                   const [key, label] = f.split(':');
                   return (
                    <TouchableOpacity key={key} onPress={() => setFrequency(key)} 
                      style={[styles.chip, frequency === key && { backgroundColor: colors.tint, borderColor: colors.tint }]}>
                      <Text style={frequency === key ? {color:'white'} : {color:colors.text}}>{label}</Text>
                    </TouchableOpacity>
                   );
                 })}
               </View>
            </View>
            <View style={{ height: 1, backgroundColor: colors.border }} />

            {/* 入力日 */}
            <View style={[styles.row, { borderBottomColor: colors.border }]}>
               <Text style={[styles.label, { color: colors.text }]}>毎月の入力日</Text>
               <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                 <TextInput 
                   value={day} onChangeText={setDay} keyboardType="number-pad" 
                   style={{ fontSize: 16, color: colors.text, textAlign: 'right', width: 50, marginRight: 5 }} 
                 />
                 <Text style={{ color: colors.text }}>日</Text>
               </View>
            </View>
            
            {/* 休日設定 */}
            <View style={{ padding: 15 }}>
               <Text style={[styles.label, { color: colors.textSub }]}>休日の場合</Text>
               <View style={{ flexDirection: 'row', marginTop: 10 }}>
                 {['none:そのまま','before:前倒し','after:後倒し'].map(h => {
                   const [key, label] = h.split(':');
                   return (
                    <TouchableOpacity key={key} onPress={() => setHolidayAction(key)} 
                      style={[styles.chip, holidayAction === key && { backgroundColor: colors.tint, borderColor: colors.tint }]}>
                      <Text style={holidayAction === key ? {color:'white'} : {color:colors.text}}>{label}</Text>
                    </TouchableOpacity>
                   );
                 })}
               </View>
            </View>

            {/* 終了日 */}
             <SelectionRow 
               label="終了年月 (未設定なら無期限)" 
               value={endDate ? endDate.toLocaleDateString() : '設定なし'} 
               onPress={() => setShowEndDatePicker(true)} 
             />
             {showEndDatePicker && (
               <DateTimePicker 
                 value={endDate || new Date()} mode="date" display="default"
                 onChange={(e, d) => { setShowEndDatePicker(false); if(d) setEndDate(d); }} 
               />
             )}
          </View>

          {/* 保存ボタン */}
          <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.tint }]} onPress={handleSave} disabled={saving}>
             <Text style={styles.saveButtonText}>{isEditMode ? '更新する' : '設定を保存'}</Text>
          </TouchableOpacity>
          
          {isEditMode && (
            <TouchableOpacity style={{ marginTop: 20, alignItems: 'center' }} onPress={handleDelete}>
              <Text style={{ color: colors.error }}>この設定を削除</Text>
            </TouchableOpacity>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  inputGroup: { borderRadius: 12, marginBottom: 20, padding: 15, overflow: 'hidden' },
  label: { fontSize: 14, fontWeight: '600' },
  amountInput: { fontSize: 24, fontWeight: 'bold', flex: 1, paddingRight: 10, textAlign: 'right' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#ddd', marginRight: 8, marginBottom: 8 },
  saveButton: { paddingVertical: 15, borderRadius: 30, alignItems: 'center', marginTop: 10 },
  saveButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
});