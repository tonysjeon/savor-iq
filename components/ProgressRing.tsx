import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { colors } from '@/constants/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type ProgressRingProps = {
  size: number;
  strokeWidth: number;
  progress: number;
  color: string;
  trackColor?: string;
  children?: ReactNode;
  style?: ViewStyle;
  animationDuration?: number;
  animated?: boolean;
};

export function ProgressRing({
  size,
  strokeWidth,
  progress,
  color,
  trackColor = colors.progressTrack,
  children,
  style,
  animationDuration = 500,
  animated = true,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, progress));
  // Round caps add bulk; only lift the tiniest values so they still paint.
  const minVisible = (strokeWidth / circumference) * 0.22;
  const visual = clamped > 0 ? Math.max(clamped, minVisible) : 0;
  const center = size / 2;
  const animatedProgress = useRef(new Animated.Value(visual)).current;
  const hasMounted = useRef(false);
  const lastProgress = useRef(clamped);
  const activeAnim = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    const run = (toValue: number, duration: number, easing: (value: number) => number) => {
      activeAnim.current?.stop();
      activeAnim.current = Animated.timing(animatedProgress, {
        toValue,
        duration,
        easing,
        useNativeDriver: false,
      });
      activeAnim.current.start();
    };

    if (!animated || animationDuration <= 0) {
      activeAnim.current?.stop();
      hasMounted.current = true;
      lastProgress.current = clamped;
      animatedProgress.setValue(visual);
      return;
    }

    if (!hasMounted.current) {
      // First paint: ease in from empty so initial load still feels alive.
      hasMounted.current = true;
      lastProgress.current = clamped;
      animatedProgress.setValue(0);
      run(visual, animationDuration + 100, Easing.out(Easing.cubic));
      return;
    }

    if (lastProgress.current === clamped) return;
    const from = lastProgress.current;
    lastProgress.current = clamped;

    // Ease-out crawls at the end when draining to empty; keep motion even.
    const emptying = clamped === 0 && from > 0;
    run(
      visual,
      emptying ? animationDuration * 0.76 : animationDuration,
      Easing.inOut(Easing.sin),
    );
  }, [animated, animationDuration, clamped, visual, animatedProgress]);

  const strokeDashoffset = animatedProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  // Hide only the true empty state so round caps don't leave a speck at 0.
  const strokeOpacity = animatedProgress.interpolate({
    inputRange: [0, 0.0001, 1],
    outputRange: [0, 1, 1],
  });

  return (
    <View style={[{ width: size, height: size }, style]} pointerEvents="none">
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={center}
          cy={center}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeOpacity={strokeOpacity}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      {children ? <View style={styles.center}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
