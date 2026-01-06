/**
 * アプリ全体のカラーパレット定義
 * C#のResourceDictionaryのような役割です
 */

const tintColorLight = '#2f95dc'; // アプリのテーマカラー（ライト）
const tintColorDark = '#fff';    // アプリのテーマカラー（ダーク）

export const Colors = {
  light: {
    text: '#000',
    textSub: '#666',
    background: '#f5f5f5', // 全体の背景（薄いグレー）
    card: '#fff',          // リストや入力フォームの背景
    tint: tintColorLight,  // アクセントカラー
    tabIconDefault: '#ccc',
    tabIconSelected: tintColorLight,
    border: '#ddd',
    error: 'red',
    income: 'blue',
    expense: 'red',
    placeholder: '#999',
  },
  dark: {
    text: '#fff',
    textSub: '#ccc',
    background: '#000',
    card: '#1c1c1e',       // iOSダークモード標準のカード色
    tint: tintColorDark,
    tabIconDefault: '#ccc',
    tabIconSelected: tintColorDark,
    border: '#333',
    error: '#ff453a',      // ダークモード用の少し明るい赤
    income: '#30d158',     // ダークモード用の明るい緑
    expense: '#ff453a',
    placeholder: '#666',
  },
};