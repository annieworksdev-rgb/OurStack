import { collection, doc, writeBatch, Timestamp } from 'firebase/firestore';
import { db, auth } from './config';
import { Category, Account, Scope, TransactionType } from '../../types';

/**
 * 初期データを投入する関数（バッチ処理）
 */
export const seedInitialData = async () => {
  const user = auth.currentUser;
  if (!user) throw new Error("ログインしていません");

  const batch = writeBatch(db); // C#の TransactionScope のようなもの
  const now = new Date();

  // --- 1. デフォルト科目マスタ ---
  const categoriesData = [
    { name: '食費', type: 'expense', icon: 'food' },
    { name: '日用品', type: 'expense', icon: 'cart' },
    { name: '住居費', type: 'expense', icon: 'home' },
    { name: '給与', type: 'income', icon: 'cash' },
  ];

  categoriesData.forEach(c => {
    // IDを自動生成して参照を取得
    const newRef = doc(collection(db, `users/${user.uid}/categories`));
    const category: Category = {
      id: newRef.id,
      name: c.name,
      type: c.type as TransactionType,
      icon: c.icon,
      parentId: null, // 大カテゴリとして登録
    };
    batch.set(newRef, category);
  });

  // --- 2. デフォルト口座マスタ ---
  const accountsData = [
    { name: '現金（財布）', type: 'cash' },
    { name: 'メイン銀行', type: 'bank' },
    { name: 'クレジットカード', type: 'credit_card', isCredit: true },
  ];

  accountsData.forEach(a => {
    const newRef = doc(collection(db, `users/${user.uid}/accounts`));
    const account: Account = {
      id: newRef.id,
      name: a.name,
      type: a.type as any,
      scope: 'private', // とりあえず個人用として作成
      balance: 0,       // 初期残高
      currency: 'JPY',
      isCredit: a.isCredit || false
    };
    batch.set(newRef, account);
  });

  // --- コミット（一括保存） ---
  await batch.commit();
  console.log("Seeding completed!");
};