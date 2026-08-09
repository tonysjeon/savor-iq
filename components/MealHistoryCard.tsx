import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { AvocadoIcon } from '@/components/AvocadoIcon';
import { colors } from '@/constants/theme';
import type { SavedNutrition } from '@/lib/firestore';

type MealHistoryCardProps = {
  item: SavedNutrition;
  onPress: () => void;
  style?: ViewStyle;
};

function formatMealTime(createdAt: number | null): string {
  if (createdAt == null) return '';
  return new Date(createdAt).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function MealHistoryCard({ item, onPress, style }: MealHistoryCardProps) {
  const timeLabel = formatMealTime(item.createdAt);

  return (
    <Pressable
      style={[styles.card, style]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open nutrition for ${item.foodName}`}
    >
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbFallback]}>
          <Ionicons name="restaurant-outline" size={28} color={colors.textMuted} />
        </View>
      )}
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {item.foodName}
          </Text>
          {timeLabel ? <Text style={styles.time}>{timeLabel}</Text> : null}
        </View>
        <View style={styles.calorieRow}>
          <Ionicons name="flame" size={18} color={colors.text} />
          <Text style={styles.calories}>{Math.round(item.calories)} calories</Text>
        </View>
        <View style={styles.macroRow}>
          <View style={styles.macro}>
            <MaterialCommunityIcons name="food-drumstick" size={16} color="#E57373" />
            <Text style={styles.macroText}>{Math.round(item.macros.protein)}g</Text>
          </View>
          <View style={styles.macro}>
            <MaterialCommunityIcons name="barley" size={16} color="#FFA726" />
            <Text style={styles.macroText}>{Math.round(item.macros.carbs)}g</Text>
          </View>
          <View style={styles.macro}>
            <AvocadoIcon size={16} color="#66BB6A" />
            <Text style={styles.macroText}>{Math.round(item.macros.fat)}g</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    flexDirection: 'row',
    overflow: 'hidden',
    height: 120,
  },
  thumb: {
    width: 108,
    height: 120,
    backgroundColor: colors.surfaceElevated,
  },
  thumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'center',
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: '500',
  },
  time: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  calorieRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  calories: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
    marginLeft: -2,
  },
  macroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  macro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  macroText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '400',
  },
});
