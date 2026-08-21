import { useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { type Href, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';
import { useLanguage } from '@/context/LanguageContext';
import type { MessageKey } from '@/lib/i18n';

const TAB_ROUTES = ['index', 'profile', 'calendar', 'chat'] as const;

const ICONS: Record<
  string,
  { outline: keyof typeof Ionicons.glyphMap; filled: keyof typeof Ionicons.glyphMap }
> = {
  index: { outline: 'home-outline', filled: 'home' },
  calendar: { outline: 'calendar-outline', filled: 'calendar' },
  chat: { outline: 'chatbubble-ellipses-outline', filled: 'chatbubble-ellipses' },
};

const LABELS: Record<
  string,
  'tabs.home' | 'tabs.calendar' | 'tabs.progress' | 'tabs.chat'
> = {
  index: 'tabs.home',
  profile: 'tabs.progress',
  calendar: 'tabs.calendar',
  chat: 'tabs.chat',
};

const QUICK_ACTIONS: {
  href: Href;
  icon: keyof typeof Ionicons.glyphMap;
  iconSize: number;
  label: MessageKey;
}[] = [
  { href: '/log-exercise', icon: 'barbell', iconSize: 36, label: 'tabs.logExercise' },
  { href: '/saved-foods', icon: 'bookmark', iconSize: 28, label: 'tabs.savedFoods' },
  { href: '/log-water', icon: 'water', iconSize: 28, label: 'tabs.logWater' },
  { href: '/analyze', icon: 'scan', iconSize: 28, label: 'tabs.scanFood' },
];

function TabItem({
  routeName,
  focused,
  onPress,
  onLongPress,
}: {
  routeName: string;
  focused: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const { t } = useLanguage();
  const color = focused ? colors.tabActive : colors.tabInactive;
  const icons = ICONS[routeName];
  const icon = focused
    ? (icons?.filled ?? 'ellipse')
    : (icons?.outline ?? 'ellipse-outline');

  const label = LABELS[routeName] ? t(LABELS[routeName]) : routeName;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={focused ? { selected: true } : {}}
      accessibilityLabel={label}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.tab,
        focused && styles.tabActive,
        pressed && styles.tabPressed,
      ]}
    >
      {routeName === 'profile' ? (
        <View style={styles.progressIcon} accessibilityLabel={t('tabs.progressChart')}>
          {[8, 13, 18].map((height) => (
            <View
              key={height}
              style={[
                styles.progressBar,
                {
                  height,
                  backgroundColor: focused ? color : 'transparent',
                  borderColor: color,
                  borderWidth: focused ? 0 : 1.5,
                },
              ]}
            />
          ))}
        </View>
      ) : (
        <Ionicons name={icon} size={22} color={color} />
      )}
      <Text style={[styles.label, { color }]}>{label}</Text>
    </Pressable>
  );
}

export function AppTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuProgress = useRef(new Animated.Value(0)).current;
  const bottomPad = Math.max(insets.bottom, 12);

  function setMenu(next: boolean) {
    setMenuOpen(next);
    Animated.timing(menuProgress, {
      toValue: next ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }

  function openAction(href: Href) {
    setMenu(false);
    router.push(href);
  }

  function renderTab(routeName: string) {
    const route = state.routes.find((item) => item.name === routeName);
    if (!route) return null;

    const index = state.routes.findIndex((item) => item.key === route.key);
    const focused = state.index === index;

    const onPress = () => {
      if (menuOpen) setMenu(false);
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      if (!focused && !event.defaultPrevented) {
        navigation.navigate(route.name, route.params);
      }
    };

    const onLongPress = () => {
      navigation.emit({
        type: 'tabLongPress',
        target: route.key,
      });
    };

    return (
      <TabItem
        key={route.key}
        routeName={route.name}
        focused={focused}
        onPress={onPress}
        onLongPress={onLongPress}
      />
    );
  }

  return (
    <View pointerEvents="box-none" style={styles.screen}>
      <View
        pointerEvents="box-none"
        style={[styles.container, { paddingBottom: bottomPad }]}
      >
        <View style={styles.row}>
          <View style={styles.bar}>{TAB_ROUTES.map(renderTab)}</View>
          <View style={styles.plusSpacer} />
        </View>
      </View>

      <Animated.View
        pointerEvents={menuOpen ? 'auto' : 'none'}
        style={[styles.backdrop, { opacity: menuProgress }]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('tabs.closeQuickAdd')}
          onPress={() => setMenu(false)}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <Animated.View
        pointerEvents={menuOpen ? 'box-none' : 'none'}
        style={[
          styles.gridWrap,
          {
            bottom: 68 + bottomPad + 20,
            opacity: menuProgress,
            transform: [
              {
                translateY: menuProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [12, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.grid}>
          {QUICK_ACTIONS.map((action) => (
            <Pressable
              key={action.label}
              accessibilityRole="button"
              accessibilityLabel={t(action.label)}
              onPress={() => openAction(action.href)}
              style={({ pressed }) => [styles.actionCard, pressed && styles.actionCardPressed]}
            >
              <View style={styles.actionIconWrap}>
                <Ionicons
                  name={action.icon}
                  size={action.iconSize}
                  color={colors.text}
                />
              </View>
              <Text style={styles.actionLabel}>{t(action.label)}</Text>
            </Pressable>
          ))}
        </View>
      </Animated.View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          menuOpen ? t('tabs.closeQuickAdd') : t('tabs.quickAdd')
        }
        hitSlop={8}
        onPress={() => setMenu(!menuOpen)}
        style={[styles.plusWrap, { bottom: bottomPad + 4 }]}
      >
        <View style={styles.plusButton}>
          <Animated.View
            style={{
              transform: [
                {
                  rotate: menuProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '45deg'],
                  }),
                },
              ],
            }}
          >
            <Ionicons name="add" size={30} color={colors.buttonPrimaryText} />
          </Animated.View>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.38)',
  },
  gridWrap: {
    position: 'absolute',
    right: 16,
    left: 16,
    alignItems: 'center',
  },
  grid: {
    width: 328,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  actionCard: {
    width: 158,
    height: 92,
    borderRadius: 22,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingTop: 6,
    paddingBottom: 10,
    paddingHorizontal: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 6,
  },
  actionCardPressed: {
    opacity: 0.86,
  },
  actionIconWrap: {
    height: 36,
    marginTop: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: -2,
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 10,
    transform: [{ translateY: 8 }],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bar: {
    flex: 1,
    height: 68,
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: colors.background,
    borderColor: 'rgba(17, 17, 17, 0.07)',
    borderWidth: 1,
    borderRadius: 34,
    paddingHorizontal: 3,
    paddingVertical: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: 31,
  },
  tabActive: {
    backgroundColor: colors.surface,
  },
  tabPressed: {
    opacity: 0.62,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
  },
  progressIcon: {
    height: 22,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  progressBar: {
    width: 6,
    borderRadius: 2,
  },
  plusSpacer: {
    width: 60,
  },
  plusWrap: {
    position: 'absolute',
    right: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 32,
    zIndex: 30,
    transform: [{ translateY: 8 }],
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.22,
        shadowRadius: 10,
      },
      android: { elevation: 12 },
      default: {},
    }),
  },
  plusButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.buttonPrimaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
