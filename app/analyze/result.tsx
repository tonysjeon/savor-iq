import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { NutritionCard } from '@/components/NutritionCard';
import { colors } from '@/constants/theme';
import {
  clearAnalyzeSession,
  getAnalyzeSession,
  type AnalyzeSession,
} from '@/lib/analyzeSession';

export default function AnalyzeResultScreen() {
  const [session, setSession] = useState<AnalyzeSession | null>(null);

  useEffect(() => {
    const current = getAnalyzeSession();
    if (!current?.nutrition) {
      router.replace('/(tabs)');
      return;
    }
    setSession(current);
  }, []);

  function done() {
    clearAnalyzeSession();
    router.replace('/(tabs)');
  }

  if (!session?.nutrition) {
    return <View style={styles.flex} />;
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Image source={{ uri: session.photo.uri }} style={styles.photo} />

      {session.saveWarning ? (
        <Text style={styles.warning}>{session.saveWarning}</Text>
      ) : null}

      <NutritionCard info={session.nutrition} />

      <Pressable style={styles.primaryButton} onPress={done}>
        <Ionicons name="checkmark" size={18} color={colors.buttonPrimaryText} />
        <Text style={styles.primaryButtonText}>Done</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  photo: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  warning: {
    color: '#FFB74D',
    fontSize: 13,
    lineHeight: 18,
  },
  primaryButton: {
    backgroundColor: colors.buttonPrimaryBg,
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  primaryButtonText: {
    color: colors.buttonPrimaryText,
    fontSize: 15,
    fontWeight: '600',
  },
});
