import { useEffect, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { router, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExerciseOptionIcon } from '@/components/ExerciseOptionIcon';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { enqueueExerciseEstimate } from '@/lib/exerciseEstimateQueue';
import { isGeminiConfigured } from '@/lib/gemini';

function AiSparklesIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        d="M8.4 2.2 L10.15 8.05 L16 9.8 L10.15 11.55 L8.4 17.4 L6.65 11.55 L0.8 9.8 L6.65 8.05 Z"
        fill={colors.text}
      />
      <Path
        d="M18.15 1.9 L18.95 4.7 L21.75 5.5 L18.95 6.3 L18.15 9.1 L17.35 6.3 L14.55 5.5 L17.35 4.7 Z"
        fill={colors.text}
      />
      <Path
        d="M19.7 12.05 L20.35 14.25 L22.55 14.9 L20.35 15.55 L19.7 17.75 L19.05 15.55 L16.85 14.9 L19.05 14.25 Z"
        fill={colors.text}
      />
    </Svg>
  );
}

export default function LogDescribeScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [description, setDescription] = useState('');
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const canAdd = description.trim().length > 0;

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardOpen(true),
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardOpen(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  function addExercise() {
    if (!canAdd) return;
    Keyboard.dismiss();

    if (!isGeminiConfigured) {
      Alert.alert(t('analyze.geminiMissingTitle'), t('analyze.geminiMissingBody'));
      return;
    }

    enqueueExerciseEstimate({
      description,
      userId: user?.uid ?? null,
    });
    if (router.canDismiss()) {
      router.dismissTo('/(tabs)' as Href);
    } else {
      router.replace('/(tabs)' as Href);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top + 8 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.pagePad}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            hitSlop={8}
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <View style={styles.titleRow}>
            <ExerciseOptionIcon id="describe" size={22} />
            <Text style={styles.pageTitle}>{t('exercise.describeTitle')}</Text>
          </View>
        </View>

        <TextInput
          accessibilityLabel={t('exercise.describePlaceholder')}
          autoFocus
          placeholder={t('exercise.describePlaceholder')}
          placeholderTextColor="rgba(17, 17, 17, 0.32)"
          returnKeyType="done"
          value={description}
          onChangeText={setDescription}
          style={styles.input}
        />

        <View style={styles.aiBadge}>
          <AiSparklesIcon />
          <Text style={styles.aiBadgeText}>{t('exercise.createdByAi')}</Text>
        </View>

        <View style={styles.exampleCard}>
          <Text style={styles.exampleText}>
            <Text style={styles.exampleLabel}>{t('exercise.example')}: </Text>
            {t('exercise.describeExample')}
          </Text>
        </View>
      </View>

      <View style={[styles.footerBar, { paddingBottom: keyboardOpen ? 12 : Math.max(insets.bottom, 12) }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('exercise.add')}
          disabled={!canAdd}
          onPress={addExercise}
          style={[styles.addButton, !canAdd && styles.addButtonDisabled]}
        >
          <Text style={styles.addButtonText}>{t('exercise.add')}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  pagePad: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    position: 'relative',
    marginBottom: 48,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pageTitle: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '400',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8E9F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonPressed: {
    opacity: 0.72,
  },
  input: {
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.text,
    paddingHorizontal: 16,
    paddingVertical: 0,
    color: colors.text,
    fontSize: 18,
    fontWeight: '400',
  },
  aiBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 28,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.background,
  },
  aiBadgeText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  exampleCard: {
    marginTop: 32,
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  exampleText: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '400',
  },
  exampleLabel: {
    fontWeight: '700',
  },
  footerBar: {
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E0E0E0',
    paddingTop: 12,
  },
  addButton: {
    marginHorizontal: 20,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.buttonPrimaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: {
    backgroundColor: '#C8C8C8',
  },
  addButtonText: {
    color: colors.buttonPrimaryText,
    fontSize: 17,
    fontWeight: '600',
  },
});
