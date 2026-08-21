import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ProgressRing } from '@/components/ProgressRing';
import { colors } from '@/constants/theme';

const BASE_SIZE = 62;
const BASE_STROKE = 5;
const BASE_INNER = 24;
const BASE_FLAME = 13;
const TRACK_COLOR = '#EEF1F7';
const INNER_COLOR = '#F8F8FA';

export function CalorieFlameRing({
  size = BASE_SIZE,
  strokeWidth = BASE_STROKE,
  innerSize,
  flameSize,
}: {
  size?: number;
  strokeWidth?: number;
  innerSize?: number;
  flameSize?: number;
}) {
  const scale = size / BASE_SIZE;
  const inner = innerSize ?? Math.round(BASE_INNER * scale);
  const flame = flameSize ?? Math.max(12, Math.round(BASE_FLAME * scale));

  return (
    <ProgressRing
      size={size}
      strokeWidth={strokeWidth}
      progress={0.5}
      color={colors.text}
      trackColor={TRACK_COLOR}
      animated={false}
    >
      <View style={[styles.inner, { width: inner, height: inner, borderRadius: inner / 2 }]}>
        <Ionicons name="flame" size={flame} color={colors.text} />
      </View>
    </ProgressRing>
  );
}

const styles = StyleSheet.create({
  inner: {
    backgroundColor: INNER_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
