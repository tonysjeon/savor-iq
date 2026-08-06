import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider } from '@/context/AuthContext';
import { colors } from '@/constants/theme';

export default function RootLayout() {
  return (
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
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="analyze"
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
            animation: 'slide_from_bottom',
            contentStyle: { backgroundColor: '#000000' },
          }}
        />
        <Stack.Screen name="about" options={{ headerShown: false }} />
      </Stack>
    </AuthProvider>
  );
}
