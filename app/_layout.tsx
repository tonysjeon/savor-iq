import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider } from '@/context/AuthContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { colors } from '@/constants/theme';

export default function RootLayout() {
  return (
    <LanguageProvider>
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '600' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="analyze"
          options={{
            headerShown: false,
            presentation: 'transparentModal',
            animation: 'none',
            gestureEnabled: false,
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
        <Stack.Screen name="account" options={{ headerShown: false }} />
        <Stack.Screen name="log-water" options={{ headerShown: false }} />
        <Stack.Screen name="log-exercise" options={{ headerShown: false }} />
        <Stack.Screen name="saved-foods" options={{ headerShown: false }} />
        <Stack.Screen name="bmi-info" options={{ headerShown: false }} />
        <Stack.Screen name="meal/[id]" options={{ headerShown: false }} />
      </Stack>
    </AuthProvider>
    </LanguageProvider>
  );
}
