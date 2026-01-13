import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  collection, 
  serverTimestamp,
  writeBatch 
} from 'firebase/firestore'; // Firestore機能を追加
import { auth, db } from './config';
import { User, Book } from '../../types'; // さっき定義した型

// 戻り値を拡張
interface AuthResult {
  user?: FirebaseUser;
  error?: string;
}

/**
 * サインアップ（新規登録）
 * Authユーザー作成 -> デフォルトの家計簿(Book)作成 -> Userドキュメント作成
 * これらを一気に行います。
 */
export const signUp = async (email: string, pass: string, name: string = 'No Name'): Promise<AuthResult> => {
  try {
    // 1. Authenticationでユーザー作成
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const uid = cred.user.uid;

    // 2. 新しい家計簿(Book)のIDを生成
    const newBookRef = doc(collection(db, 'books'));
    const bookId = newBookRef.id;

    // 3. バッチ処理で「Book作成」と「User作成」を同時に行う
    const batch = writeBatch(db);

    // A. Bookのデータ作成
    const newBookData: Omit<Book, 'id'> = { // idはドキュメントIDとして使うのでデータ内には必須ではないが含めても良い
      name: `${name}さんの家計簿`,
      ownerId: uid,
      members: {
        [uid]: 'admin' // 自分は管理者
      },
      currency: 'JPY',
      createdAt: serverTimestamp() as any
    };
    batch.set(newBookRef, newBookData);

    // B. Userのデータ作成 (usersコレクション)
    const newUserRef = doc(db, 'users', uid);
    const newUserData: User = {
      uid: uid,
      email: email,
      displayName: name,
      joinedBooks: {
        [bookId]: {
          role: 'admin',
          joinedAt: serverTimestamp() as any
        }
      },
      defaultBookId: bookId
    };
    batch.set(newUserRef, newUserData);

    // C. (オプション) 初期の「現金財布」を作ってあげると親切
    const accountRef = doc(collection(db, `books/${bookId}/accounts`));
    batch.set(accountRef, {
      name: '現金（財布）',
      type: 'cash',
      balance: 0,
      scope: 'private',
      ownerId: uid,
      createdAt: serverTimestamp()
    });

    // コミット！
    await batch.commit();

    return { user: cred.user };
  } catch (e: any) {
    console.error("SignUp Error:", e);
    return { error: e.message };
  }
};

/**
 * ログイン
 */
export const login = async (email: string, pass: string): Promise<AuthResult> => {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    return { user: cred.user };
  } catch (e: any) {
    return { error: e.message };
  }
};

/**
 * ログアウト
 */
export const logout = async () => {
  try {
    await firebaseSignOut(auth);
  } catch (e) {
    console.error(e);
  }
};