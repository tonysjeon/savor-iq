import { Stack, useNavigation } from 'expo-router';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  PanResponder,
  StyleSheet,
  View,
} from 'react-native';

import { colors } from '@/constants/theme';
import { leaveAnalyze } from '@/lib/leaveAnalyze';

/** Near-full island: short of the status bar, but always edge-to-edge width + bottom. */
const SHEET_HEIGHT = '92.5%';
const SCREEN_HEIGHT = Dimensions.get('window').height;
const DISMISS_THRESHOLD = SCREEN_HEIGHT * 0.18;

export default function AnalyzeLayout() {
  const navigation = useNavigation();
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const scrimOpacity = translateY.interpolate({
    inputRange: [0, SCREEN_HEIGHT * 0.7],
    outputRange: [0.4, 0],
    extrapolate: 'clamp',
  });
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        gesture.dy > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderMove: (_, gesture) => {
        translateY.setValue(Math.max(0, gesture.dy));
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy >= DISMISS_THRESHOLD) {
          Animated.timing(translateY, {
            toValue: SCREEN_HEIGHT,
            duration: 210,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start(() => {
            // The sheet has already completed its visual dismissal. Remove the
            // route without sliding the full-screen transparent backdrop too.
            navigation.setOptions({ animation: 'none' });
            leaveAnalyze();
          });
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
  ).current;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: 0,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        // Entry is custom so the scrim stays fixed. Restore the standard
        // vertical route animation for X-button dismissal.
        navigation.setOptions({ animation: 'slide_from_bottom' });
      }
    });
  }, [navigation, translateY]);

  return (
    <View style={styles.backdrop}>
      <Animated.View
        pointerEvents="none"
        style={[styles.scrim, { opacity: scrimOpacity }]}
      />
      <Animated.View
        style={[styles.sheet, { transform: [{ translateY }] }]}
        {...panResponder.panHandlers}
      >
        <View style={styles.sheetBody}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: {
                backgroundColor: colors.background,
              },
            }}
          >
            <Stack.Screen
              name="index"
              options={{
                contentStyle: { backgroundColor: '#000000' },
                animation: 'fade',
              }}
            />
            <Stack.Screen
              name="confirm"
              options={{
                contentStyle: { backgroundColor: colors.background },
              }}
            />
            <Stack.Screen
              name="processing"
              options={{
                animation: 'none',
                gestureEnabled: false,
              }}
            />
            <Stack.Screen
              name="result"
              options={{
                animation: 'none',
                gestureEnabled: false,
              }}
            />
          </Stack>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  sheet: {
    height: SHEET_HEIGHT,
    width: '100%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  sheetBody: {
    flex: 1,
  },
});
