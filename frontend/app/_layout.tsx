import '@/global.css';

import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as React from 'react';
import { View, StyleSheet } from 'react-native';
import AnimatedSplashScreen from '@/components/AnimatedSplashScreen';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [isAppReady, setIsAppReady] = React.useState(false);
  const [isSplashVideoFinished, setIsSplashVideoFinished] = React.useState(false);

  React.useEffect(() => {
    async function prepare() {
      try {
        // Reduced initial delay as the video splash will handle the reveals
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (e) {
        console.warn(e);
      } finally {
        setIsAppReady(true);
      }
    }
    prepare();
  }, []);

  React.useEffect(() => {
    if (isAppReady) {
      SplashScreen.hideAsync();
    }
  }, [isAppReady]);

  if (!isAppReady) return null;

  return (
    <View style={{ flex: 1, backgroundColor: '#050F2C' }}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
      {!isSplashVideoFinished && (
        <AnimatedSplashScreen onFinish={() => setIsSplashVideoFinished(true)} />
      )}
    </View>
  );
}
