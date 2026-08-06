import { Stack } from 'expo-router';

import { colors } from '@/constants/theme';

export default function AnalyzeLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          contentStyle: { backgroundColor: '#000000' },
          animation: 'none',
        }}
      />
      <Stack.Screen name="confirm" />
      <Stack.Screen
        name="processing"
        options={{
          animation: 'none',
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="result"
        options={{
          animation: 'none',
          gestureEnabled: false,
        }}
      />
    </Stack>
  );
}
