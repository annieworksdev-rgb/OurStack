import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, 
  Modal, KeyboardAvoidingView, Platform, ScrollView 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, addDoc, deleteDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../services/firebase/config';
import { useMasterData } from '../../store/MasterContext';
import { useThemeColor } from '../../hooks/useThemeColor';
import { Category, TransactionType } from '../../types';

// アイコンのグルーピング定義
const ICON_GROUPS = [
  {
    title: '通信・IT',
    icons: ['wifi', 'phone-portrait', 'laptop', 'desktop', 'globe', 'tv', 'headset']
  },
  {
    title: '食事・日用品',
    icons: ['fast-food', 'restaurant', 'cafe', 'beer', 'cart', 'basket', 'nutrition']
  },
  {
    title: '交通・旅行',
    icons: ['train', 'car', 'bus', 'bicycle', 'airplane', 'walk', 'map']
  },
  {
    title: '住居・水道光熱',
    icons: ['home', 'flash', 'water', 'flame', 'construct', 'key', 'trash']
  },
  {
    title: '衣服・美容・医療',
    icons: ['shirt', 'cut', 'glasses', 'medical', 'fitness', 'body', 'heart']
  },
  {
    title: '教育・教養',
    icons: ['school', 'book', 'library', 'pencil', 'newspaper']
  },
  {
    title: '趣味・娯楽',
    icons: ['game-controller', 'musical-notes', 'camera', 'color-palette', 'paw', 'football']
  },
  {
    title: '金融・その他',
    icons: ['wallet', 'card', 'cash', 'gift', 'briefcase', 'pricetag', 'ellipsis-horizontal']
  },
];

