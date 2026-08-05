import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';

type OptionChipsProps<T extends string | number> = {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  formatLabel?: (value: T) => string;
};

export function OptionChips<T extends string | number>({
  label,
  options,
  value,
  onChange,
  formatLabel,
}: OptionChipsProps<T>) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {options.map((option) => {
          const selected = option === value;
          return (
            <Pressable
              key={String(option)}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => onChange(option)}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {formatLabel ? formatLabel(option) : String(option)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 14,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8,
  },
  row: {
    gap: 8,
    paddingRight: 8,
  },
  chip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipSelected: {
    backgroundColor: colors.buttonPrimaryBg,
    borderColor: colors.buttonPrimaryBg,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  chipTextSelected: {
    color: colors.buttonPrimaryText,
    fontWeight: '600',
  },
});
