import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../services/firebase/config';
import { useMasterData } from '../../store/MasterContext';
import { useThemeColor } from '../../hooks/useThemeColor';

export default function CategoryManageScreen() {
  const { categories } = useMasterData();
  const colors = useThemeColor();
  
  // 新規追加用の入力ステート
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'expense' | 'income'>('expense');

  // 追加処理
  const handleAdd = async () => {
    if (!newName.trim()) return;
    if (!auth.currentUser) return;

    try {
      await addDoc(collection(db, `users/${auth.currentUser.uid}/categories`), {
        name: newName.trim(),
        type: newType,
        sortOrder: categories.length + 1, // 最後尾に追加
        icon: 'pricetag', // デフォルトアイコン
        createdAt: serverTimestamp()
      });
      setNewName(''); // 入力欄をクリア
    } catch (e) {
      Alert.alert('エラー', '追加に失敗しました');
    }
  };

  // 削除処理
  const handleDelete = (id: string, name: string) => {
    Alert.alert(
      '削除の確認',
      `「${name}」を削除しますか？\n※これを使っている過去の明細は「不明」になります。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除する',
          style: 'destructive',
          onPress: async () => {
            if (!auth.currentUser) return;
            try {
              await deleteDoc(doc(db, `users/${auth.currentUser.uid}/categories`, id));
            } catch (e) {
              Alert.alert('エラー', '削除に失敗しました');
            }
          }
        }
      ]
    );
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* リスト表示 */}
      <FlatList
        data={categories}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={[styles.item, { borderBottomColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {/* 支出は赤系、収入は青系などのアイコン */}
              <View style={[styles.iconBox, { backgroundColor: item.type === 'expense' ? '#FF6384' : '#36A2EB' }]}>
                <Ionicons name="pricetag" size={16} color="white" />
              </View>
              <Text style={[styles.itemText, { color: colors.text }]}>{item.name}</Text>
            </View>
            
            <TouchableOpacity onPress={() => handleDelete(item.id, item.name)} style={styles.deleteBtn}>
              <Ionicons name="trash-outline" size={20} color="#ff4444" />
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={<Text style={{ padding: 20, color: colors.textSub }}>データがありません</Text>}
      />

      {/* 入力エリア（画面下部） */}
      <View style={[styles.inputContainer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <View style={styles.typeSelector}>
          <TouchableOpacity 
            style={[styles.typeBtn, newType === 'expense' && styles.typeBtnActive]}
            onPress={() => setNewType('expense')}
          >
            <Text style={[styles.typeText, newType === 'expense' && { color: 'white' }]}>支出</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.typeBtn, newType === 'income' && { backgroundColor: '#36A2EB' }, newType !== 'income' && { backgroundColor: '#eee' }]}
            onPress={() => setNewType('income')}
          >
            <Text style={[styles.typeText, newType === 'income' && { color: 'white' }]}>収入</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.row}>
          <TextInput
            style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
            placeholder="新しい科目名（例: 推し活）"
            placeholderTextColor={colors.textSub}
            value={newName}
            onChangeText={setNewName}
          />
          <TouchableOpacity onPress={handleAdd} style={[styles.addBtn, { backgroundColor: colors.tint }]}>
            <Ionicons name="add" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 0.5 },
  itemText: { fontSize: 16, marginLeft: 10 },
  iconBox: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  deleteBtn: { padding: 10 },
  
  inputContainer: { padding: 15, borderTopWidth: 1, paddingBottom: 40 },
  typeSelector: { flexDirection: 'row', marginBottom: 10 },
  typeBtn: { paddingVertical: 6, paddingHorizontal: 15, borderRadius: 15, marginRight: 10, backgroundColor: '#eee' },
  typeBtnActive: { backgroundColor: '#FF6384' },
  typeText: { fontSize: 14, fontWeight: 'bold', color: '#555' },
  
  row: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, height: 44, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, marginRight: 10 },
  addBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
});