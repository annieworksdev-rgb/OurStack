import { 
  collection, 
  doc, 
  writeBatch, 
  getDocs, 
  serverTimestamp,
  increment
} from 'firebase/firestore';
import { db, auth } from './config';
import { Transaction } from '../../types';

/**
 * スマートなデモデータ生成
 * 1. 既存の科目・口座があればそれを使います。
 * 2. なければデフォルトを作成します。
 * 3. それらのIDを使って、整合性の取れた明細を作成します。
 */
export const regenerateDemoData = async () => {
  const user = auth.currentUser;
  if (!user) throw new Error("ユーザーが見つかりません");

  const batch = writeBatch(db);

  // ----------------------------------------------------
  // 1. 既存データの確認 & 準備
  // ----------------------------------------------------
  
  // 科目をDBから取得
  const catSnapshot = await getDocs(collection(db, `users/${user.uid}/categories`));
  let categories: { id: string, name: string }[] = [];

  if (!catSnapshot.empty) {
    // 既存があれば使う
    categories = catSnapshot.docs.map(d => ({ id: d.id, name: d.data().name }));
  } else {
    // なければデフォルトを作成してバッチに登録
    const defaultCats = [
      { name: '食費', icon: 'fast-food', type: 'expense', sortOrder: 1 },
      { name: '日用品', icon: 'cart', type: 'expense', sortOrder: 2 },
      { name: '交通費', icon: 'train', type: 'expense', sortOrder: 3 },
      { name: '給料', icon: 'cash', type: 'income', sortOrder: 1 },
    ];
    categories = defaultCats.map(c => {
      const ref = doc(collection(db, `users/${user.uid}/categories`));
      batch.set(ref, { ...c, createdAt: serverTimestamp() });
      return { id: ref.id, name: c.name };
    });
  }

  // 口座をDBから取得
  const accSnapshot = await getDocs(collection(db, `users/${user.uid}/accounts`));
  let accounts: { id: string, name: string }[] = [];

  if (!accSnapshot.empty) {
    // 既存があれば使う
    accounts = accSnapshot.docs.map(d => ({ id: d.id, name: d.data().name }));
  } else {
    // なければデフォルトを作成
    const defaultAccs = [
      { name: '財布', type: 'cash', balance: 0 },
      { name: '銀行', type: 'bank', balance: 0 },
    ];
    accounts = defaultAccs.map(a => {
      const ref = doc(collection(db, `users/${user.uid}/accounts`));
      batch.set(ref, { ...a, createdAt: serverTimestamp() });
      return { id: ref.id, name: a.name };
    });
  }

  // ----------------------------------------------------
  // 2. 明細データの作成
  // ----------------------------------------------------
  const TRANSACTION_COUNT = 50;
  const balanceChanges: { [key: string]: number } = {}; // 残高計算用

  for (let i = 0; i < TRANSACTION_COUNT; i++) {
    const newTransRef = doc(collection(db, `users/${user.uid}/transactions`));
    
    // 過去3ヶ月以内のランダム日付
    const daysAgo = Math.floor(Math.random() * 90);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);

    const amount = (Math.floor(Math.random() * 50) + 1) * 100; // 100~5000円

    // ★ポイント：既存（または新規作成した）リストからランダム選択
    const targetCat = categories[Math.floor(Math.random() * categories.length)];
    const targetAcc = accounts[Math.floor(Math.random() * accounts.length)];

    // 簡易的に全部「支出」にします（科目が給料だろうとお構いなしですが、テスト用なので許容）
    const transaction: Partial<Transaction> = {
      id: newTransRef.id,
      type: 'expense',
      date: date as any,
      amount: amount,
      memo: `自動生成 ${i + 1}`,
      categoryId: targetCat.id,
      categoryName: targetCat.name,
      sourceAccountId: targetAcc.id,
      createdBy: user.uid,
      createdAt: serverTimestamp() as any,
    };

    batch.set(newTransRef, transaction);

    // 残高の変動を集計
    balanceChanges[targetAcc.id] = (balanceChanges[targetAcc.id] || 0) - amount;
  }

  // ----------------------------------------------------
  // 3. 口座残高の一括更新
  // ----------------------------------------------------
  Object.keys(balanceChanges).forEach(accId => {
    const change = balanceChanges[accId];
    if (change !== 0) {
      const accRef = doc(db, `users/${user.uid}/accounts`, accId);
      // incrementを使うことで、現在の残高に足し引きします
      batch.update(accRef, {
        balance: increment(change)
      });
    }
  });

  await batch.commit();
  console.log("既存マスタを利用してデモデータを追加しました");
};