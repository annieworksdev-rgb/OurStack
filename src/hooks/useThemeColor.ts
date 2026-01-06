import { useColorScheme } from 'react-native';
import { Colors } from '../constants/Colors';

export function useThemeColor() {
  // スマホの設定（ライトorダーク）を自動検知
  const theme = useColorScheme() ?? 'light'; 
  
  // 現在のモードに合った色オブジェクトを返す
  return Colors[theme];
}