import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db, auth } from '../services/firebase/config';
import { Category, Account } from '../types';

// Contextで公開するデータの型定義
interface MasterContextType {
  categories: Category[];
  accounts: Account[];
  loading: boolean;
}

const MasterContext = createContext<MasterContextType | undefined>(undefined);

export const MasterDataProvider = ({ children }: { children: ReactNode }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  const user = auth.currentUser;

  useEffect(() => {
    if (!user) {
      setCategories([]);
      setAccounts([]);
      setLoading(false);
      return;
    }

    // 1. カテゴリの監視 (C#の ObservableCollection.CollectionChanged に相当)
    const qCategories = query(collection(db, `users/${user.uid}/categories`), orderBy('order', 'asc'));
    const unsubCategories = onSnapshot(qCategories, (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as Category);
      setCategories(data);
    });

    // 2. 口座の監視
    const qAccounts = query(collection(db, `users/${user.uid}/accounts`));
    const unsubAccounts = onSnapshot(qAccounts, (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as Account);
      setAccounts(data);
      setLoading(false);
    });

    // クリーンアップ（画面が破棄されたら監視を停止）
    return () => {
      unsubCategories();
      unsubAccounts();
    };
  }, [user]);

  return (
    <MasterContext.Provider value={{ categories, accounts, loading }}>
      {children}
    </MasterContext.Provider>
  );
};

// カスタムフック（これを使って各画面からデータを呼び出す）
export const useMasterData = () => {
  const context = useContext(MasterContext);
  if (!context) throw new Error("useMasterData must be used within a MasterDataProvider");
  return context;
};