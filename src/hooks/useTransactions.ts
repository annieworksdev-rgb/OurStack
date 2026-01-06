import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { db, auth } from '../services/firebase/config';
import { Transaction } from '../types';

export const useRecentTransactions = (limitCount: number = 5) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;

    // クエリ：自分のデータを、日付の新しい順に、指定件数だけ
    const q = query(
      collection(db, `users/${user.uid}/transactions`),
      orderBy('date', 'desc'),
      limit(limitCount)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          ...d,
          id: doc.id,
          // FirestoreのTimestamp型をJSのDate型に変換
          date: d.date?.toDate ? d.date.toDate() : new Date(), 
        } as Transaction;
      });
      setTransactions(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, limitCount]);

  return { transactions, loading };
};