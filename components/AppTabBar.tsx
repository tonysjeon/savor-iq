import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { type Href, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';
import { useLanguage } from '@/context/LanguageContext';

const LEFT_ROUTES = ['index', 'chat'] as const;
const RIGHT_ROUTES = ['calendar', 'profile'] as const;
const ANALYZE_HREF = '/analyze' as Href;

const ICONS: Record<
  string,
  { outline: keyof typeof Ionicons.glyphMap; filled: keyof typeof Ionicons.glyphMap }
> = {
  index: { outline: 'home-outline', filled: 'home' },
  chat: { outline: 'chatbubble-ellipses-outline', filled: 'chatbubble-ellipses' },
  calendar: { outline: 'calendar-outline', filled: 'calendar' },
};

const LABELS: Record<string, 'tabs.home' | 'tabs.chat' | 'tabs.calendar' | 'tabs.progress'> = {
  index: 'tabs.home',
  chat: 'tabs.chat',
  calendar: 'tabs.calendar',
  profile: 'tabs.progress',
};

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

  function renderTab(routeName: string) {
    const route = state.routes.find((item) => item.name === routeName);
    if (!route) return null;

    const index = state.routes.findIndex((item) => item.key === route.key);
    const focused = state.index === index;

    const onPress = () => {
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
    <View
      pointerEvents="box-none"
      style={[styles.container, { paddingBottom: Math.max(insets.bottom, 12) }]}
    >
      <View style={styles.bar}>
        <View style={styles.side}>{LEFT_ROUTES.map(renderTab)}</View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('tabs.analyzeMeal')}
          hitSlop={8}
          onPress={() => router.push(ANALYZE_HREF)}
          style={({ pressed }) => [styles.plusWrap, pressed && styles.plusPressed]}
        >
          <View style={styles.plusButton}>
            <Ionicons name="add" size={30} color={colors.buttonPrimaryText} />
          </View>
        </Pressable>

        <View style={styles.side}>{RIGHT_ROUTES.map(renderTab)}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    paddingTop: 10,
    transform: [{ translateY: 4 }],
  },
  bar: {
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: 'rgba(17, 17, 17, 0.07)',
    borderWidth: 1,
    borderRadius: 34,
    paddingHorizontal: 5,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 10,
  },
  side: {
    flex: 1,
    flexDirection: 'row',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minHeight: 56,
    borderRadius: 28,
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
  plusWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
    borderRadius: 32,
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
  plusPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
  plusButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.buttonPrimaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 5,
    borderColor: colors.background,
  },
});
