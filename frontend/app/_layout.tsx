import '@/global.css';

import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as React from 'react';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setReady(true), 900);
    return () => clearTimeout(timer);
  }, []);

  React.useEffect(() => {
    if (!ready) return;
    SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
