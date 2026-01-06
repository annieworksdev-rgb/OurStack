import { collection, doc, writeBatch, increment, Timestamp } from 'firebase/firestore';
import { db, auth } from './config';
import { Category, Account, Scope, Transaction, TransactionType } from '../../types';

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

/**
 * 分析テスト用：ダミー明細データの大量投入
 * （口座残高も整合性を保って更新します）
 */
export const addDummyTransactions = async () => {
  const user = auth.currentUser;
  if (!user) throw new Error("ユーザーが見つかりません");

  const batch = writeBatch(db);
  const BATCH_COUNT = 50; // 生成する件数

  // 1. ランダム生成用のネタ帳 (Seedで登録したIDと一致させる)
  const categoriesList = [
    { id: 'food', name: '食費' },
    { id: 'daily', name: '日用品' },
    { id: 'rent', name: '住居費' },
    { id: 'entertainment', name: '交際費' },
    { id: 'transport', name: '交通費' },
  ];
  const accounts = ['wallet', 'bank_main', 'card_main', 'pay_app'];
  
  // 口座ごとの残高変動を集計する辞書 (C#の Dictionary<string, int>)
  const balanceChanges: { [key: string]: number } = {};
  const addBalance = (id: string, amount: number) => {
    balanceChanges[id] = (balanceChanges[id] || 0) + amount;
  };

  // 2. ループでデータ生成
  for (let i = 0; i < BATCH_COUNT; i++) {
    const newRef = doc(collection(db, `users/${user.uid}/transactions`));
    
    // ランダムな日付（過去90日以内）
    const daysAgo = Math.floor(Math.random() * 90);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);

    // ランダムな金額（100円〜5000円）
    const amount = (Math.floor(Math.random() * 50) + 1) * 100;

    // ランダムな科目と口座
    const targetCat = categoriesList[Math.floor(Math.random() * categoriesList.length)];
    const accId = accounts[Math.floor(Math.random() * accounts.length)];

    // 今回は簡単のため「支出」のみ生成します（分析グラフ映えするため）
    const transaction: Partial<Transaction> = {
      id: newRef.id,
      type: 'expense',
      date: date as any,
      amount: amount,
      memo: `テストデータ ${i + 1}`,
      categoryId: targetCat.id,
      categoryName: targetCat.name,
      sourceAccountId: accId,
      targetAccountId: undefined,
      createdBy: user.uid,
      createdAt: new Date() as any,
    };

    // 明細を追加
    batch.set(newRef, transaction);

    // 残高集計（出金元を減らす）
    addBalance(accId, -amount);
  }

  // 3. 集計した残高変動を一括適用
  // FirestoreのBatchは「同じドキュメントへの複数回書き込み」ができないため、
  // ループ内で毎回 update せず、最後にまとめて update します。
  Object.keys(balanceChanges).forEach(accId => {
    if (balanceChanges[accId] !== 0) {
      const accRef = doc(db, `users/${user.uid}/accounts`, accId);
      batch.update(accRef, { 
        balance: increment(balanceChanges[accId]) 
      });
    }
  });

  await batch.commit();
  console.log(`${BATCH_COUNT}件のダミーデータを投入しました`);
};