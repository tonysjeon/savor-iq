import { Stack } from 'expo-router';

import { colors } from '@/constants/theme';

export default function AnalyzeLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '600' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen
        name="index"
        options={{ title: 'Analyze', headerShown: false }}
      />
      <Stack.Screen
        name="confirm"
        options={{
          title: 'Confirm photo',
          headerBackButtonDisplayMode: 'minimal',
        }}
      />
      <Stack.Screen
        name="processing"
        options={{
          title: 'Analyzing',
          headerBackVisible: false,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="result"
        options={{
          title: 'Results',
          headerBackVisible: false,
          gestureEnabled: false,
        }}
      />
    </Stack>
  );
}
