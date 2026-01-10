import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, 
  Modal, KeyboardAvoidingView, Platform, ScrollView 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../services/firebase/config';
import { useMasterData } from '../../store/MasterContext';
import { useThemeColor } from '../../hooks/useThemeColor';
import { Account } from '../../types';

// 口座種別の定義
const ACCOUNT_TYPES = [
  { type: 'cash', label: '現金', icon: 'wallet' },
  { type: 'bank', label: '銀行', icon: 'business' },
  { type: 'credit_card', label: 'カード', icon: 'card' },
  { type: 'e_money', label: '電子マネー', icon: 'phone-portrait' },
] as const;

export default function AccountManageScreen() {
  const { accounts } = useMasterData();
  const colors = useThemeColor();

  // --- State ---
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  // 入力用の一時ステート
  const [tempName, setTempName] = useState('');
  const [tempType, setTempType] = useState<Account['type']>('cash');
  const [tempBalance, setTempBalance] = useState(''); 

  // クレジットカード用のState
  const [tempClosingDay, setTempClosingDay] = useState(''); 
  const [tempPaymentDay, setTempPaymentDay] = useState(''); 

  // 利用開始日
  const [tempStartDate, setTempStartDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // --- アクション ---

  // 新規作成
  const openNewModal = () => {
    setEditingAccount(null);
    setTempName('');
    setTempType('cash');
    setTempBalance('');
    setTempClosingDay('');
    setTempPaymentDay('');
    setTempStartDate(new Date());
    setModalVisible(true);
  };

  // 編集
  const openEditModal = (acc: Account) => {
    setEditingAccount(acc);
    setTempName(acc.name);
    setTempType(acc.type);
    setTempBalance(acc.balance.toString());

    // ★修正: 0やnullを安全に文字列化してセット
    // (nullやundefinedなら空文字、数値なら文字列に変換)
    setTempClosingDay(acc.closingDay != null ? acc.closingDay.toString() : '');
    setTempPaymentDay(acc.paymentDay != null ? acc.paymentDay.toString() : '');

    if (acc.startDate) {
      // FirestoreのTimestamp -> Date変換が必要な場合の考慮
      const d = acc.startDate instanceof Date ? acc.startDate : (acc.startDate as any).toDate();
      setTempStartDate(d);
    } else {
      setTempStartDate(new Date());
    }

    setModalVisible(true);
  };

  // 保存処理
  const handleSave = async () => {
    // 1. 基本チェック
    if (!tempName.trim()) {
      Alert.alert('エラー', '口座名を入力してください');
      return;
    }

    const balanceVal = parseInt(tempBalance) || 0;
    
    // 2. カード固有のバリデーション (ここを追加！)
    let closingDayVal: number | null = null;
    let paymentDayVal: number | null = null;

    if (tempType === 'credit_card') {
      // 数値変換（空文字ならnull）
      closingDayVal = tempClosingDay ? parseInt(tempClosingDay) : null;
      paymentDayVal = tempPaymentDay ? parseInt(tempPaymentDay) : null;

      // --- 締め日チェック ---
      if (closingDayVal !== null) {
        // 1〜31以外、かつ 99(末日)以外はエラー
        const isValidDay = (closingDayVal >= 1 && closingDayVal <= 31);
        const isEndMonth = closingDayVal === 99;
        
        if (!isValidDay && !isEndMonth) {
          Alert.alert('入力エラー', '締め日は 1〜31 または 99(月末) で入力してください');
          return; // 処理中断
        }
      }

      // --- 支払日チェック ---
      if (paymentDayVal !== null) {
        // 1〜31以外はエラー
        if (paymentDayVal < 1 || paymentDayVal > 31) {
          Alert.alert('入力エラー', '支払日は 1〜31 の範囲で入力してください');
          return; // 処理中断
        }
      }
    }

    if (!auth.currentUser) return;

    try {
      const dataToSave = {
        name: tempName.trim(),
        type: tempType,
        balance: balanceVal,
        // カード以外はnullで上書きして消す
        closingDay: tempType === 'credit_card' ? closingDayVal : null,
        paymentDay: tempType === 'credit_card' ? paymentDayVal : null,
        // isArchived は既存の値を維持したいが、新規ならfalse
        // ここでは updateDoc なので指定しなければ維持されるが、addDoc時は指定が必要
        // 下記の分岐で対応

        startDate: tempStartDate,
      };

      if (editingAccount) {
        // --- 更新 ---
        const ref = doc(db, `users/${auth.currentUser.uid}/accounts`, editingAccount.id);
        await updateDoc(ref, dataToSave);
      } else {
        // --- 新規 ---
        await addDoc(collection(db, `users/${auth.currentUser.uid}/accounts`), {
          ...dataToSave,
          scope: 'private',
          currency: 'JPY',
          isArchived: false,
          createdAt: serverTimestamp()
        });
      }
      setModalVisible(false);
    } catch (e) {
      console.error(e);
      Alert.alert('エラー', '保存に失敗しました');
    }
  };

  // 日付変更ハンドラ
  const onDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (selectedDate) {
      setTempStartDate(selectedDate);
    }
  };

  // アーカイブ切り替え
  const handleArchive = () => {
    if (!editingAccount) return;

    const newStatus = !editingAccount.isArchived;
    const actionName = newStatus ? '使用停止' : '再開';
    
    const message = newStatus 
      ? `「${editingAccount.name}」を${actionName}しますか？\n（データは削除されませんが、入力時の選択肢に出なくなります）`
      : `「${editingAccount.name}」を${actionName}しますか？\n（入力時の選択肢に再び表示されるようになります）`;

    Alert.alert(
      `口座の${actionName}`,
      message,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: actionName,
          style: newStatus ? 'destructive' : 'default',
          onPress: async () => {
            if (!auth.currentUser || !editingAccount) return;
            try {
              const ref = doc(db, `users/${auth.currentUser.uid}/accounts`, editingAccount.id);
              await updateDoc(ref, {
                isArchived: newStatus
              });
              setModalVisible(false);
            } catch (e) {
              Alert.alert('エラー', '更新できませんでした');
            }
          }
        }
      ]
    );
  };

  // ヘルパー関数
  const getIconByType = (type: string) => {
    const found = ACCOUNT_TYPES.find(t => t.type === type);
    return found ? found.icon : 'help';
  };

  const getLabelByType = (type: string) => {
    const found = ACCOUNT_TYPES.find(t => t.type === type);
    return found ? found.label : '不明';
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      
      {/* 口座リスト */}
      <FlatList
        data={accounts}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={[
              styles.item, 
              { borderBottomColor: colors.border },
              item.isArchived && { backgroundColor: colors.background, opacity: 0.6 }
            ]}
            onPress={() => openEditModal(item)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.iconBox, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
                <Ionicons name={getIconByType(item.type) as any} size={20} color={colors.text} />
              </View>
              <View>
                <Text style={[
                  styles.itemText, 
                  { color: colors.text },
                  item.isArchived && { textDecorationLine: 'line-through', color: colors.textSub }
                ]}>
                  {item.name}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSub, marginLeft: 10 }}>
                  {getLabelByType(item.type)} ・ ¥{item.balance.toLocaleString()}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSub} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={{ padding: 20, color: colors.textSub }}>口座が登録されていません</Text>}
      />

      {/* FAB */}
      <TouchableOpacity 
        style={[styles.fab, { backgroundColor: colors.tint }]} 
        onPress={openNewModal}
      >
        <Ionicons name="add" size={30} color="white" />
      </TouchableOpacity>

      {/* 編集モーダル */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={{ color: colors.textSub, fontSize: 16 }}>キャンセル</Text>
              </TouchableOpacity>
              <Text style={{ fontWeight: 'bold', fontSize: 18, color: colors.text }}>
                {editingAccount ? '口座の編集' : '新規口座'}
              </Text>
              <TouchableOpacity onPress={handleSave}>
                <Text style={{ color: colors.tint, fontWeight: 'bold', fontSize: 16 }}>保存</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20 }}>

              {/* 1. 口座種別選択 */}
              <Text style={[styles.label, { color: colors.textSub }]}>種類</Text>
              <View style={styles.typeGrid}>
                {ACCOUNT_TYPES.map((item) => (
                  <TouchableOpacity
                    key={item.type}
                    style={[
                      styles.typeBtn,
                      { 
                        borderColor: tempType === item.type ? colors.tint : colors.border,
                        backgroundColor: tempType === item.type ? colors.tint : colors.background 
                      }
                    ]}
                    onPress={() => setTempType(item.type as any)}
                  >
                    <Ionicons 
                      name={item.icon as any} 
                      size={24} 
                      color={tempType === item.type ? 'white' : colors.text} 
                      style={{ marginBottom: 5 }}
                    />
                    <Text style={[
                      styles.typeText, 
                      { color: tempType === item.type ? 'white' : colors.text }
                    ]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* 2. 口座名入力 */}
              <Text style={[styles.label, { color: colors.textSub }]}>口座名</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                value={tempName}
                onChangeText={setTempName}
                placeholder="例: メイン銀行、PayPayなど"
                placeholderTextColor={colors.textSub}
              />

              {/* 3. 現在残高と開始日 */}
              <Text style={[styles.label, { color: colors.textSub }]}>
                {tempType === 'credit_card' ? '現在の未払金（利用額）' : '現在の残高'}
              </Text>
              
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                {/* 金額入力エリア */}
                <View style={{ width: '48%' }}>
                  <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
                    <Text style={{ fontSize: 18, marginRight: 5, color: colors.text }}>
                       {tempType === 'credit_card' ? '-' : ''}¥
                    </Text>
                    <TextInput
                      style={[styles.inputNoBorder, { color: colors.text }]}
                      value={tempBalance}
                      onChangeText={setTempBalance}
                      placeholder="0"
                      placeholderTextColor={colors.textSub}
                      keyboardType="number-pad"
                      textAlign="right"
                    />
                  </View>
                </View>
                
                {/* 開始日選択エリア */}
                <View style={{ width: '48%' }}>
                  <TouchableOpacity 
                    style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.background, justifyContent: 'center' }]}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Text style={{ color: colors.text, fontSize: 16 }}>
                      {tempStartDate.toLocaleDateString()}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* DatePicker (モーダルやプラットフォームに応じた表示) */}
              {showDatePicker && Platform.OS === 'android' && (
                <DateTimePicker
                  value={tempStartDate}
                  mode="date"
                  display="default"
                  onChange={onDateChange}
                />
              )}
              {/* iOSの場合はインライン表示やモーダル表示など調整が必要ですが、
                  ここでは簡易的に条件付き表示にします */}
              {Platform.OS === 'ios' && showDatePicker && (
                 <View style={{ alignItems: 'center', marginBottom: 20 }}>
                   <DateTimePicker
                     value={tempStartDate}
                     mode="date"
                     display="inline"
                     onChange={onDateChange}
                     style={{ width: 320 }} 
                   />
                   <TouchableOpacity onPress={() => setShowDatePicker(false)} style={{ padding: 10 }}>
                     <Text style={{ color: colors.tint }}>完了</Text>
                   </TouchableOpacity>
                 </View>
              )}

              <Text style={{ fontSize: 12, color: colors.textSub, marginBottom: 20, marginTop: 5 }}>
                ※右側の日付時点での残高を入力してください。
              </Text>

              {/* 4. カード設定（カード選択時のみ） */}
              {tempType === 'credit_card' && (
                <View style={{ backgroundColor: colors.card, padding: 15, borderRadius: 10, marginBottom: 20, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ fontWeight: 'bold', color: colors.text, marginBottom: 10 }}>クレジットカード設定</Text>
                  
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    {/* 締め日 */}
                    <View style={{ width: '48%' }}>
                      <Text style={[styles.label, { color: colors.textSub, marginTop: 0 }]}>締め日</Text>
                      <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.background, marginBottom: 0 }]}>
                        <TextInput
                          style={[styles.inputNoBorder, { color: colors.text }]}
                          value={tempClosingDay}
                          onChangeText={setTempClosingDay}
                          placeholder="例: 15"
                          placeholderTextColor={colors.textSub}
                          keyboardType="number-pad"
                          maxLength={2}
                          textAlign="right"
                        />
                        <Text style={{ color: colors.text }}>日</Text>
                      </View>
                      <Text style={{ fontSize: 10, color: colors.textSub, marginTop: 4 }}>※月末は99</Text>
                    </View>

                    {/* 支払日 */}
                    <View style={{ width: '48%' }}>
                      <Text style={[styles.label, { color: colors.textSub, marginTop: 0 }]}>引き落とし日</Text>
                      <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.background, marginBottom: 0 }]}>
                        <TextInput
                          style={[styles.inputNoBorder, { color: colors.text }]}
                          value={tempPaymentDay}
                          onChangeText={setTempPaymentDay}
                          placeholder="例: 10"
                          placeholderTextColor={colors.textSub}
                          keyboardType="number-pad"
                          maxLength={2}
                          textAlign="right"
                        />
                        <Text style={{ color: colors.text }}>日</Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {/* 使用停止/再開ボタン */}
              {editingAccount && (
                <TouchableOpacity 
                  onPress={handleArchive} 
                  style={{ marginTop: 20, alignItems: 'center', marginBottom: 50 }}
                >
                  <Text style={{ 
                    color: editingAccount.isArchived ? colors.tint : colors.error, 
                    fontSize: 16, fontWeight: 'bold' 
                  }}>
                    {editingAccount.isArchived ? 'この口座を再開する' : 'この口座を使用停止にする'}
                  </Text>
                  {!editingAccount.isArchived && (
                    <Text style={{ fontSize: 12, color: colors.textSub, marginTop: 5 }}>
                      ※過去のデータは残ります
                    </Text>
                  )}
                </TouchableOpacity>
              )}

            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 0.5 },
  itemText: { fontSize: 16, marginLeft: 10, fontWeight: '500' },
  iconBox: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  
  fab: { 
    position: 'absolute', bottom: 30, right: 30, 
    width: 56, height: 56, borderRadius: 28, 
    justifyContent: 'center', alignItems: 'center',
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5
  },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { 
    borderTopLeftRadius: 20, borderTopRightRadius: 20, 
    height: '80%', 
    paddingBottom: 40 
  },
  modalHeader: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    padding: 15, borderBottomWidth: 0.5, borderBottomColor: '#ccc' 
  },

  label: { fontSize: 14, marginBottom: 8, fontWeight: 'bold', marginTop: 10 },
  input: { height: 44, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, marginBottom: 10 },
  
  inputRow: { 
    flexDirection: 'row', alignItems: 'center', 
    height: 44, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, marginBottom: 5 
  },
  inputNoBorder: { flex: 1, height: '100%', fontSize: 18, fontWeight: 'bold' },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 },
  typeBtn: { 
    width: '48%', 
    paddingVertical: 15, 
    borderWidth: 1, borderRadius: 10, 
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 10
  },
  typeText: { fontSize: 14, fontWeight: 'bold' },
});