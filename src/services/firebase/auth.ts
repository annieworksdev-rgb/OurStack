import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  User 
} from 'firebase/auth';
import { auth } from './config';

// 戻り値の型定義
interface AuthResult {
  user?: User;
  error?: string;
}

/**
 * サインアップ（新規登録）
 */
export const signUp = async (email: string, pass: string): Promise<AuthResult> => {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    return { user: cred.user };
  } catch (e: any) {
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