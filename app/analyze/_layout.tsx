import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/constants/theme';

/** Near-full island: short of the status bar, but always edge-to-edge width + bottom. */
const SHEET_HEIGHT = '92.5%';

export default function AnalyzeLayout() {
  return (
    <View style={styles.backdrop}>
      <View style={styles.sheet}>
        <View style={styles.sheetBody}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: {
                backgroundColor: colors.background,
              },
            }}
          >
            <Stack.Screen
              name="index"
              options={{
                contentStyle: { backgroundColor: '#000000' },
                animation: 'fade',
              }}
            />
            <Stack.Screen
              name="confirm"
              options={{
                contentStyle: { backgroundColor: colors.background },
              }}
            />
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
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    height: SHEET_HEIGHT,
    width: '100%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  sheetBody: {
    flex: 1,
  },
});
