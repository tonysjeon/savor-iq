import { Redirect, router, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/context/AuthContext';
import { colors } from '@/constants/theme';
import { PageHeader } from '@/components/PageHeader';

function formatWeightLbs(weightKg?: number | null) {
  if (weightKg == null || Number.isNaN(weightKg)) return '—';
  return `${Math.round(weightKg * 2.2046226218)} lbs`;
}

function bmiStatus(bmi?: number | null) {
  if (bmi == null || Number.isNaN(bmi)) return { label: 'Unavailable', color: '#7D7D7D', tint: '#EEEEEE' };
  if (bmi < 18.5) return { label: 'Underweight', color: '#5D8FD8', tint: '#EAF1FC' };
  if (bmi < 25) return { label: 'Healthy', color: '#20A66A', tint: '#E7F6EF' };
  if (bmi < 30) return { label: 'Overweight', color: '#DDAA59', tint: '#FBF2E3' };
  return { label: 'Obese', color: '#D95F63', tint: '#FBEAEC' };
}

export default function ProfileScreen() {
  const { user, profile, loading } = useAuth();
  const insets = useSafeAreaInsets();
  const bmi = profile?.recommendation?.bmi;
  const onboarding = profile?.onboarding;
  const currentWeight = formatWeightLbs(onboarding?.weightKg);
  const goalWeight = formatWeightLbs(onboarding?.targetWeightKg ?? onboarding?.weightKg);
  const status = bmiStatus(bmi);
  const markerPosition = bmi == null ? 0 : Math.min(100, Math.max(0, ((bmi - 10) / 30) * 100));

  if (!loading && !user) {
    return <Redirect href={'/onboarding' as Href} />;
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
    >
      <PageHeader title="Progress" />

      <View style={styles.weightCard}>
        <View style={styles.weightHeadingRow}>
          <View>
            <Text style={styles.weightLabel}>Current Weight</Text>
            <Text style={styles.currentWeight}>{currentWeight}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Log weight"
            style={styles.logWeightButton}
          >
            <Text style={styles.logWeightText}>Log weight</Text>
            <Ionicons name="arrow-forward" size={15} color={colors.buttonPrimaryText} />
          </Pressable>
        </View>
        <View style={styles.weightTrack} />
        <View style={styles.weightRangeRow}>
          <Text style={styles.weightRangeLabel}>
            Start: <Text style={styles.weightRangeValue}>{currentWeight}</Text>
          </Text>
          <Text style={styles.weightRangeLabel}>
            Goal: <Text style={styles.weightRangeValue}>{goalWeight}</Text>
          </Text>
        </View>
      </View>

      <View style={styles.bmiCard}>
        <View style={styles.bmiHeadingRow}>
          <Text style={styles.bmiTitle}>Your BMI</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="BMI information"
            onPress={() => router.push('/bmi-info' as Href)}
            hitSlop={10}
          >
            <Ionicons name="help-circle-outline" size={18} color="#7D7D7D" />
          </Pressable>
        </View>
        <View style={styles.bmiValueRow}>
          <Text style={styles.bmiValue}>{bmi != null ? bmi.toFixed(1) : '—'}</Text>
          <Text style={styles.bmiMessage}>Your weight is</Text>
          <View style={[styles.statusPill, { backgroundColor: status.tint }]}>
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>
        <View style={styles.bmiBarWrap}>
          <View style={[styles.bmiSegment, styles.bmiSegmentFirst, { backgroundColor: '#6595D8' }]} />
          <View style={[styles.bmiSegment, { backgroundColor: '#20A66A' }]} />
          <View style={[styles.bmiSegment, { backgroundColor: '#E3B66F' }]} />
          <View style={[styles.bmiSegment, styles.bmiSegmentLast, { backgroundColor: '#D96367' }]} />
          {bmi != null ? <View style={[styles.bmiMarker, { left: `${markerPosition}%` }]} /> : null}
        </View>
        <View style={styles.bmiLegend}>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#6595D8' }]} /><Text style={styles.legendText}>Underweight{`\n`}{'<18.5'}</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#20A66A' }]} /><Text style={styles.legendText}>Healthy{`\n`}18.5–24.9</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#E3B66F' }]} /><Text style={styles.legendText}>Overweight{`\n`}25.0–29.9</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#D96367' }]} /><Text style={styles.legendText}>Obese{`\n`}{'>30.0'}</Text></View>
        </View>
      </View>

      <Text style={styles.emptyProgress}>Keep logging meals to see your progress here.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.page,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
    backgroundColor: colors.page,
  },
  weightCard: {
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 20,
    marginBottom: 20,
  },
  weightHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weightLabel: {
    color: 'rgba(17, 17, 17, 0.58)',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  currentWeight: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '600',
    marginTop: 4,
  },
  logWeightButton: {
    minHeight: 32,
    borderRadius: 16,
    backgroundColor: colors.buttonPrimaryBg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    transform: [{ translateY: -3 }],
  },
  logWeightText: {
    color: colors.buttonPrimaryText,
    fontSize: 13,
    fontWeight: '600',
  },
  weightTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.text,
    marginTop: 18,
  },
  weightRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  weightRangeLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  weightRangeValue: {
    color: colors.text,
    fontWeight: '600',
  },
  bmiCard: {
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 20,
    marginBottom: 20,
  },
  bmiHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bmiTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '500',
  },
  bmiValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 14,
  },
  bmiValue: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '700',
  },
  bmiMessage: {
    color: '#7D7D7D',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 28,
  },
  statusPill: {
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 3,
    transform: [{ translateY: -4 }],
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  bmiBarWrap: {
    height: 8,
    flexDirection: 'row',
    marginTop: 10,
    position: 'relative',
  },
  bmiSegment: {
    flex: 1,
    borderRightWidth: 0.5,
    borderRightColor: colors.card,
  },
  bmiSegmentFirst: {
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
  },
  bmiSegmentLast: {
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    borderRightWidth: 0,
  },
  bmiMarker: {
    position: 'absolute',
    top: -4,
    width: 2,
    height: 14,
    marginLeft: -1,
    borderRadius: 1.5,
    backgroundColor: colors.text,
  },
  bmiLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  legendItem: {
    flex: 1,
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 3,
  },
  legendText: {
    color: '#7D7D7D',
    fontSize: 9,
    lineHeight: 12,
    textAlign: 'center',
  },
  settingsButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyProgress: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    paddingTop: 92,
    paddingRight: 24,
  },
  settingsMenu: {
    width: 190,
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
  },
  menuTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  menuItem: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  menuText: {
    color: colors.text,
    fontSize: 16,
  },
  deleteText: {
    color: '#B42318',
    fontSize: 16,
  },
});
