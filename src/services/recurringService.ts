import { collection, query, where, getDocs, addDoc, updateDoc, doc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase/config';

// 頻度に応じた次回日付の計算
const calculateNextDate = (baseDate: Date, frequency: string, day: number): Date => {
  const next = new Date(baseDate);
  // まず月を進める
  switch (frequency) {
    case 'monthly': next.setMonth(next.getMonth() + 1); break;
    case '2months': next.setMonth(next.getMonth() + 2); break;
    case '3months': next.setMonth(next.getMonth() + 3); break;
    case '6months': next.setMonth(next.getMonth() + 6); break;
    case 'yearly': next.setFullYear(next.getFullYear() + 1); break;
    default: next.setMonth(next.getMonth() + 1);
  }
  // 日付を設定（月末補正などは簡易的にDateオブジェクトに任せる）
  // ※本来は「31日設定で翌月が28日までならどうするか」等の厳密な制御が必要ですが、
  // ここではシンプルに指定日をセットします（JSのDateは自動で翌月1日等に繰り越してくれます）
  next.setDate(day);
  return next;
};

// 休日判定とずらし処理（簡易版：土日のみ判定）
const applyHolidayAction = (date: Date, action: string): Date => {
  if (action === 'none') return date;

  const dayOfWeek = date.getDay(); // 0:日, 6:土
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  if (!isWeekend) return date;

  const newDate = new Date(date);
  if (action === 'before') {
    // 前倒し（金曜まで戻る）
    newDate.setDate(newDate.getDate() - (dayOfWeek === 0 ? 2 : 1));
  } else if (action === 'after') {
    // 後倒し（月曜まで進む）
    newDate.setDate(newDate.getDate() + (dayOfWeek === 0 ? 1 : 2));
  }
  return newDate;
};


// メイン処理: 未処理の繰り返し設定をチェックして記帳する
export const processRecurringTransactions = async (uid: string) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const recurringRef = collection(db, `users/${uid}/recurring`);
  // nextDueDate が設定されている、かつ今日以前のものを取得
  // ※初回登録直後は nextDueDate が null の場合があるので、その場合は「今日」を基準に別途処理が必要ですが、
  // ここでは「nextDueDate <= 今日」のものを処理対象とします。
  // (RecurringInputScreen保存時に初期値を入れるか、ここでnullチェックするかのどちらかが必要)
  
  // クエリ簡略化のため、アプリ側で全件取得してフィルタリングします（件数が少ない想定）
  const snapshot = await getDocs(recurringRef);
  
  let createdCount = 0;

  for (const docSnap of snapshot.docs) {
    const item = docSnap.data();
    const settingId = docSnap.id;
    
    // 次回予定日が未設定なら、今回の処理対象外（または初回計算ロジックを入れる）
    // ここでは「既に予定日が入っているもの」を処理します
    let nextDue = item.nextDueDate ? item.nextDueDate.toDate() : null;

    // 初回実行：nextDueDateがない場合は、設定された「day」を見て今月分を作るか判断
    if (!nextDue) {
      // 簡易ロジック: 今月の指定日を作る
      const candidate = new Date(now.getFullYear(), now.getMonth(), item.day);
      if (candidate <= now) {
         nextDue = candidate; // 今月の予定日が過ぎていれば今日処理する
      } else {
         // まだ来ていないなら、DBに次回の予定日としてセットして終了
         await updateDoc(doc(db, `users/${uid}/recurring`, settingId), {
            nextDueDate: candidate
         });
         continue;
      }
    }

    // 予定日が今日以前なら記帳実行
    if (nextDue <= now) {
      // 1. トランザクション作成
      // 休日設定を適用した日付を計算（記帳日）
      const recordDate = applyHolidayAction(nextDue, item.holidayAction || 'none');

      await addDoc(collection(db, `users/${uid}/transactions`), {
        type: 'expense', // 今は支出のみ対応
        date: recordDate,
        amount: item.amount,
        categoryId: item.categoryId,
        subCategory: item.subCategory || null,
        sourceAccountId: item.sourceAccountId,
        memo: '自動入力', // 自動入力とわかるように
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 2. 次回の予定日を計算して更新
      // 休日ずらしに関係なく、「本来の予定日」を基準に次を計算する
      const newNextDue = calculateNextDate(nextDue, item.frequency, item.day);

      // 終了日が設定されていて、それを超えたら設定自体を削除または無効化？
      // ここでは次回更新だけ行います
      await updateDoc(doc(db, `users/${uid}/recurring`, settingId), {
        nextDueDate: newNextDue
      });

      createdCount++;
    }
  }

  return createdCount;
};