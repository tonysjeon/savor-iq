import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type ProgressRingProps = {
  size: number;
  strokeWidth: number;
  progress: number;
  color: string;
  trackColor?: string;
  children?: ReactNode;
  style?: ViewStyle;
};

export function ProgressRing({
  size,
  strokeWidth,
  progress,
  color,
  trackColor = '#E8E8E8',
  children,
  style,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, progress));
  const center = size / 2;
  const animatedProgress = useRef(new Animated.Value(clamped)).current;
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

    if (!hasMounted.current) {
      // First paint: ease in from empty so initial load still feels alive.
      hasMounted.current = true;
      lastProgress.current = clamped;
      animatedProgress.setValue(0);
      run(clamped, 700, Easing.out(Easing.cubic));
      return;
    }

    if (lastProgress.current === clamped) return;
    const from = lastProgress.current;
    lastProgress.current = clamped;

    // Ease-out crawls at the end when draining to empty; keep motion even.
    const emptying = clamped === 0 && from > 0;
    run(
      clamped,
      emptying ? 380 : 450,
      emptying ? Easing.inOut(Easing.quad) : Easing.inOut(Easing.cubic),
    );
  }, [clamped, animatedProgress]);

  const strokeDashoffset = animatedProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  // Round caps leave a visible blob near 0 — fade the stroke out with it.
  const strokeOpacity = animatedProgress.interpolate({
    inputRange: [0, 0.015, 0.04, 1],
    outputRange: [0, 0, 1, 1],
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
