// src/types/index.d.ts

/**
 * 基本的なID型（FirestoreのDocument ID）
 */
export type ID = string;

/**
 * FirestoreのTimestamp型（クライアント側ではDateとして扱う場合が多いが、
 * 保存時はFirestore.Timestampになるため、相互変換を意識）
 */
export type Timestamp = Date; 

// ==========================================
//  Enums & Constants (C#のEnumに近い感覚で使用)
// ==========================================

/**
 * データが属するバケツ（スコープ）
 * - shared: 夫婦共有
 * - private: 夫または妻の個人
 * - family: 子ども含む家族全体（将来用）
 */
export type Scope = 'shared' | 'private' | 'family';

/**
 * ユーザーの役割
 * - admin: 親（全ての承認権限あり）
 * - member: 子ども（承認が必要）
 */
export type UserRole = 'admin' | 'member';

/**
 * 収支の種類
 * - income: 収入
 * - expense: 支出
 * - transfer: 振替（銀行A -> 財布）
 * - charge: チャージ（現金/銀行/カード -> 電子マネー）
 */
export type TransactionType = 'income' | 'expense' | 'transfer' | 'charge';

/**
 * 承認ステータス（子どものお使い、夫の共有財産からの出費申請など）
 * - confirmed: 確定済み（通常はこれ）
 * - pending: 承認待ち
 * - rejected: 否認（個人負担へ）
 */
export type ApprovalStatus = 'confirmed' | 'pending' | 'rejected';

/**
 * 財源区分（否認された時のフォールバック用）
 * - shared_fund: 共有財産から出す
 * - private_fund: 自分のお小遣い/個人資産から出す
 */
export type FundingSource = 'shared_fund' | 'private_fund';

// ==========================================
//  Domain Models (Entity Definitions)
// ==========================================

/**
 * 家計簿（Book）
 * これがデータの「親」になります。
 * 1つのBookの中に、Category, Account, Transaction がぶら下がります。
 */
export interface Book {
  id: ID;
  name: string;          // "鈴木家・共有", "夫のへそくり"
  ownerId: ID;           // 作成者
  members: {             // 参加メンバーと役割
    [userId: string]: UserRole; 
  };
  currency: string;      // "JPY"
  createdAt: Timestamp;
}

/**
 * ユーザー情報
 */
export interface User {
  uid: ID;
  email?: string;
  displayName: string;
  photoURL?: string;
  
  // ★ここが重要：参加している家計簿リスト
  // キーはbookId, 値はメタデータ（将来的に並び順や表示名カスタムなど）
  joinedBooks: {
    [bookId: string]: {
      role: UserRole;
      joinedAt: Timestamp;
    }
  };

  // デフォルトで開く家計簿ID
  defaultBookId?: ID;
}

/**
 * ユーザー設定（機能フラグなど）
 */
export interface UserSettings {
  useSubCategory: boolean; // 小科目機能を使うかどうか
}

/**
 * 口座（Account）
 * 財布、銀行、クレジットカード、電子マネーなど
 */
export interface Account {
  id: ID;
  name: string;          // "三菱UFJ", "夫の財布"
  type: 'cash' | 'bank' | 'credit_card' | 'e_money' | 'investment';
  
  // バケツ分けのキー
  scope: Scope;          // 共有口座か、個人口座か
  ownerId?: ID;          //個人の場合、誰のものか

  // 残高管理
  balance: number;       // 現在高
  startDate?: Date;      // 利用開始日
  currency: string;      // "JPY"
  
  // クレジットカード特有の設定
  closingDay?: number;   // 締め日（例: 15）
  paymentDay?: number;   // 支払日（例: 27）
  isCredit?: boolean;    // trueなら負債として扱う

  // 使用停止
  isArchived?: boolean;  // true なら入力画面の選択肢に出さない
}

/**
 * 科目（Category）
 * 親子階層を持つことができる
 */
export interface Category {
  id: ID;
  name: string;          // "食費", "ゲーム代"
  type: TransactionType; // 収入科目か支出科目か
  icon?: string;         // アイコン名
  color?: string;        // グラフ表示用の色
  budget?: number;       // 予算

  // 簡易的な2層構造用
  subCategories?: string[];
  
  // 表示順序
  order?: number;
}

/**
 * 明細（Transaction）
 * アプリの核となるデータ構造
 */
export interface Transaction {
  id: ID;
  groupId: ID;           // 家族グループID
  
  // 基本情報
  amount: number;        // 金額
  type: TransactionType;
  date: Timestamp;       // 発生日（買い物をした日）
  memo?: string;
  
  // 分類
  categoryId?: ID;       // 科目ID
  categoryName?: string; // 非正規化：表示用（マスタ参照削減）
  subCategory?: string;
  
  // 金の動き
  sourceAccountId?: ID;  // 出金元（支出・振替元）
  targetAccountId?: ID;  // 入金先（振替先・収入先）

  // バケツと権限
  scope: Scope;          // 共有家計か、個人家計か
  createdBy: ID;         // 入力者（User UID）
  
  // 承認フロー用
  approvalStatus: ApprovalStatus;
  fundingSource: FundingSource; // 共有から出すか、自腹か
  
  // クレジットカード・分割払い用（発生主義 vs 現金主義）
  paymentDate?: Timestamp; // 実際の引き落とし予定日
  installmentInfo?: {      // 分割払い情報
    totalInstallments: number; // 全何回か
    currentInstallment: number; // 何回目か
    parentTransactionId?: ID;   // 分割の親となるID
  };

  // メタデータ
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * 月次集計（MonthlySummary）
 * 高速化のためのスナップショット
 */
export interface MonthlySummary {
  id: ID; // "2025-12" のような年月ID
  month: string; 
  
  // 月初と月末の残高（口座別）
  openingBalances: Record<ID, number>; // { accountId: 10000 }
  closingBalances: Record<ID, number>; // { accountId: 8000 }
  
  // その月の収支合計
  totalIncome: number;
  totalExpense: number;
  
  // カテゴリ別集計（グラフ用）
  categoryTotals: Record<ID, number>; // { categoryId: 5000 }
}