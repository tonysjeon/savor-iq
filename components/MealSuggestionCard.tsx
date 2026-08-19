import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AvocadoIcon } from '@/components/AvocadoIcon';
import { colors } from '@/constants/theme';
import { useLanguage } from '@/context/LanguageContext';
import type { MealSuggestion } from '@/types/mealSuggestion';

type MealSuggestionCardProps = {
  suggestion: MealSuggestion;
  /** Calories still available today after this suggestion is eaten. */
  caloriesLeftAfter: number;
  selectable?: boolean;
  selected?: boolean;
  confirming?: boolean;
  dimmed?: boolean;
  onSelect?: () => void;
  onConfirm?: () => void;
  onCancel?: () => void;
};

export function MealSuggestionCard({
  suggestion,
  selectable = false,
  selected = false,
  confirming = false,
  dimmed = false,
  onSelect,
  onConfirm,
  onCancel,
}: MealSuggestionCardProps) {
  const { t } = useLanguage();

  return (
    <View
      style={[
        styles.card,
        (selected || confirming) && styles.cardSelected,
        dimmed && styles.cardDimmed,
      ]}
    >
      <View style={styles.cardClip}>
      <Pressable
        onPress={selectable && !confirming ? onSelect : undefined}
        disabled={!selectable || confirming}
        style={styles.cardBody}
      >
      <View style={styles.headerRow}>
        <Text style={styles.title} numberOfLines={2}>
          {suggestion.title}
        </Text>
      </View>

      {suggestion.reason ? (
        <Text style={styles.reason}>
          {suggestion.reason}
        </Text>
      ) : null}

      <View style={styles.macroRow}>
        <View style={styles.macro}>
          <Ionicons name="flame" size={14} color={colors.text} />
          <Text style={styles.macroValue}>{suggestion.calories}</Text>
          <Text style={styles.macroLabel}>{t('suggestion.calories')}</Text>
        </View>
        <View style={styles.macro}>
          <MaterialCommunityIcons
            name="food-drumstick"
            size={14}
            color="#E57373"
          />
          <Text style={styles.macroValue}>{suggestion.proteinGrams}g</Text>
          <Text style={styles.macroLabel}>{t('home.protein')}</Text>
        </View>
        <View style={styles.macro}>
          <MaterialCommunityIcons name="barley" size={14} color="#FFA726" />
          <Text style={styles.macroValue}>{suggestion.carbsGrams}g</Text>
          <Text style={styles.macroLabel}>{t('home.carbs')}</Text>
        </View>
        <View style={styles.macro}>
          <AvocadoIcon size={14} color="#66BB6A" />
          <Text style={styles.macroValue}>{suggestion.fatGrams}g</Text>
          <Text style={styles.macroLabel}>{t('home.fat')}</Text>
        </View>
      </View>
      </Pressable>

      {confirming ? (
        <View style={styles.confirmOverlay}>
          <Pressable style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
          </Pressable>
          <Pressable style={styles.confirmButton} onPress={onConfirm}>
            <Text style={styles.confirmButtonText}>{t('suggestion.confirm')}</Text>
          </Pressable>
        </View>
      ) : null}
      {selected ? (
        <View pointerEvents="none" style={styles.innerHighlight} />
      ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
  },
  cardClip: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  cardBody: {
    padding: 16,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: -0.3,
    lineHeight: 21,
  },
  reason: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    flexShrink: 0,
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.page,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  macro: {
    flexGrow: 1,
    flexBasis: 0,
    maxWidth: 70,
    alignItems: 'center',
    gap: 1,
  },
  macroValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  macroLabel: {
    color: colors.textMuted,
    fontSize: 10,
  },
  cardSelected: {
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  innerHighlight: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.text,
  },
  cardDimmed: {
    opacity: 0.5,
  },
  confirmOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  cancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  cancelButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  confirmButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.buttonPrimaryBg,
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  confirmButtonText: {
    color: colors.buttonPrimaryText,
    fontSize: 15,
    fontWeight: '500',
  },
});
