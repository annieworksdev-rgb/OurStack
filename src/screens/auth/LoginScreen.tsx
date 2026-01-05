import React, { useState } from 'react';
import { View, TextInput, Button, Text, StyleSheet, Alert } from 'react-native';
import { login, signUp } from '../../services/firebase/auth';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(true); // ログインor登録切り替え

  const handleAuth = async () => {
    if (!email || !pass) return;

    const result = isLoginMode 
      ? await login(email, pass) 
      : await signUp(email, pass);

    if (result.error) {
      Alert.alert('エラー', result.error);
    } else {
      // 成功時はAppNavigator側で自動的に画面が切り替わります（onAuthStateChanged）
      console.log('Auth Success:', result.user?.uid);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{isLoginMode ? 'ログイン' : '新規登録'}</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={pass}
        onChangeText={setPass}
        secureTextEntry
      />

      <View style={styles.btnContainer}>
        <Button title={isLoginMode ? "ログイン実行" : "登録実行"} onPress={handleAuth} />
      </View>

      <Button 
        title={isLoginMode ? "新規登録はこちら" : "ログインに戻る"} 
        color="#666" // グレーにしてサブボタンっぽくする
        onPress={() => setIsLoginMode(!isLoginMode)} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  title: { fontSize: 24, marginBottom: 20, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, marginBottom: 10, borderRadius: 5 },
  btnContainer: { marginBottom: 20 }
});