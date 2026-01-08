import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../services/firebase/config';
import { useMasterData } from '../../store/MasterContext';
import { useThemeColor } from '../../hooks/useThemeColor';

export default function AccountManageScreen() {
  const { accounts } = useMasterData();
  const colors = useThemeColor();
  const [newName, setNewName] = useState('');

  const handleAdd = async () => {
    if (!newName.trim()) return;
    if (!auth.currentUser) return;

    try {
      await addDoc(collection(db, `users/${auth.currentUser.uid}/accounts`), {
        name: newName.trim(),
        type: 'cash', // 簡易的に全部 'cash' としておきます（後でアイコン選択などを凝ってもOK）
        balance: 0,
        createdAt: serverTimestamp()
      });
      setNewName('');
    } catch (e) {
      Alert.alert('エラー', '追加に失敗しました');
    }
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert(
      '削除の確認',
      `「${name}」を削除しますか？\n※残高データも消えます。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除する',
          style: 'destructive',
          onPress: async () => {
            if (!auth.currentUser) return;
            try {
              await deleteDoc(doc(db, `users/${auth.currentUser.uid}/accounts`, id));
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
      <FlatList
        data={accounts}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={[styles.item, { borderBottomColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="wallet-outline" size={24} color={colors.text} style={{ marginRight: 10 }} />
              <View>
                <Text style={[styles.itemText, { color: colors.text }]}>{item.name}</Text>
                <Text style={{ fontSize: 12, color: colors.textSub }}>残高: ¥{item.balance?.toLocaleString() || 0}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => handleDelete(item.id, item.name)} style={styles.deleteBtn}>
              <Ionicons name="trash-outline" size={20} color="#ff4444" />
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={<Text style={{ padding: 20, color: colors.textSub }}>データがありません</Text>}
      />

      <View style={[styles.inputContainer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
            placeholder="新しい口座名（例: タンス預金）"
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
  itemText: { fontSize: 16, fontWeight: 'bold' },
  deleteBtn: { padding: 10 },
  inputContainer: { padding: 15, borderTopWidth: 1, paddingBottom: 40 },
  row: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, height: 44, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, marginRight: 10 },
  addBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
});