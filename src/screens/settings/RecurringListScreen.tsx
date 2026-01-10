import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { collection, query, getDocs, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '../../services/firebase/config';
import { useThemeColor } from '../../hooks/useThemeColor';
import { useMasterData } from '../../store/MasterContext';

export default function RecurringListScreen({ navigation }: any) {
  const colors = useThemeColor();
  const { categories, accounts } = useMasterData();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadList = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setLoading(true);
    try {
      const q = query(collection(db, `users/${user.uid}/recurring`), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setList(data);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  useFocusEffect(useCallback(() => { loadList(); }, []));

  const getFrequencyLabel = (freq: string) => {
    switch(freq) {
      case 'monthly': return '毎月';
      case '2months': return '2ヶ月ごと';
      case '3months': return '3ヶ月ごと';
      case '6months': return '半年ごと';
      case 'yearly': return '毎年';
      default: return freq;
    }
  };

  const renderItem = ({ item }: any) => {
    const cat = categories.find(c => c.id === item.categoryId);
    const acc = accounts.find(a => a.id === item.sourceAccountId);
    
    return (
      <TouchableOpacity 
        style={[styles.itemCard, { backgroundColor: colors.card }]}
        onPress={() => navigation.navigate('RecurringInput', { setting: item })}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={[styles.freqText, { color: colors.tint }]}>
              {getFrequencyLabel(item.frequency)} {item.day}日
            </Text>
            <Text style={[styles.mainText, { color: colors.text }]}>{item.subCategory || cat?.name || '未分類'}</Text>
            <Text style={[styles.subText, { color: colors.textSub }]}>{acc?.name || '不明な口座'}</Text>
          </View>
          <Text style={[styles.amountText, { color: colors.text }]}>¥{item.amount.toLocaleString()}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={list}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 20 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadList} />}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 50, color: colors.textSub }}>繰り返し設定はまだありません</Text>}
      />
      
      <TouchableOpacity 
        style={[styles.fab, { backgroundColor: colors.tint }]}
        onPress={() => navigation.navigate('RecurringInput')}
      >
        <Ionicons name="add" size={32} color="white" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  itemCard: { padding: 15, borderRadius: 12, marginBottom: 15, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  freqText: { fontSize: 12, fontWeight: 'bold', marginBottom: 2 },
  mainText: { fontSize: 16, fontWeight: '600' },
  subText: { fontSize: 12, marginTop: 2 },
  amountText: { fontSize: 18, fontWeight: 'bold' },
  fab: { position: 'absolute', bottom: 30, right: 30, width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 8 },
});