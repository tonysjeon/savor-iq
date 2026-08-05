import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';

export default function AboutScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Savor IQ</Text>
      <Text style={styles.version}>Version 1.0.0</Text>
      <Text style={styles.body}>
        AI-assisted recipe generation, nutrition analysis, and weekly meal
        planning — rebuilt for iOS with Expo.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '600',
    marginBottom: 8,
  },
  version: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: 20,
  },
  body: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 24,
  },
});