export default function CategoryManageScreen() {
  const { categories } = useMasterData();
  const colors = useThemeColor();

  // --- State ---
  const [modalVisible, setModalVisible] = useState(false);
  
  // 選択中のアイコン（初期値は pricetag）
  const [tempIcon, setTempIcon] = useState('pricetag');

  // 編集中のデータ
  // 新規作成時も、ここに「IDが空の仮オブジェクト」を入れて扱います
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  
  // 親科目名・タイプの一時ステート
  const [tempName, setTempName] = useState('');
  const [tempType, setTempType] = useState<TransactionType>('expense');
  
  // 子科目入力用の一時ステート
  const [tempSubName, setTempSubName] = useState('');

  // --- アクション ---

  // 新規作成ボタンを押した時
  const openNewModal = () => {
    // 新規用の空データを作成（IDは空文字にしておく）
    const draftCategory = {
      id: '', 
      name: '', 
      type: 'expense' as TransactionType,
      subCategories: [] // 空の配列
    } as Category;

    setEditingCategory(draftCategory); 
    setTempName('');
    setTempType('expense');
    setTempSubName('');
    setTempIcon('pricetag');
    setModalVisible(true);
  };

  // 既存の行をタップした時
  const openEditModal = (cat: Category) => {
    setEditingCategory(cat); 
    setTempName(cat.name);
    setTempType(cat.type);
    setTempSubName('');
    setTempIcon(cat.icon || 'pricetag');
    setModalVisible(true);
  };

  // 保存処理（親も子もここで一括保存！）
  const handleSave = async () => {
    if (!tempName.trim()) {
      Alert.alert('エラー', '科目名を入力してください');
      return;
    }
    if (!auth.currentUser || !editingCategory) return;

    try {
      // 画面上の最新の子科目リストを取得
      const currentSubs = editingCategory.subCategories || [];

      if (editingCategory.id) {
        // --- 既存データの更新 (IDがある場合) ---
        const ref = doc(db, `users/${auth.currentUser.uid}/categories`, editingCategory.id);
        await updateDoc(ref, {
          name: tempName.trim(),
          type: tempType,
          icon: tempIcon,
          subCategories: currentSubs, // 子科目リストも上書き
          // updatedAT: serverTimestamp() // 必要なら更新日時も
        });
      } else {
        // --- 新規作成 (IDがない場合) ---
        await addDoc(collection(db, `users/${auth.currentUser.uid}/categories`), {
          name: tempName.trim(),
          type: tempType,
          sortOrder: categories.length + 1,
          icon: tempIcon,
          subCategories: currentSubs, // 作っておいた子科目リストを保存
          createdAt: serverTimestamp()
        });
      }
      setModalVisible(false);
    } catch (e) {
      console.error(e);
      Alert.alert('エラー', '保存に失敗しました');
    }
  };

  // 削除処理（親科目ごと消す）
  const handleDelete = () => {
    if (!editingCategory || !editingCategory.id) return; // 新規作成中は削除ボタン出さない想定だが念のため
    
    Alert.alert(
      '科目の削除',
      `「${editingCategory.name}」を削除しますか？\n（過去の明細データは残りますが、科目は不明になります）`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除する',
          style: 'destructive',
          onPress: async () => {
            if (!auth.currentUser || !editingCategory.id) return;
            try {
              await deleteDoc(doc(db, `users/${auth.currentUser.uid}/categories`, editingCategory.id));
              setModalVisible(false);
            } catch (e) {
              Alert.alert('エラー', '削除できませんでした');
            }
          }
        }
      ]
    );
  };

  // 子科目の追加（画面上のリストに追加するだけ。DB保存はしない）
  const handleAddSub = () => {
    if (!tempSubName.trim()) return;
    if (!editingCategory) return;

    const newVal = tempSubName.trim();

    // editingCategoryの状態を更新
    setEditingCategory(prev => {
      if (!prev) return null;
      const oldSubs = prev.subCategories || [];
      // 重複チェック（任意）
      if (oldSubs.includes(newVal)) {
        Alert.alert('重複', 'その子科目は既にあります');
        return prev;
      }
      return { ...prev, subCategories: [...oldSubs, newVal] };
    });

    setTempSubName(''); // 入力欄クリア
  };

  // 子科目の削除（画面上のリストから消すだけ）
  const handleDeleteSub = (subName: string) => {
    if (!editingCategory) return;

    setEditingCategory(prev => {
      if (!prev) return null;
      const oldSubs = prev.subCategories || [];
      return { 
        ...prev, 
        subCategories: oldSubs.filter(s => s !== subName) 
      };
    });
  };


  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      
      {/* 親科目リスト */}
      <FlatList
        data={categories}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={[styles.item, { borderBottomColor: colors.border }]}
            onPress={() => openEditModal(item)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.iconBox, { backgroundColor: item.type === 'expense' ? '#FF6384' : '#36A2EB' }]}>
                <Ionicons name={item.icon as any || "pricetag"} size={16} color="white" />
              </View>
              <View>
                <Text style={[styles.itemText, { color: colors.text }]}>{item.name}</Text>
                {/* 子科目の内訳を表示 */}
                {item.subCategories && item.subCategories.length > 0 && (
                  <Text style={{ fontSize: 12, color: colors.textSub, marginLeft: 10 }}>
                    {item.subCategories.join(', ')}
                  </Text>
                )}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSub} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={{ padding: 20, color: colors.textSub }}>データがありません</Text>}
      />

      {/* FAB (右下の＋ボタン) */}
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
            
            {/* モーダルヘッダー */}
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={{ color: colors.textSub, fontSize: 16 }}>キャンセル</Text>
              </TouchableOpacity>
              <Text style={{ fontWeight: 'bold', fontSize: 18, color: colors.text }}>
                {editingCategory?.id ? '科目の編集' : '新規科目'}
              </Text>
              <TouchableOpacity onPress={handleSave}>
                <Text style={{ color: colors.tint, fontWeight: 'bold', fontSize: 16 }}>保存</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20 }}>
              
              {/* 1. タイプ選択 (一番上) */}
              <View style={styles.typeSelector}>
                <TouchableOpacity 
                  style={[styles.typeBtn, tempType === 'expense' && styles.typeBtnActive]}
                  onPress={() => setTempType('expense')}
                >
                  <Text style={[styles.typeText, tempType === 'expense' && { color: 'white' }]}>支出</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.typeBtn, tempType === 'income' && { backgroundColor: '#36A2EB' }, tempType !== 'income' && { backgroundColor: '#eee' }]}
                  onPress={() => setTempType('income')}
                >
                  <Text style={[styles.typeText, tempType === 'income' && { color: 'white' }]}>収入</Text>
                </TouchableOpacity>
              </View>

              {/* 2. 親科目名入力 (ここを上に移動！) */}
              <Text style={[styles.label, { color: colors.textSub }]}>親科目名</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                value={tempName}
                onChangeText={setTempName}
                placeholder="例: 通信費"
                placeholderTextColor={colors.textSub}
              />

              {/* 3. 子科目エリア (ここも上に！) */}
              {/* 新規作成時(editingCategoryに仮データが入っている)も表示してOK */}
              {editingCategory && (
                <View style={{ marginBottom: 30 }}>
                  <Text style={[styles.label, { color: colors.textSub }]}>
                    子科目（内訳）
                  </Text>
                  
                  {/* 子科目リスト */}
                  <View style={styles.subList}>
                    {editingCategory.subCategories?.map((sub, index) => (
                      <View key={index} style={[styles.subItem, { borderColor: colors.border }]}>
                        <Text style={{ color: colors.text }}>{sub}</Text>
                        <TouchableOpacity onPress={() => handleDeleteSub(sub)}>
                          <Ionicons name="close-circle" size={20} color={colors.textSub} style={{ marginLeft: 5 }} />
                        </TouchableOpacity>
                      </View>
                    ))}
                    {(!editingCategory.subCategories || editingCategory.subCategories.length === 0) && (
                      <Text style={{ color: colors.textSub, fontSize: 12, marginBottom: 10 }}>設定なし</Text>
                    )}
                  </View>

                  {/* 子科目追加フォーム */}
                  <View style={styles.row}>
                    <TextInput
                      style={[styles.input, { flex: 1, marginBottom: 0, marginRight: 10, color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                      value={tempSubName}
                      onChangeText={setTempSubName}
                      placeholder="例: スマホ代"
                      placeholderTextColor={colors.textSub}
                      onSubmitEditing={handleAddSub}
                    />
                    <TouchableOpacity 
                      onPress={handleAddSub} 
                      style={[styles.addBtn, { backgroundColor: colors.tint }]}
                    >
                      <Ionicons name="add" size={24} color="white" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* 4. アイコン選択エリア (下に移動) */}
              <Text style={[styles.label, { color: colors.textSub, marginBottom: 10 }]}>アイコン</Text>
              
              {ICON_GROUPS.map((group, groupIndex) => (
                <View key={groupIndex} style={styles.groupContainer}>
                  <Text style={[styles.groupTitle, { color: colors.textSub }]}>{group.title}</Text>
                  <View style={styles.iconGrid}>
                    {group.icons.map(iconName => (
                      <TouchableOpacity
                        key={iconName}
                        style={[
                          styles.iconSelectBtn,
                          { 
                            borderColor: tempIcon === iconName ? colors.tint : colors.border,
                            backgroundColor: tempIcon === iconName ? colors.tint : colors.card 
                          }
                        ]}
                        onPress={() => setTempIcon(iconName)}
                      >
                        <Ionicons 
                          name={iconName as any} 
                          size={20} 
                          color={tempIcon === iconName ? 'white' : colors.text} 
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}

              {/* 5. 削除ボタン (一番下) */}
              {editingCategory?.id ? (
                <TouchableOpacity 
                  onPress={handleDelete} 
                  style={{ marginTop: 20, alignItems: 'center', marginBottom: 50 }}
                >
                  <Text style={{ color: colors.error, fontSize: 16 }}>この科目を削除</Text>
                </TouchableOpacity>
              ) : null}

            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  
  // リストアイテム
  item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 0.5 },
  itemText: { fontSize: 16, marginLeft: 10, fontWeight: '500' },
  iconBox: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  
  // FAB
  fab: { 
    position: 'absolute', bottom: 30, right: 30, 
    width: 56, height: 56, borderRadius: 28, 
    justifyContent: 'center', alignItems: 'center',
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5
  },

  // モーダル
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { 
    borderTopLeftRadius: 20, borderTopRightRadius: 20, 
    height: '90%', // 少し広めに
    paddingBottom: 40 
  },
  modalHeader: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    padding: 15, borderBottomWidth: 0.5, borderBottomColor: '#ccc' 
  },

  // フォーム
  typeSelector: { flexDirection: 'row', justifyContent: 'center', marginBottom: 20 },
  typeBtn: { paddingVertical: 8, paddingHorizontal: 30, borderRadius: 20, marginHorizontal: 10, backgroundColor: '#eee' },
  typeBtnActive: { backgroundColor: '#FF6384' },
  typeText: { fontSize: 14, fontWeight: 'bold', color: '#555' },
  
  label: { fontSize: 14, marginBottom: 8, fontWeight: 'bold' },
  input: { height: 44, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, marginBottom: 20 },
  
  // 子科目エリア
  subList: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 15 },
  subItem: { 
    flexDirection: 'row', alignItems: 'center', 
    borderWidth: 1, borderRadius: 15, paddingHorizontal: 10, paddingVertical: 6, 
    marginRight: 8, marginBottom: 8 
  },
  
  row: { flexDirection: 'row', alignItems: 'center' },
  addBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },

  // アイコン選択エリア
  groupContainer: {
    marginBottom: 15,
  },
  groupTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
    marginLeft: 5,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    // marginHorizontal は削除または調整
  },
  iconSelectBtn: {
    width: 40,      // 少し小さく
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 4,      // 間隔を詰める
  },
});