import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { type Href, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';

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
  profile: { outline: 'person-outline', filled: 'person' },
};

const LABELS: Record<string, string> = {
  index: 'Home',
  chat: 'Chat',
  calendar: 'Calendar',
  profile: 'Profile',
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
  const color = focused ? colors.tabActive : colors.tabInactive;
  const icons = ICONS[routeName];
  const icon = focused
    ? (icons?.filled ?? 'ellipse')
    : (icons?.outline ?? 'ellipse-outline');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={focused ? { selected: true } : {}}
      accessibilityLabel={LABELS[routeName] ?? routeName}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.tab}
    >
      <Ionicons name={icon} size={24} color={color} />
      <Text style={[styles.label, { color }]}>{LABELS[routeName] ?? routeName}</Text>
    </Pressable>
  );
}

export function AppTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

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
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.side}>{LEFT_ROUTES.map(renderTab)}</View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Analyze meal"
        onPress={() => router.push(ANALYZE_HREF)}
        style={styles.plusWrap}
      >
        <View style={styles.plusButton}>
          <Ionicons name="add" size={32} color={colors.buttonPrimaryText} />
        </View>
      </Pressable>

      <View style={styles.side}>{RIGHT_ROUTES.map(renderTab)}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.background,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop: 8,
    paddingHorizontal: 8,
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
    paddingVertical: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
  },
  plusWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
    marginTop: -22,
  },
  plusButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.buttonPrimaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.background,
  },
});
