import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';
import { useLanguage } from '@/context/LanguageContext';
import { LANGUAGE_NATIVE_NAMES, type LanguageId } from '@/lib/i18n';

export const LANGUAGES = [
  { id: 'en' as const, flag: '🇺🇸' },
  { id: 'fr' as const, flag: '🇫🇷' },
  { id: 'es' as const, flag: '🇪🇸' },
  { id: 'ko' as const, flag: '🇰🇷' },
  { id: 'it' as const, flag: '🇮🇹' },
];

export function LanguageSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { language: selectedId, setLanguage, t } = useLanguage();
  const insets = useSafeAreaInsets();
  const screenHeight = Dimensions.get('window').height;
  const translateY = useRef(new Animated.Value(screenHeight)).current;
  const [mounted, setMounted] = useState(visible);
  const dismissThreshold = Math.min(140, screenHeight * 0.18);

  const scrimOpacity = translateY.interpolate({
    inputRange: [0, screenHeight],
    outputRange: [0.4, 0],
    extrapolate: 'clamp',
  });

  function animateClose(releaseVelocity = 0) {
    Animated.spring(translateY, {
      toValue: screenHeight,
      velocity: Math.max(0, releaseVelocity),
      damping: 30,
      stiffness: 105,
      mass: 1,
      overshootClamping: true,
      restDisplacementThreshold: 0.5,
      restSpeedThreshold: 0.5,
      useNativeDriver: true,
    }).start(() => {
      setTimeout(() => {
        setMounted(false);
        onClose();
      }, 72);
    });
  }

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.dy > 3 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          gesture.dy > 3 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderMove: (_, gesture) => translateY.setValue(Math.max(0, gesture.dy)),
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy >= dismissThreshold) {
            animateClose(gesture.vy);
            return;
          }
          Animated.spring(translateY, {
            toValue: 0,
            damping: 22,
            stiffness: 240,
            mass: 0.8,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateY, {
            toValue: 0,
            damping: 22,
            stiffness: 240,
            mass: 0.8,
            useNativeDriver: true,
          }).start();
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dismissThreshold, translateY],
  );

  useEffect(() => {
    if (!visible) return;
    setMounted(true);
    translateY.setValue(screenHeight);
    Animated.timing(translateY, {
      toValue: 0,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [screenHeight, translateY, visible]);

  async function selectLanguage(id: LanguageId) {
    await setLanguage(id);
    animateClose();
  }

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={() => animateClose()}>
      <View style={styles.root}>
        <Animated.View pointerEvents="none" style={[styles.backdrop, { opacity: scrimOpacity }]} />
        <Pressable style={StyleSheet.absoluteFill} onPress={() => animateClose()} />
        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, 16), transform: [{ translateY }] },
          ]}
        >
          <View style={styles.handleArea} {...panResponder.panHandlers}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <Text style={styles.title}>{t('account.languageTitle')}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
                hitSlop={8}
                onPress={() => animateClose()}
                style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
              >
                <Ionicons name="close" size={18} color={colors.text} />
              </Pressable>
            </View>
          </View>

          {LANGUAGES.map((language, index) => {
            const selected = language.id === selectedId;
            return (
              <View key={language.id}>
                {index > 0 ? <View style={styles.divider} /> : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => selectLanguage(language.id)}
                  style={styles.row}
                >
                  <Text style={styles.flag}>{language.flag}</Text>
                  <Text style={styles.label}>{LANGUAGE_NATIVE_NAMES[language.id]}</Text>
                  {selected ? (
                    <View style={styles.check}>
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    </View>
                  ) : null}
                </Pressable>
              </View>
            );
          })}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  handleArea: {
    paddingBottom: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D8D8D8',
    marginBottom: 14,
  },
  headerRow: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EFEFEF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonPressed: {
    opacity: 0.72,
  },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
  },
  flag: {
    fontSize: 22,
    width: 32,
  },
  label: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
});
