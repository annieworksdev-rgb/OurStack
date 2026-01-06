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
    { id: 'food', name: '食費', type: 'expense', icon: 'food' },
    { id: 'daily', name: '日用品', type: 'expense', icon: 'cart' },
    { id: 'rent', name: '住居費', type: 'expense', icon: 'home' },
    { id: 'salary', name: '給与', type: 'income', icon: 'cash' },
  ];

  categoriesData.forEach((c, index) => {
    // 【修正】第3引数にIDを指定することで、ランダム生成を防ぐ
    const newRef = doc(db, `users/${user.uid}/categories`, c.id);
    
    const category: Category = {
      id: c.id, // IDも固定値を使う
      name: c.name,
      type: c.type as TransactionType,
      icon: c.icon,
      parentId: null,
      order: index 
    };
    // setは「指定したIDがあれば上書き、なければ作成」という動きをします
    batch.set(newRef, category);
  });

  // --- 2. デフォルト口座マスタ ---
  const accountsData = [
    { id: 'wallet', name: '現金（財布）', type: 'cash' },
    { id: 'bank_main', name: 'メイン銀行', type: 'bank' },
    { id: 'card_main', name: 'クレジットカード', type: 'credit_card', isCredit: true },
    { id: 'pay_app', name: 'PayPay', type: 'e_money' }, 
    { id: 'suica', name: 'Suica', type: 'e_money' },
  ];

  accountsData.forEach(a => {
    // 【修正】ここもIDを指定
    const newRef = doc(db, `users/${user.uid}/accounts`, a.id);
    
    const account: Account = {
      id: a.id, // 固定ID
      name: a.name,
      type: a.type as any,
      scope: 'private',
      balance: 0,
      currency: 'JPY',
      isCredit: a.isCredit || false 
    };
    batch.set(newRef, account);
  });

  // --- コミット（一括保存） ---
  await batch.commit();
  console.log("Seeding completed!");
};