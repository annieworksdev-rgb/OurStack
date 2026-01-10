// App.tsx
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { MasterProvider } from './src/store/MasterContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <MasterProvider>
        <AppNavigator />
      </MasterProvider>
    </GestureHandlerRootView>
  );
}