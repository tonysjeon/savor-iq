import { useEffect, useId, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { colors } from '@/constants/theme';

type AnimatedNumberProps = {
  value: number;
  decimals?: number;
  suffix?: string;
  style?: StyleProp<TextStyle>;
  /** Matches the card surface so edge fades blend away. */
  fadeColor?: string;
};

type Segment = {
  key: string;
  char: string;
  animate: boolean;
};

const DIGIT_DURATION_MS = 420;

function formatValue(value: number, decimals: number): string {
  if (decimals > 0) return value.toFixed(decimals);
  return String(Math.round(value));
}

function splitFormatted(formatted: string): Segment[] {
  const dot = formatted.indexOf('.');
  if (dot === -1) {
    return formatted.split('').map((char, i, arr) => ({
      char,
      key: `i${arr.length - 1 - i}`,
      animate: char >= '0' && char <= '9',
    }));
  }

  const [intPart, fracPart] = formatted.split('.');
  const segments: Segment[] = intPart.split('').map((char, i, arr) => ({
    char,
    key: `i${arr.length - 1 - i}`,
    animate: true,
  }));
  segments.push({ char: '.', key: 'dot', animate: false });
  fracPart.split('').forEach((char, i) => {
    segments.push({ char, key: `f${i}`, animate: true });
  });
  return segments;
}

function columnMetrics(char: string, fontSize: number) {
  if (char >= '0' && char <= '9') {
    return {
      pitch: Math.max(1, Math.round(fontSize * 0.62)),
      clipWidth: Math.ceil(fontSize * 0.68),
    };
  }
  if (char === '.') {
    return {
      pitch: Math.max(1, Math.round(fontSize * 0.26)),
      clipWidth: Math.ceil(fontSize * 0.32),
    };
  }
  return {
    pitch: Math.max(1, Math.round(fontSize * 0.44)),
    clipWidth: Math.ceil(fontSize * 0.5),
  };
}

function EdgeFades({
  width,
  height,
  color,
}: {
  width: number;
  height: number;
  color: string;
}) {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const topId = `topFade${rawId}`;
  const bottomId = `bottomFade${rawId}`;
  const fade = Math.max(7, Math.round(height * 0.28));

  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width={width} height={height}>
      <Defs>
        <LinearGradient id={topId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="1" />
          <Stop offset="0.4" stopColor={color} stopOpacity="0.65" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </LinearGradient>
        <LinearGradient id={bottomId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0" />
          <Stop offset="0.6" stopColor={color} stopOpacity="0.65" />
          <Stop offset="1" stopColor={color} stopOpacity="1" />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={fade} fill={`url(#${topId})`} />
      <Rect x={0} y={height - fade} width={width} height={fade} fill={`url(#${bottomId})`} />
    </Svg>
  );
}

function DigitColumn({
  digit,
  textStyle,
  height,
  pitch,
  clipWidth,
  fadeColor,
}: {
  digit: string;
  textStyle: TextStyle;
  height: number;
  pitch: number;
  clipWidth: number;
  fadeColor: string;
}) {
  const target = Number(digit);
  const anim = useRef(new Animated.Value(target)).current;
  const mounted = useRef(false);
  const lastTarget = useRef(target);

  useEffect(() => {
    if (!mounted.current) {
      anim.setValue(target);
      mounted.current = true;
      lastTarget.current = target;
      return;
    }
    if (lastTarget.current === target) return;
    lastTarget.current = target;

    Animated.timing(anim, {
      toValue: target,
      duration: DIGIT_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [target, anim]);

  const translateY = anim.interpolate({
    inputRange: [0, 9],
    outputRange: [0, -9 * height],
  });
  const clipLeft = (pitch - clipWidth) / 2;

  return (
    <View style={{ height, width: pitch }}>
      <View
        style={{
          position: 'absolute',
          left: clipLeft,
          width: clipWidth,
          height,
          overflow: 'hidden',
        }}
      >
        <Animated.View style={{ transform: [{ translateY }] }}>
          {Array.from({ length: 10 }, (_, n) => (
            <Text
              key={n}
              style={[
                textStyle,
                {
                  width: clipWidth,
                  height,
                  lineHeight: height,
                  textAlign: 'center',
                },
              ]}
            >
              {n}
            </Text>
          ))}
        </Animated.View>
        <EdgeFades width={clipWidth} height={height} color={fadeColor} />
      </View>
    </View>
  );
}

/**
 * Odometer-style number: each digit rolls from its previous value.
 * Columns are place-keyed from the right — unchanged digits stay put.
 */
export function AnimatedNumber({
  value,
  decimals = 0,
  suffix = '',
  style,
  fadeColor = colors.card,
}: AnimatedNumberProps) {
  const formatted = formatValue(value, decimals);
  const segments = splitFormatted(formatted);
  const flat = StyleSheet.flatten(style) ?? {};
  const fontSize = typeof flat.fontSize === 'number' ? flat.fontSize : 28;
  const height =
    typeof flat.lineHeight === 'number'
      ? flat.lineHeight
      : Math.round(fontSize * 1.15);
  const textStyle: TextStyle = {
    ...flat,
    letterSpacing: 0,
    fontVariant: ['tabular-nums'],
  };

  return (
    <View style={styles.row} accessibilityLabel={`${formatted}${suffix}`}>
      {segments.map((segment) => {
        if (!segment.animate) {
          const { pitch } = columnMetrics(segment.char, fontSize);
          return (
            <View
              key={segment.key}
              style={{ width: pitch, height, justifyContent: 'center', alignItems: 'center' }}
            >
              <Text style={textStyle}>{segment.char}</Text>
            </View>
          );
        }
        const { pitch, clipWidth } = columnMetrics(segment.char, fontSize);
        return (
          <DigitColumn
            key={segment.key}
            digit={segment.char}
            textStyle={textStyle}
            height={height}
            pitch={pitch}
            clipWidth={clipWidth}
            fadeColor={fadeColor}
          />
        );
      })}
      {suffix ? (
        <Text style={[style, styles.suffix]}>{suffix}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  suffix: {
    marginLeft: -0.1,
  },
});
