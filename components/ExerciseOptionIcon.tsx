import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';

import { colors } from '@/constants/theme';

export type ExerciseOptionId = 'run' | 'weights' | 'describe' | 'manual';

export function ExerciseOptionIcon({
  id,
  size = 28,
}: {
  id: ExerciseOptionId;
  size?: number;
}) {
  if (id === 'run') {
    return <MaterialCommunityIcons name="run" size={size} color={colors.text} />;
  }
  if (id === 'weights') {
    return <Ionicons name="barbell" size={size} color={colors.text} />;
  }
  if (id === 'manual') {
    return <Ionicons name="flame" size={size - 2} color={colors.text} />;
  }
  return (
    <Svg width={size - 2} height={size - 2} viewBox="0 0 512 512">
      <Path
        d="M384 224v184a40 40 0 01-40 40H104a40 40 0 01-40-40V168a40 40 0 0140-40h167.48"
        fill="none"
        stroke={colors.text}
        strokeWidth={40}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M459.94 53.25a16.06 16.06 0 00-23.22-.56L424.35 65a8 8 0 000 11.31l11.34 11.32a8 8 0 0011.34 0l12.06-12c6.1-6.09 6.43-16.02.85-22.38zM399.34 90L218.82 271.4a40 40 0 00-10.61 17.09l-14.16 51.22a8 8 0 009.83 9.83l51.21-14.16a40 40 0 0017.09-10.6L422 112.66"
        fill="none"
        stroke={colors.text}
        strokeWidth={40}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
