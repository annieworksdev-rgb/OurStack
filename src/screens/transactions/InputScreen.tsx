import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ScrollView } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db, auth } from '../../services/firebase/config';
import { useMasterData } from '../../store/MasterContext';
import { Transaction } from '../../types';
import { useNavigation } from '@react-navigation/native';

export default function InputScreen() {
  const navigation = useNavigation();
  const { categories, accounts } = useMasterData(); // マスタ取得

  // Form State
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [selectedAccId, setSelectedAccId] = useState<string>('');

  // データがロードされたら、自動的に先頭のアイテムを選択状態にする
  useEffect(() => {
    if (categories.length > 0 && !selectedCatId) {
      setSelectedCatId(categories[0].id);
    }
  }, [categories]); // categoriesが変わるたびにチェック

  useEffect(() => {
    if (accounts.length > 0 && !selectedAccId) {
      setSelectedAccId(accounts[0].id);
    }
  }, [accounts]);
  
  const handleSave = async () => {
    if (!amount || !selectedCatId || !selectedAccId) {
      Alert.alert("エラー", "金額、科目、口座は必須です");
      return;
    }

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("No user");

      // 選択されたCategoryオブジェクトを探す（名前などを保存するため）
      const category = categories.find(c => c.id === selectedCatId);

      const newTransaction: Partial<Transaction> = {
        amount: parseInt(amount),
        date: new Date() as any, // FirestoreにはDate型でOK
        categoryId: selectedCatId,
        categoryName: category?.name || '',
        sourceAccountId: selectedAccId,
        memo: memo,
        type: category?.type || 'expense',
        scope: 'private', // とりあえず個人
        approvalStatus: 'confirmed', // 自分の入力なので確定
        createdAt: new Date() as any,
        createdBy: user.uid
      };

      await addDoc(collection(db, `users/${user.uid}/transactions`), newTransaction);
      
      Alert.alert("保存完了", "データを保存しました", [
        { text: "OK", onPress: () => navigation.goBack() } // モーダルを閉じる
      ]);
    } catch (e: any) {
      Alert.alert("エラー", e.message);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.label}>金額</Text>
      <TextInput 
        style={styles.input} 
        keyboardType="numeric" 
        value={amount} 
        onChangeText={setAmount} 
        placeholder="¥0"
      />

      <Text style={styles.label}>科目</Text>
      <View style={styles.pickerContainer}>
        <Picker selectedValue={selectedCatId} onValueChange={(v) => setSelectedCatId(v)}>
          {categories.map(c => <Picker.Item key={c.id} label={c.name} value={c.id} />)}
        </Picker>
      </View>

      <Text style={styles.label}>出金元口座</Text>
      <View style={styles.pickerContainer}>
        <Picker selectedValue={selectedAccId} onValueChange={(v) => setSelectedAccId(v)}>
          {accounts.map(a => <Picker.Item key={a.id} label={a.name} value={a.id} />)}
        </Picker>
      </View>

      <Text style={styles.label}>メモ</Text>
      <TextInput style={styles.input} value={memo} onChangeText={setMemo} />

      <View style={{ marginTop: 20 }}>
        <Button title="保存する" onPress={handleSave} />
        <View style={{marginTop: 10}}><Button title="キャンセル" color="gray" onPress={() => navigation.goBack()} /></View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  label: { marginTop: 15, marginBottom: 5, fontWeight: 'bold' },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, borderRadius: 5, fontSize: 16 },
  pickerContainer: { borderWidth: 1, borderColor: '#ccc', borderRadius: 5, marginBottom: 5 }
});