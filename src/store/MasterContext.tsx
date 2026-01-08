import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { auth, db } from '../services/firebase/config';
import { onAuthStateChanged, User } from 'firebase/auth';
// Transaction 型をインポートに追加
import { Category, Account, Transaction } from '../types'; 

// 1. 型定義に transactions を追加
interface MasterContextType {
  categories: Category[];
  accounts: Account[];
  transactions: Transaction[]; // ★追加
  loading: boolean;
}

const MasterContext = createContext<MasterContextType>({
  categories: [],
  accounts: [],
  transactions: [], // ★追加
  loading: true,
});

export const useMasterData = () => useContext(MasterContext);

export const MasterProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]); // ★追加
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) {
      setCategories([]);
      setAccounts([]);
      setTransactions([]); // ★追加
      setLoading(false);
      return;
    }

    // 科目の購読
    const qCats = query(collection(db, `users/${user.uid}/categories`), orderBy('sortOrder'));
    const unsubCats = onSnapshot(qCats, (snap) => {
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as Category)));
    });

    // 口座の購読
    const qAccs = query(collection(db, `users/${user.uid}/accounts`), orderBy('createdAt'));
    const unsubAccs = onSnapshot(qAccs, (snap) => {
      setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Account)));
    });

    // ★追加: 明細の購読（日付順）
    // ※データ量が増えると重くなるので、本来は直近◯ヶ月分だけに絞るなどの工夫が必要ですが、
    //  個人用アプリの初期段階なら全件取得でも十分動きます。
    const qTrans = query(collection(db, `users/${user.uid}/transactions`), orderBy('date', 'desc'));
    const unsubTrans = onSnapshot(qTrans, (snap) => {
      const data = snap.docs.map(d => {
        const raw = d.data();
        return {
          id: d.id,
          ...raw,
          // FirestoreのTimestampをJSのDateに変換しておく
          date: raw.date?.toDate ? raw.date.toDate() : new Date(raw.date),
          createdAt: raw.createdAt?.toDate ? raw.createdAt.toDate() : new Date(raw.createdAt),
        } as Transaction;
      });
      setTransactions(data);
    });

    setLoading(false);

    return () => {
      unsubCats();
      unsubAccs();
      unsubTrans(); // ★追加
    };
  }, [user]);

  return (
    // ★value に transactions を追加
    <MasterContext.Provider value={{ categories, accounts, transactions, loading }}>
      {children}
    </MasterContext.Provider>
  );
};