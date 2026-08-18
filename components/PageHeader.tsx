import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';

import { colors } from '@/constants/theme';

export function PageHeader({ title, showIcon = false }: { title: string; showIcon?: boolean }) {
  return (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        {showIcon ? <Ionicons name="restaurant" size={28} color={colors.text} /> : null}
        <Text style={styles.title}>{title}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open profile"
        onPress={() => router.push('/account' as Href)}
        style={styles.settingsButton}
      >
        <Ionicons name="person-circle-outline" size={25} color={colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '500',
    letterSpacing: -0.5,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  settingsButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ECECEC',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
