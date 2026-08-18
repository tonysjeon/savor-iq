import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { colors } from '@/constants/theme';

const bmiInfoText = {
  disclaimer:
    'As with most measures of health, BMI is not a perfect test. For example, results can be thrown off by pregnancy or high muscle mass, and it may not be a good measure of health for children or the elderly.',
  heading: 'So then, why does BMI matter?',
  body:
    'In general, the higher your BMI, the higher the risk of developing a range of conditions linked with excess weight, including:',
  bullets: [
    'diabetes',
    'arthritis',
    'liver disease',
    'several types of cancer (such as those of the breast, colon, and prostate)',
    'high blood pressure (hypertension)',
    'high cholesterol',
    'sleep apnea.',
  ],
};

export default function BmiInfoScreen() {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const bmi = profile?.recommendation?.bmi;
  const markerPosition = bmi == null ? 48 : Math.min(100, Math.max(0, ((bmi - 10) / 30) * 100));

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          onPress={() => router.dismissTo('/(tabs)/profile' as Href)}
          style={[styles.backButton, { top: insets.top + 3 }]}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text pointerEvents="none" style={styles.title}>BMI</Text>
      </View>

      <View style={styles.summaryContent}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>Your weight is</Text>
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>Healthy</Text>
          </View>
        </View>

        <Text style={styles.bmiValue}>{bmi != null ? bmi.toFixed(1) : '—'}</Text>

        <View style={styles.barRow}>
          <View style={[styles.barSegment, styles.blue, styles.segmentSeparator]} />
          <View style={[styles.barSegment, styles.green, styles.segmentSeparator]} />
          <View style={[styles.barSegment, styles.gold, styles.segmentSeparator]} />
          <View style={[styles.barSegment, styles.red]} />
          <View style={[styles.marker, { left: `${markerPosition}%` }]} />
        </View>

        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#6595D8' }]} />
            <Text style={styles.legendText}>Underweight{`\n`}{'<18.5'}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#20A66A' }]} />
            <Text style={styles.legendText}>Healthy{`\n`}18.5–24.9</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#E3B66F' }]} />
            <Text style={styles.legendText}>Overweight{`\n`}25.0–29.9</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#D96367' }]} />
            <Text style={styles.legendText}>Obese{`\n`}{'>30.0'}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.disclaimerContent, { paddingBottom: insets.bottom + 4 }]}>
        <Text style={styles.sectionTitle}>Disclaimer</Text>
        <Text style={styles.bodyText}>{bmiInfoText.disclaimer}</Text>

        <Text style={styles.sectionTitle}>{bmiInfoText.heading}</Text>
        <Text style={[styles.bodyText, styles.introText]}>{bmiInfoText.body}</Text>
        {bmiInfoText.bullets.map((bullet, index) => (
          <Text key={bullet} style={[styles.bulletText, index === 0 && styles.firstBullet]}>
            • {bullet}
          </Text>
        ))}

        <Pressable
          accessibilityRole="link"
          onPress={() => Linking.openURL('https://www.cdc.gov/bmi/about/index.html')}
          style={styles.source}
        >
          <Text style={styles.sourceText}>Source</Text>
          <Ionicons name="open-outline" size={16} color="#8E8E93" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 16,
    minHeight: 116,
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    left: 18,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EEF0F7',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '500',
    textAlign: 'center',
  },
  summaryContent: {
    paddingHorizontal: 16,
    paddingTop: 26,
  },
  disclaimerContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  summaryText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  statusPill: {
    backgroundColor: '#E7F6EF',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    color: '#20A66A',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
  },
  bmiValue: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '600',
    marginTop: 11,
    marginBottom: 20,
  },
  barRow: {
    height: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 27,
    position: 'relative',
  },
  barSegment: {
    flex: 1,
    height: 10,
  },
  segmentSeparator: {
    borderRightWidth: 0.5,
    borderRightColor: '#FFFFFF',
  },
  blue: {
    backgroundColor: '#6D97E0',
    borderTopLeftRadius: 5,
    borderBottomLeftRadius: 5,
  },
  green: {
    backgroundColor: '#20A66A',
  },
  gold: {
    backgroundColor: '#E6BB6B',
  },
  red: {
    backgroundColor: '#DE6666',
    borderTopRightRadius: 5,
    borderBottomRightRadius: 5,
  },
  marker: {
    position: 'absolute',
    left: '48%',
    top: -4,
    width: 2,
    height: 18,
    borderRadius: 1,
    backgroundColor: colors.text,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  legendItem: {
    flex: 1,
    alignItems: 'center',
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginBottom: 4,
  },
  legendText: {
    color: '#8B8B8B',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    marginBottom: 15,
  },
  bodyText: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '400',
    marginBottom: 18,
  },
  introText: {
    marginBottom: 0,
  },
  bulletText: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '400',
    marginBottom: 0,
  },
  firstBullet: {
    marginTop: 3,
  },
  source: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  sourceText: {
    color: '#8E8E93',
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '400',
    textDecorationLine: 'underline',
  },
});
