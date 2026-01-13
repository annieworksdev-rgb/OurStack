import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { collection, onSnapshot, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../services/firebase/config';
import { Category, Account, Transaction, User, UserRole, Book } from '../types';

// Contextで公開するデータの型定義
interface MasterContextType {
  // --- データ ---
  categories: Category[];
  accounts: Account[];
  transactions: Transaction[];
  
  // --- 状態 ---
  loading: boolean;        // 読み込み中かどうか
  user: User | null;       // Firestore上のユーザー情報（設定など）
  
  // --- マルチテナント用 ---
  currentBookId: string | null;     // 現在開いている家計簿ID
  currentBook: Book | null;         // 家計簿のメタデータ（名前など）
  userRole: UserRole | null;        // その家計簿での自分の役割（admin/member）
  
  // 家計簿切り替えメソッド（将来用）
  switchBook: (bookId: string) => void;
}

const MasterContext = createContext<MasterContextType>({
  categories: [],
  accounts: [],
  transactions: [],
  loading: true,
  user: null,
  currentBookId: null,
  currentBook: null,
  userRole: null,
  switchBook: () => {},
});

export const useMasterData = () => useContext(MasterContext);

export const MasterProvider = ({ children }: { children: ReactNode }) => {
  // Authユーザー（ログイン状態）
  const [authUser, setAuthUser] = useState<any>(null);
  
  // Firestoreデータ
  const [userDoc, setUserDoc] = useState<User | null>(null);
  const [currentBookId, setCurrentBookId] = useState<string | null>(null);
  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  
  // リストデータ
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
  const [loading, setLoading] = useState(true);

  // 1. 認証状態の監視
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setAuthUser(u);
      if (!u) {
        // ログアウト時はデータをクリア
        setUserDoc(null);
        setCurrentBookId(null);
        setCurrentBook(null);
        setCategories([]);
        setAccounts([]);
        setTransactions([]);
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  // 2. ユーザー情報の監視 (users/{uid})
  useEffect(() => {
    if (!authUser) return;

    // 自分のユーザー設定ドキュメントを監視
    const userRef = doc(db, 'users', authUser.uid);
    const unsubUser = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const userData = docSnap.data() as User;
        setUserDoc(userData);

        // まだBookが開かれていない、または開いているBookが変わった場合
        // デフォルトのBookを開く（なければ最初のBook）
        if (!currentBookId && userData.joinedBooks) {
          const targetBookId = userData.defaultBookId || Object.keys(userData.joinedBooks)[0];
          if (targetBookId) {
            setCurrentBookId(targetBookId);
          }
        }
      } else {
        // 新規登録直後などでドキュメントがない場合
        console.log("No user doc found yet.");
      }
    });

    return () => unsubUser();
  }, [authUser]);

  // 3. 家計簿データの監視 (books/{bookId}/...)
  // currentBookId が決まって初めて動き出す
  useEffect(() => {
    if (!currentBookId) return;

    setLoading(true);

    // A. Book自体のメタデータ取得（名前など）
    const bookRef = doc(db, 'books', currentBookId);
    const unsubBook = onSnapshot(bookRef, (snap) => {
      if (snap.exists()) {
        setCurrentBook({ id: snap.id, ...snap.data() } as Book);
      }
    });

    // B. カテゴリ (books/{bookId}/categories)
    const qCats = query(collection(db, `books/${currentBookId}/categories`), orderBy('sortOrder'));
    const unsubCats = onSnapshot(qCats, (snap) => {
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as Category)));
    });

    // C. 口座 (books/{bookId}/accounts)
    const qAccs = query(collection(db, `books/${currentBookId}/accounts`), orderBy('createdAt'));
    const unsubAccs = onSnapshot(qAccs, (snap) => {
      setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Account)));
    });

    // D. 明細 (books/{bookId}/transactions)
    const qTrans = query(collection(db, `books/${currentBookId}/transactions`), orderBy('date', 'desc'));
    const unsubTrans = onSnapshot(qTrans, (snap) => {
      const data = snap.docs.map(d => {
        const raw = d.data();
        return {
          id: d.id,
          ...raw,
          date: raw.date?.toDate ? raw.date.toDate() : new Date(raw.date),
          createdAt: raw.createdAt?.toDate ? raw.createdAt.toDate() : new Date(raw.createdAt),
        } as Transaction;
      });
      setTransactions(data);
      setLoading(false); // ここまで来たら読み込み完了とみなす
    });

    return () => {
      unsubBook();
      unsubCats();
      unsubAccs();
      unsubTrans();
    };
  }, [currentBookId]);

  // 家計簿切り替え用関数
  const switchBook = (bookId: string) => {
    if (userDoc?.joinedBooks && userDoc.joinedBooks[bookId]) {
      setLoading(true);
      setCurrentBookId(bookId);
      // 必要なら users/{uid} の defaultBookId も更新すると親切
    }
  };

  // 現在のBookでの役割を計算
  const userRole = (userDoc && currentBookId && userDoc.joinedBooks[currentBookId]) 
    ? userDoc.joinedBooks[currentBookId].role 
    : null;

  return (
    <MasterContext.Provider value={{ 
      categories, 
      accounts, 
      transactions, 
      loading, 
      user: userDoc,
      currentBookId,
      currentBook,
      userRole,
      switchBook
    }}>
      {children}
    </MasterContext.Provider>
  );
};