import Svg, { Ellipse, Path } from 'react-native-svg';

import { colors } from '@/constants/theme';

type AvocadoIconProps = {
  size?: number;
  color: string;
  /** Pit cutout fill — defaults to card surface. */
  pitColor?: string;
};

/** Pear-shaped avocado half (narrow top, wide bottom) for fat macros. */
export function AvocadoIcon({
  size = 16,
  color,
  pitColor = colors.card,
}: AvocadoIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" pointerEvents="none">
      <Path
        d="M12 1.4c-1.9 0-3.35 1.55-3.65 3.7-.5 3.55-2.85 5.85-2.85 10.05C5.5 19.55 8.35 22.6 12 22.6s6.5-3.05 6.5-7.45c0-4.2-2.35-6.5-2.85-10.05C15.35 2.95 13.9 1.4 12 1.4z"
        fill={color}
      />
      <Ellipse cx="12" cy="15.85" rx="3.05" ry="3.05" fill={pitColor} />
    </Svg>
  );
}
