import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  ScrollView, Alert, KeyboardAvoidingView, Platform, Keyboard, 
  TouchableWithoutFeedback, Image, ActivityIndicator, SafeAreaView, StatusBar 
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'; // updateDoc, deleteDoc 追加
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from '../../services/firebase/config';
import { useMasterData } from '../../store/MasterContext';
import { useThemeColor } from '../../hooks/useThemeColor';
import { TransactionType } from '../../types';

// アイコン定義
const ACCOUNT_ICONS: Record<string, any> = {
  cash: 'wallet', bank: 'business', credit_card: 'card', e_money: 'phone-portrait', investment: 'trending-up',
};

export default function InputScreen({ route, navigation }: any) {
  const { categories, accounts } = useMasterData();
  const colors = useThemeColor();

  // ★追加: 編集モードかどうか判定
  const editData = route.params?.transaction || null;
  const isEditMode = !!editData;

  // --- State ---
  const [type, setType] = useState<TransactionType>('expense');
  const [date, setDate] = useState(new Date());
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subCategory, setSubCategory] = useState<string | null>(null);
  const [fromAccountId, setFromAccountId] = useState<string | null>(null);
  const [toAccountId, setToAccountId] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // --- 初期化 (新規 or 編集) ---
  useEffect(() => {
    navigation.setOptions({
      title: isEditMode ? '編集' : '記帳', // ヘッダータイトル変更
    });

    if (isEditMode) {
      // 編集モード: データをセット
      setType(editData.type);
      setDate(new Date(editData.date)); // タイムスタンプ(数値)をDateに戻す
      setAmount(editData.amount.toString());
      setMemo(editData.memo || '');
      setImageUri(editData.imageUrl || null);
      setCategoryId(editData.categoryId || null);
      setSubCategory(editData.subCategory || null);
      
      // 口座のマッピング
      setFromAccountId(editData.sourceAccountId || null);
      setToAccountId(editData.targetAccountId || null);
      
    } else {
      // 新規モード: 口座の初期選択
      const validAccounts = accounts.filter(a => !a.isArchived);
      if (validAccounts.length > 0) {
        if (!fromAccountId) setFromAccountId(validAccounts[0].id);
      }
    }
  }, [editData, accounts]); // accounts依存は初期選択用

  const handleTypeChange = (newType: TransactionType) => { setType(newType); setCategoryId(null); setSubCategory(null); };
  const handleCategorySelect = (catId: string) => { if (categoryId !== catId) { setCategoryId(catId); setSubCategory(null); } };

  // 画像選択 (変更なし)
  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) { Alert.alert("エラー", "写真へのアクセス許可が必要です"); return; }
    Alert.alert("レシートを添付", "写真を選択してください", [
      { text: "キャンセル", style: "cancel" },
      { text: "カメラで撮影", onPress: async () => {
          const cameraPerm = await ImagePicker.requestCameraPermissionsAsync();
          if (!cameraPerm.granted) return;
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 5], quality: 0.3, exif: false,
          });
          if (!result.canceled) setImageUri(result.assets[0].uri);
      }},
      { text: "アルバムから選択", onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.3, exif: false,
          });
          if (!result.canceled) setImageUri(result.assets[0].uri);
      }}
    ]);
  };

  const uploadImageAsync = async (uri: string) => {
    // 既にURL(https〜)ならアップロード不要
    if (uri.startsWith('http')) return uri;

    const blob: any = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = function () { resolve(xhr.response); };
      xhr.onerror = function (e) { reject(new TypeError("Network request failed")); };
      xhr.responseType = "blob";
      xhr.open("GET", uri, true);
      xhr.send(null);
    });
    const filename = `receipts/${auth.currentUser?.uid}/${Date.now()}.jpg`;
    const storageRef = ref(storage, filename);
    await uploadBytes(storageRef, blob);
    blob.close();
    return await getDownloadURL(storageRef);
  };

  // 削除処理 ★追加
  const handleDelete = async () => {
    Alert.alert("削除の確認", "本当にこのデータを削除しますか？", [
      { text: "キャンセル", style: "cancel" },
      { text: "削除する", style: "destructive", onPress: async () => {
          if (!auth.currentUser || !isEditMode) return;
          try {
             setUploading(true);
             await deleteDoc(doc(db, `users/${auth.currentUser.uid}/transactions`, editData.id));
             Alert.alert("完了", "削除しました");
             navigation.goBack();
          } catch(e) {
             Alert.alert("エラー", "削除できませんでした");
             setUploading(false);
          }
      }}
    ]);
  };

  const handleSave = async () => {
    if (!amount) { Alert.alert("エラー", "金額を入力してください"); return; }
    const valAmount = parseInt(amount);
    if (isNaN(valAmount)) { Alert.alert("エラー", "金額は半角数字で"); return; }
    if (!fromAccountId) { Alert.alert("エラー", type === 'income' ? "入金先を選んでください" : "出金元を選んでください"); return; }
    if (type === 'transfer' && !toAccountId) { Alert.alert("エラー", "振替先の口座を選んでください"); return; }
    if (type === 'transfer' && fromAccountId === toAccountId) { Alert.alert("エラー", "出金元と入金先が同じです"); return; }

    // 日付チェック（省略可だが残す）
    const checkAccountDate = (accId: string, label: string) => {
      const acc = accounts.find(a => a.id === accId);
      if (!acc || !acc.startDate) return true;
      const transDate = new Date(date);
      transDate.setHours(0, 0, 0, 0);
      const accStart = acc.startDate instanceof Date ? acc.startDate : (acc.startDate as any).toDate();
      accStart.setHours(0, 0, 0, 0);
      if (transDate < accStart) {
        Alert.alert('日付エラー', `口座「${acc.name}」(${label})の利用開始日は ${accStart.toLocaleDateString()} です。\nそれより前の日付では記録できません。`);
        return false;
      }
      return true;
    };
    if (!checkAccountDate(fromAccountId, type === 'income' ? '入金先' : '出金元')) return;
    if (type === 'transfer' && toAccountId && !checkAccountDate(toAccountId, '振替先')) return;

    const user = auth.currentUser;
    if (!user) return;

    try {
      setUploading(true);
      let downloadUrl = null;
      if (imageUri) downloadUrl = await uploadImageAsync(imageUri);
      
      const selectedCat = categories.find(c => c.id === categoryId);
      
      const saveData = {
        type, date: date, amount: valAmount, memo: memo.trim(),
        categoryId: categoryId || null, categoryName: selectedCat ? selectedCat.name : null, subCategory: subCategory || null,
        sourceAccountId: fromAccountId, targetAccountId: type === 'transfer' ? toAccountId : null,
        imageUrl: downloadUrl,
        scope: 'private',
        // 作成者情報は更新しない、updatedAtのみ更新
        updatedAt: serverTimestamp(),
      };

      if (isEditMode) {
        // --- 更新 ---
        await updateDoc(doc(db, `users/${user.uid}/transactions`, editData.id), saveData);
        Alert.alert("完了", "更新しました");
        navigation.goBack(); // 前の画面に戻る
      } else {
        // --- 新規作成 ---
        await addDoc(collection(db, `users/${user.uid}/transactions`), {
          ...saveData,
          createdBy: user.uid, approvalStatus: 'confirmed', fundingSource: 'private_fund',
          createdAt: serverTimestamp(),
        });
        // 連続入力のためにリセット
        setAmount(''); setMemo(''); setImageUri(null);
        Alert.alert("完了", "保存しました");
      }

    } catch (error) { console.error(error); Alert.alert("エラー", "保存に失敗しました");
    } finally { setUploading(false); }
  };

  // --- UI Parts (変更なし) ---
  const activeAccounts = accounts.filter(acc => !acc.isArchived || acc.id === fromAccountId || acc.id === toAccountId);
  const currentCategory = categories.find(c => c.id === categoryId);
  const subCategories = currentCategory?.subCategories || [];
  const visibleCategories = categories.filter(c => c.type === (type === 'transfer' ? 'expense' : type)).sort((a, b) => (a.order || 0) - (b.order || 0));

  const AccountSelector = ({ selectedId, onSelect, label }: any) => (
    <View style={{ marginBottom: 15 }}>
      <Text style={[styles.sectionTitle, { color: colors.textSub }]}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, paddingHorizontal: 20 }}>
        {activeAccounts.map(acc => {
          const isSelected = selectedId === acc.id;
          return (
            <TouchableOpacity key={acc.id} onPress={() => onSelect(acc.id)}
              style={[styles.accountChip, { backgroundColor: isSelected ? colors.tint : colors.card, borderColor: isSelected ? colors.tint : colors.border }]}>
              <Ionicons name={ACCOUNT_ICONS[acc.type] || 'help'} size={20} color={isSelected ? 'white' : colors.text} />
              <Text style={[styles.accountName, { color: isSelected ? 'white' : colors.text }]}>{acc.name}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingBottom: 100 }}>
            
            {/* 1. タブ (新規時のみ変更可能にしてもいいが、あえて変更可能にする) */}
            <View style={styles.tabContainer}>
              {(['expense', 'income', 'transfer'] as TransactionType[]).map((t) => (
                <TouchableOpacity key={t} style={[styles.tab, type === t && { backgroundColor: t === 'expense' ? '#FF6384' : t === 'income' ? '#36A2EB' : '#4BC0C0' }]} onPress={() => handleTypeChange(t)}>
                  <Text style={[styles.tabText, type === t && { color: 'white', fontWeight: 'bold' }]}>{t === 'expense' ? '支出' : t === 'income' ? '収入' : '振替'}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ padding: 20 }}>
              {/* 2. 日付と金額 */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
                <TouchableOpacity style={[styles.dateBox, { borderColor: colors.border, backgroundColor: colors.card }]} onPress={() => setShowDatePicker(true)}>
                  <Ionicons name="calendar" size={20} color={colors.textSub} />
                  <Text style={{ marginLeft: 8, color: colors.text, fontSize: 16 }}>{date.toLocaleDateString()}</Text>
                </TouchableOpacity>
                <View style={[styles.amountBox, { borderColor: colors.border, backgroundColor: colors.card }]}>
                  <Text style={{ fontSize: 18, color: colors.text }}>¥</Text>
                  <TextInput style={[styles.amountInput, { color: colors.text }]} value={amount} onChangeText={setAmount} placeholder="0" keyboardType="number-pad" placeholderTextColor={colors.textSub} textAlign="right" />
                </View>
              </View>
              {showDatePicker && (<DateTimePicker value={date} mode="date" display="default" onChange={(e, d) => { setShowDatePicker(false); if (d) setDate(d); }} />)}

              {/* 3. 口座選択 */}
              {type === 'transfer' ? (
                <>
                  <AccountSelector label="出金元" selectedId={fromAccountId} onSelect={setFromAccountId} />
                  <View style={{ alignItems: 'center', marginVertical: -10, zIndex: 10 }}><Ionicons name="arrow-down-circle" size={24} color={colors.textSub} /></View>
                  <AccountSelector label="入金先" selectedId={toAccountId} onSelect={setToAccountId} />
                </>
              ) : (
                <AccountSelector label={type === 'income' ? "入金先" : "支払い口座"} selectedId={fromAccountId} onSelect={setFromAccountId} />
              )}

              {/* 4. カテゴリ選択 */}
              {type !== 'transfer' && (
                <View style={{ marginBottom: 20 }}>
                  <Text style={[styles.sectionTitle, { color: colors.textSub }]}>カテゴリ</Text>
                  <View style={styles.categoryGrid}>
                    {visibleCategories.map(cat => (
                      <TouchableOpacity key={cat.id} onPress={() => handleCategorySelect(cat.id)}
                        style={[styles.categoryItem, { borderColor: categoryId === cat.id ? (cat.color || colors.tint) : colors.border, backgroundColor: categoryId === cat.id ? (cat.color || colors.tint) : colors.card }]}>
                        <Ionicons name={cat.icon as any || 'pricetag'} size={24} color={categoryId === cat.id ? 'white' : (cat.color || colors.text)} />
                        <Text style={[styles.categoryName, { color: categoryId === cat.id ? 'white' : colors.text }, { fontSize: cat.name.length > 5 ? 10 : 12 }]} numberOfLines={1}>{cat.name}</Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity style={[styles.categoryItem, { borderColor: colors.border, borderStyle: 'dashed' }]} onPress={() => Alert.alert('設定へ', '設定画面から科目を追加できます')}>
                      <Ionicons name="add" size={24} color={colors.textSub} />
                    </TouchableOpacity>
                  </View>
                  {/* 小科目 */}
                  {categoryId && subCategories.length > 0 && (
                    <View style={[styles.subCategoryContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Text style={{ fontSize: 12, color: colors.textSub, marginBottom: 8 }}>詳細</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                        {subCategories.map((sub, idx) => (
                          <TouchableOpacity key={idx} onPress={() => setSubCategory(subCategory === sub ? null : sub)}
                            style={[styles.subCategoryChip, { backgroundColor: subCategory === sub ? colors.tint : colors.background, borderColor: subCategory === sub ? colors.tint : colors.border }]}>
                            <Text style={{ color: subCategory === sub ? 'white' : colors.text, fontSize: 13 }}>{sub}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* 5. メモ・レシート写真 */}
              <Text style={[styles.sectionTitle, { color: colors.textSub }]}>メモ・レシート</Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <TextInput style={[styles.memoInput, { flex: 1, color: colors.text, borderColor: colors.border, backgroundColor: colors.card, marginRight: 10 }]} value={memo} onChangeText={setMemo} placeholder="内容を入力..." placeholderTextColor={colors.textSub} />
                <TouchableOpacity style={[styles.cameraButton, { backgroundColor: imageUri ? colors.tint : colors.card, borderColor: colors.border }]} onPress={pickImage}>
                  <Ionicons name="camera" size={24} color={imageUri ? 'white' : colors.textSub} />
                </TouchableOpacity>
              </View>
              {imageUri && (
                <View style={{ marginBottom: 20, alignItems: 'center' }}>
                  <Image source={{ uri: imageUri }} style={{ width: 200, height: 200, borderRadius: 10 }} resizeMode="cover" />
                  <TouchableOpacity onPress={() => setImageUri(null)} style={{ position: 'absolute', top: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 15 }}>
                    <Ionicons name="close-circle" size={30} color="white" />
                  </TouchableOpacity>
                </View>
              )}

              {/* 6. 保存ボタン (削除ボタンも追加) */}
              <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.tint, opacity: uploading ? 0.6 : 1 }]} onPress={handleSave} disabled={uploading}>
                {uploading ? (<ActivityIndicator color="white" />) : (<Text style={styles.saveButtonText}>{isEditMode ? '更新する' : '記録する'}</Text>)}
              </TouchableOpacity>

              {/* ★追加: 編集モードなら削除ボタンを表示 */}
              {isEditMode && (
                <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.error, marginTop: 15, opacity: uploading ? 0.6 : 1 }]} onPress={handleDelete} disabled={uploading}>
                  <Text style={styles.saveButtonText}>この記録を削除</Text>
                </TouchableOpacity>
              )}

            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  container: { flex: 1 },
  // ... (スタイルは以前と同じ)
  tabContainer: { flexDirection: 'row', marginTop: 10, marginHorizontal: 20, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#ddd' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: '#eee' },
  tabText: { color: '#666', fontSize: 14 },
  dateBox: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, padding: 12, marginRight: 10 },
  amountBox: { flex: 1.5, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, paddingHorizontal: 10 },
  amountInput: { flex: 1, fontSize: 20, fontWeight: 'bold', height: 50 },
  sectionTitle: { fontSize: 12, fontWeight: 'bold', marginBottom: 8 },
  accountChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginRight: 8 },
  accountName: { marginLeft: 5, fontSize: 14, fontWeight: '600' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', marginHorizontal: -5 },
  categoryItem: { width: '22%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', margin: '1.5%', borderRadius: 12, borderWidth: 1 },
  categoryName: { marginTop: 4, fontWeight: '600', textAlign: 'center' },
  subCategoryContainer: { marginTop: 10, padding: 10, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed' },
  subCategoryChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, marginRight: 8, marginBottom: 8 },
  memoInput: { height: 50, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, fontSize: 16, marginBottom: 20 },
  cameraButton: { width: 50, height: 50, borderRadius: 8, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  saveButton: { paddingVertical: 15, borderRadius: 30, alignItems: 'center', shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3 },
  saveButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
});