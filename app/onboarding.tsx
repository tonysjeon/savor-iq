import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type Insets,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { AvocadoIcon } from '@/components/AvocadoIcon';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { ProgressRing } from '@/components/ProgressRing';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import {
  calculateRecommendation,
  defaultOnboardingProfile,
  saveOnboardingDraft,
  type Gender,
  type OnboardingProfile,
  type WeightGoal,
  type WorkoutFrequency,
} from '@/lib/onboarding';

const TOTAL_STEPS = 9;

function isAtLeast13(birthDate: string) {
  const [year, month, day] = birthDate.split('-').map(Number);
  const today = new Date();
  const latestEligibleBirthDate = new Date(today.getFullYear() - 13, today.getMonth(), today.getDate());
  const selectedBirthDate = new Date(year, month - 1, day);

  return selectedBirthDate <= latestEligibleBirthDate;
}

type Choice<T extends string> = { value: T; label: string; detail?: string };

function ActivityDots({ value }: { value: string }) {
  if (value === '0-2') {
    return <View style={styles.singleActivityDot} />;
  }
  if (value === '3-5') {
    return (
      <View style={styles.threeDotPattern}>
        <View style={styles.threeActivityDot} />
        <View style={styles.threeDotBottom}>
          <View style={styles.threeActivityDot} />
          <View style={styles.threeActivityDot} />
        </View>
      </View>
    );
  }
  return (
    <View style={styles.sixDotPattern}>
      {Array.from({ length: 6 }, (_, index) => <View key={index} style={styles.smallActivityDot} />)}
    </View>
  );
}

const genderChoices: Choice<Gender>[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];
const workoutChoices: Choice<WorkoutFrequency>[] = [
  { value: '0-2', label: '0-2', detail: 'Lightly active' },
  { value: '3-5', label: '3-5', detail: 'Moderately active' },
  { value: '6+', label: '6-7', detail: 'Very active' },
];
const goalChoices: Choice<WeightGoal>[] = [
  { value: 'lose', label: 'Lose weight' },
  { value: 'maintain', label: 'Maintain' },
  { value: 'gain', label: 'Gain weight' },
];

function GoalIcon({ value }: { value: WeightGoal }) {
  if (value === 'maintain') {
    return (
      <Svg width={20} height={23} viewBox="0 0 24 28">
        <Path d="M4.5 14H19.5" fill="none" stroke={colors.text} strokeWidth={3} strokeLinecap="round" />
      </Svg>
    );
  }

  const path = value === 'lose' ? 'M12 5V22M6 16L12 22L18 16' : 'M12 23V6M6 12L12 6L18 12';
  return (
    <Svg width={19} height={23} viewBox="0 0 24 28">
      <Path
        d={path}
        fill="none"
        stroke={colors.text}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function OutlinedChoiceCard<T extends string>({
  choice,
  selected,
  index,
  activity,
  onPress,
}: {
  choice: Choice<T>;
  selected: boolean;
  index: number;
  activity: boolean;
  onPress: () => void;
}) {
  const entrance = useRef(new Animated.Value(0)).current;
  const iconName =
    choice.value === 'male'
      ? 'male'
      : choice.value === 'female'
        ? 'female'
        : choice.value === 'lose'
          ? 'arrow-down'
          : choice.value === 'maintain'
            ? 'remove'
            : choice.value === 'gain'
              ? 'arrow-up'
              : choice.value === '0-2'
                ? 'walk-outline'
                : choice.value === '3-5'
                  ? 'barbell-outline'
                  : choice.value === '6+'
                    ? 'fitness-outline'
                    : 'grid-outline';

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 300,
      delay: 80 + index * 70,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entrance, index]);

  return (
    <Animated.View
      style={{
        opacity: entrance,
        width: '100%',
        transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
      }}
    >
      <Pressable
        onPress={onPress}
        style={[styles.choice, styles.lightChoice, activity && styles.activityChoice, selected && styles.lightChoiceSelected]}
      >
        <View style={styles.genderIconCircle}>
          {activity ? (
            <ActivityDots value={choice.value} />
          ) : choice.value === 'lose' || choice.value === 'maintain' || choice.value === 'gain' ? (
            <GoalIcon value={choice.value as WeightGoal} />
          ) : (
            <Ionicons name={iconName} size={24} color={colors.text} />
          )}
        </View>
        <View style={styles.lightChoiceContent}>
          <Text style={[styles.choiceLabel, styles.lightChoiceLabel, activity && styles.activityChoiceLabel]}>{choice.label}</Text>
          {choice.detail ? <Text style={[styles.lightChoiceDetail, activity && styles.activityChoiceDetail]}>{choice.detail}</Text> : null}
        </View>
        <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
          {selected ? <View style={styles.radioInner} /> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

function ChoiceList<T extends string>({
  choices,
  value,
  onChange,
  light = false,
  activity = false,
}: {
  choices: Choice<T>[];
  value: T | null;
  onChange: (value: T) => void;
  light?: boolean;
  activity?: boolean;
}) {
  if (light) {
    return (
      <View style={[styles.choiceList, styles.outlinedChoiceList]}>
        {choices.map((choice, index) => (
          <OutlinedChoiceCard
            key={choice.value}
            choice={choice}
            selected={value === choice.value}
            index={index}
            activity={activity}
            onPress={() => onChange(choice.value)}
          />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.choiceList}>
      {choices.map((choice) => {
        const selected = value === choice.value;
        return (
          <Pressable
            key={choice.value}
            onPress={() => onChange(choice.value)}
            style={[
              styles.choice,
              light && styles.lightChoice,
              selected && styles.choiceSelected,
              selected && light && styles.lightChoiceSelected,
            ]}
          >
            {light ? (
              <View style={styles.genderIconCircle}>
                <Ionicons
                  name={choice.value === 'male' ? 'male' : choice.value === 'female' ? 'female' : 'grid-outline'}
                  size={27}
                  color={colors.text}
                />
              </View>
            ) : null}
            <View style={light && styles.lightChoiceContent}>
              <Text style={[styles.choiceLabel, light && styles.lightChoiceLabel, selected && !light && styles.choiceTextSelected]}>
                {choice.label}
              </Text>
              {choice.detail ? (
                <Text style={[styles.choiceDetail, selected && !light && styles.choiceTextSelected]}>
                  {choice.detail}
                </Text>
              ) : null}
            </View>
            {light ? (
              <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
                {selected ? <View style={styles.radioInner} /> : null}
              </View>
            ) : null}
            {selected && !light ? <Ionicons name="checkmark-circle" size={26} color="#FFFFFF" /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function OnboardingHeader({ title, subtitle, outlined }: { title: string; subtitle: string; outlined: boolean }) {
  const opacity = useRef(new Animated.Value(0.65)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [opacity]);

  return (
    <Animated.View style={[outlined && styles.outlinedHeaderBlock, { opacity }]}>
      <Text style={[styles.title, outlined && styles.genderTitle]}>{title}</Text>
      <Text style={[styles.subtitle, outlined && styles.genderSubtitle]}>{subtitle}</Text>
    </Animated.View>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const PROCESSING_RING_SIZE = 168;
const PROCESSING_RING_STROKE = 11;
const PROCESSING_RING_RADIUS = (PROCESSING_RING_SIZE - PROCESSING_RING_STROKE) / 2;
const PROCESSING_RING_CIRCUMFERENCE = 2 * Math.PI * PROCESSING_RING_RADIUS;

function PlanProcessing({ onComplete }: { onComplete: () => void }) {
  const progress = useRef(new Animated.Value(0)).current;
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    const listener = progress.addListener(({ value }) => setPercent(Math.min(100, Math.round(value * 100))));
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 3000,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start(({ finished }) => {
      if (finished) onComplete();
    });
    return () => {
      animation.stop();
      progress.removeListener(listener);
    };
  }, [onComplete, progress]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.processing}>
        <View style={styles.processingRing}>
          <Svg width={PROCESSING_RING_SIZE} height={PROCESSING_RING_SIZE}>
            <Circle
              cx={PROCESSING_RING_SIZE / 2}
              cy={PROCESSING_RING_SIZE / 2}
              r={PROCESSING_RING_RADIUS}
              fill="none"
              stroke="#E5E5E8"
              strokeWidth={PROCESSING_RING_STROKE}
            />
            <AnimatedCircle
              cx={PROCESSING_RING_SIZE / 2}
              cy={PROCESSING_RING_SIZE / 2}
              r={PROCESSING_RING_RADIUS}
              fill="none"
              stroke={colors.text}
              strokeWidth={PROCESSING_RING_STROKE}
              strokeLinecap="round"
              strokeDasharray={`${PROCESSING_RING_CIRCUMFERENCE} ${PROCESSING_RING_CIRCUMFERENCE}`}
              strokeDashoffset={progress.interpolate({
                inputRange: [0, 1],
                outputRange: [PROCESSING_RING_CIRCUMFERENCE, 0],
              })}
              rotation="-90"
              origin={`${PROCESSING_RING_SIZE / 2}, ${PROCESSING_RING_SIZE / 2}`}
            />
          </Svg>
          <Text style={styles.processingRingPercent}>{percent}%</Text>
        </View>
        <Text style={styles.processingTitle}>We’re creating your custom plan</Text>
        <Text style={styles.processingCaption}>Calculating your daily nutrition goals…</Text>
      </View>
    </SafeAreaView>
  );
}

export default function OnboardingScreen() {
  const { configured, signIn, signUp } = useAuth();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<OnboardingProfile>(defaultOnboardingProfile);
  const [weightUnit, setWeightUnit] = useState<'lbs' | 'kg'>('lbs');
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | null>(null);
  const [showEmail, setShowEmail] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resultPage, setResultPage] = useState(0);
  const [resultPagerWidth, setResultPagerWidth] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const recommendation = useMemo(() => calculateRecommendation(profile), [profile]);

  useEffect(() => {
    if (step < 1 || step > 7) return;
    Animated.timing(progress, {
      toValue: step / TOTAL_STEPS,
      duration: 360,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, step]);

  function update<K extends keyof OnboardingProfile>(key: K, value: OnboardingProfile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function continueOnboarding() {
    if (step === 3 && !isAtLeast13(profile.birthDate)) {
      Alert.alert('Age requirement', 'You must be at least 13 years old to use Savor IQ.');
      return;
    }

    if (step === 6 && profile.goal === 'maintain') {
      setStep(8);
      return;
    }

    if (step === 6) {
      update('targetWeightKg', profile.weightKg);
      setStep(7);
      return;
    }

    setStep((value) => value + 1);
  }

  async function finish() {
    await saveOnboardingDraft(profile);
    setStep(10);
  }

  function openAuth(mode: 'signin' | 'signup') {
    setAuthMode(mode);
    setShowEmail(false);
    setAuthError(null);
  }

  function openEmailAuth(mode: 'signin' | 'signup') {
    setAuthMode(mode);
    setShowEmail(true);
    setAuthError(null);
  }

  function closeAuth() {
    if (submitting) return;
    setAuthMode(null);
    setShowEmail(false);
    setAuthError(null);
  }

  async function submitEmailAuth() {
    if (!authMode) return;
    setSubmitting(true);
    setAuthError(null);
    try {
      if (authMode === 'signin') {
        await signIn(email, password);
      } else {
        await signUp(name, email, password);
      }
      setAuthMode(null);
      router.replace('/(tabs)');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to continue.');
    } finally {
      setSubmitting(false);
    }
  }

  const authIsland = (
    <AuthIsland
      visible={authMode !== null}
      mode={authMode ?? 'signin'}
      showEmail={showEmail}
      configured={configured}
      name={name}
      email={email}
      password={password}
      error={authError}
      submitting={submitting}
      onClose={closeAuth}
      onShowEmail={() => setShowEmail(true)}
      onNameChange={setName}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onSubmit={submitEmailAuth}
    />
  );

  if (step === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.welcome}>
          <View style={styles.brandMark}>
            <Ionicons name="restaurant" size={58} color={colors.text} />
          </View>
          <Text style={styles.brand}>Savor IQ</Text>
          <Text style={styles.heroTitle}>Nutrition tracking made easy</Text>
          <Text style={styles.heroBody}>
            Get a daily calorie and macro plan built around your body, activity, and goals.
          </Text>
          <View style={styles.welcomeActions}>
            <Pressable style={styles.primaryButton} onPress={() => setStep(1)}>
              <Text style={styles.primaryButtonText}>Get Started</Text>
            </Pressable>
            <Pressable onPress={() => openAuth('signin')}>
              <Text style={styles.signIn}>Already have an account? <Text style={styles.bold}>Sign in</Text></Text>
            </Pressable>
          </View>
        </View>
        {authIsland}
      </SafeAreaView>
    );
  }

  if (step === 8) {
    return <PlanProcessing onComplete={() => setStep(9)} />;
  }

  if (step === 9) {
    return (
      <SafeAreaView style={[styles.safe, styles.resultPageBackground]}>
        <View style={[styles.screen, styles.resultPageBackground]}>
          <ScrollView contentContainerStyle={styles.resultContent}>
            <Pressable
              style={styles.resultBack}
              onPress={() => setStep(profile.goal === 'maintain' ? 6 : 7)}
            >
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
            <Ionicons name="checkmark-circle" size={72} color={colors.text} />
            <Text style={styles.resultTitle}>Your custom plan is ready!</Text>
            <View
              style={styles.resultPlan}
              onLayout={({ nativeEvent }) => setResultPagerWidth(nativeEvent.layout.width)}
            >
            <Text style={styles.resultCardTitle}>Daily recommendation</Text>
            <Text style={styles.muted}>You can edit this anytime</Text>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              scrollEnabled={resultPagerWidth > 0}
              onMomentumScrollEnd={({ nativeEvent }) => {
                setResultPage(Math.round(nativeEvent.contentOffset.x / resultPagerWidth));
              }}
            >
              <View style={[styles.resultPagerPage, { width: resultPagerWidth || undefined }]}>
                <View style={styles.resultCalorieCard}>
                  <View style={styles.resultCalorieCopy}>
                    <Text style={styles.resultCalorieValue}>{recommendation.calories}</Text>
                    <Text style={styles.resultMetricLabel}>Calories</Text>
                  </View>
                  <ProgressRing
                    size={86}
                    strokeWidth={9}
                    progress={1}
                    color={colors.text}
                    trackColor={colors.surfaceElevated}
                  >
                    <Ionicons name="flame" size={20} color={colors.text} />
                  </ProgressRing>
                </View>
                <View style={styles.resultMacroRow}>
                  <View style={styles.resultMacroCard}>
                    <Text style={styles.resultMacroValue}>{recommendation.proteinGrams}g</Text>
                    <Text style={styles.resultMacroLabel}>Protein</Text>
                    <ProgressRing size={56} strokeWidth={6} progress={1} color="#E57373" trackColor={colors.surfaceElevated}>
                      <MaterialCommunityIcons name="food-drumstick" size={16} color="#E57373" />
                    </ProgressRing>
                  </View>
                  <View style={styles.resultMacroCard}>
                    <Text style={styles.resultMacroValue}>{recommendation.carbsGrams}g</Text>
                    <Text style={styles.resultMacroLabel}>Carbs</Text>
                    <ProgressRing size={56} strokeWidth={6} progress={1} color="#FFA726" trackColor={colors.surfaceElevated}>
                      <MaterialCommunityIcons name="barley" size={16} color="#FFA726" />
                    </ProgressRing>
                  </View>
                  <View style={styles.resultMacroCard}>
                    <Text style={styles.resultMacroValue}>{recommendation.fatGrams}g</Text>
                    <Text style={styles.resultMacroLabel}>Fats</Text>
                    <ProgressRing size={56} strokeWidth={6} progress={1} color="#66BB6A" trackColor={colors.surfaceElevated}>
                      <AvocadoIcon size={16} color="#66BB6A" />
                    </ProgressRing>
                  </View>
                </View>
              </View>
              <View style={[styles.resultPagerPage, { width: resultPagerWidth || undefined }]}>
                <View style={styles.resultDetailRow}>
                  <View style={[styles.resultDetailCard, styles.resultBmiCard]}>
                    <Text style={styles.resultBmiTitle}>Your BMI</Text>
                    <View style={styles.resultBmiValueRow}>
                      <Text style={styles.resultBmiValue}>{recommendation.bmi}</Text>
                      <View style={[styles.resultBmiBadge, { backgroundColor: bmiCategory(recommendation.bmi).backgroundColor }]}>
                        <Text style={[styles.resultBmiBadgeText, { color: bmiCategory(recommendation.bmi).color }]}>
                          {bmiCategory(recommendation.bmi).label}
                        </Text>
                      </View>
                    </View>
                    <BmiRangeBar bmi={recommendation.bmi} />
                  </View>
                  <View style={styles.resultDetailCard}>
                    <Text style={styles.resultDetailValue}>{recommendation.waterMl}ml</Text>
                    <Text style={styles.resultMacroLabel}>Water</Text>
                    <ProgressRing size={56} strokeWidth={6} progress={1} color="#42A5F5" trackColor={colors.surfaceElevated}>
                      <MaterialCommunityIcons name="cup-water" size={16} color="#42A5F5" />
                    </ProgressRing>
                  </View>
                </View>
                <View style={styles.resultMacroRow}>
                  <View style={styles.resultMacroCard}>
                    <Text style={styles.resultMacroValue}>{recommendation.fiberGrams}g</Text>
                    <Text style={styles.resultMacroLabel}>Fiber</Text>
                    <ProgressRing size={56} strokeWidth={6} progress={1} color="#64B5F6" trackColor={colors.surfaceElevated}>
                      <MaterialCommunityIcons name="food-apple" size={16} color="#64B5F6" />
                    </ProgressRing>
                  </View>
                  <View style={styles.resultMacroCard}>
                    <Text style={styles.resultMacroValue}>{recommendation.sugarGrams}g</Text>
                    <Text style={styles.resultMacroLabel}>Sugar</Text>
                    <ProgressRing size={56} strokeWidth={6} progress={1} color="#F48FB1" trackColor={colors.surfaceElevated}>
                      <MaterialCommunityIcons name="candy" size={16} color="#F48FB1" />
                    </ProgressRing>
                  </View>
                  <View style={styles.resultMacroCard}>
                    <Text style={styles.resultMacroValue}>{recommendation.sodiumMg}mg</Text>
                    <Text style={styles.resultMacroLabel}>Sodium</Text>
                    <ProgressRing size={56} strokeWidth={6} progress={1} color="#90A4AE" trackColor={colors.surfaceElevated}>
                      <MaterialCommunityIcons name="shaker-outline" size={16} color="#90A4AE" />
                    </ProgressRing>
                  </View>
                </View>
              </View>
            </ScrollView>
            <View style={styles.resultPagerDots}>
              <View style={[styles.resultPagerDot, resultPage === 0 && styles.resultPagerDotActive]} />
              <View style={[styles.resultPagerDot, resultPage === 1 && styles.resultPagerDotActive]} />
            </View>
            </View>
          </ScrollView>
          <View style={[styles.footer, styles.resultPageBackground]}>
            <Pressable style={styles.primaryButton} onPress={finish}>
              <Text style={[styles.primaryButtonText, styles.continueButtonText]}>Let’s get started!</Text>
            </Pressable>
          </View>
        </View>
        {authIsland}
      </SafeAreaView>
    );
  }

  if (step === 10) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.saveProgressPage}>
          <View style={styles.saveProgressIntro}>
            <Text style={[styles.title, styles.genderTitle, styles.saveProgressTitle]}>Save your progress</Text>
            <Text style={[styles.subtitle, styles.genderSubtitle]}>
              Create an account to keep your custom plan and track your progress across devices.
            </Text>
          </View>
          <View style={styles.saveProgressActions}>
            <Pressable style={[styles.providerButton, styles.appleButton]} onPress={() => Alert.alert('Apple sign-in', 'This option will be available soon.')}>
              <Ionicons name="logo-apple" size={28} color="#FFFFFF" />
              <Text style={styles.appleButtonText}>Sign in with Apple</Text>
            </Pressable>
            <Pressable style={styles.providerButton} onPress={() => Alert.alert('Google sign-in', 'This option will be available soon.')}>
              <GoogleIcon />
              <Text style={styles.providerButtonText}>Sign in with Google</Text>
            </Pressable>
            <Pressable style={styles.providerButton} onPress={() => openEmailAuth('signup')}>
              <Ionicons name="mail-outline" size={27} color={colors.text} />
              <Text style={styles.providerButtonText}>Continue with email</Text>
            </Pressable>
            <Text style={styles.privacyCopy}>
              By continuing, you agree to our Terms and acknowledge our Privacy Policy.
            </Text>
          </View>
        </View>
        {authIsland}
      </SafeAreaView>
    );
  }

  const titles: Record<number, [string, string]> = {
    1: ['Choose your gender', 'This helps calibrate your custom plan.'],
    2: ['How many days a week do you work out?', 'This helps calibrate your custom plan.'],
    3: ["What's your birthday?", 'This helps estimate your metabolic needs.'],
    4: ["What's your height?", 'This helps calculate your BMI and calorie needs.'],
    5: ['What is your weight?', 'This helps calculate your BMI and calorie needs.'],
    6: ['What is your goal?', 'This shapes your calorie and macro distribution.'],
    7: ['What is your target weight?', 'Choose a realistic destination for your plan.'],
  };
  const [title, subtitle] = titles[step];
  const continueDisabled = (step === 1 && profile.gender === null) || (step === 2 && profile.workoutFrequency === null);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable style={styles.back} onPress={() => setStep((value) => Math.max(0, value - 1))}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
              ]}
            />
          </View>
        </View>
        <ScrollView scrollEnabled={false} contentContainerStyle={styles.formContent}>
          <OnboardingHeader key={step} title={title} subtitle={subtitle} outlined={step <= 7} />
          <View style={styles.inputArea}>
            {step === 1 ? <ChoiceList light choices={genderChoices} value={profile.gender} onChange={(value) => update('gender', value)} /> : null}
            {step === 2 ? <ChoiceList light activity choices={workoutChoices} value={profile.workoutFrequency} onChange={(value) => update('workoutFrequency', value)} /> : null}
            {step === 3 ? <BirthDateSelector value={profile.birthDate} onChange={(value) => update('birthDate', value)} /> : null}
            {step === 4 ? <HeightSelector valueCm={profile.heightCm} onChange={(value) => update('heightCm', value)} /> : null}
            {step === 5 ? <WeightSelector valueKg={profile.weightKg} unit={weightUnit} onUnitChange={setWeightUnit} onChange={(value) => update('weightKg', value)} /> : null}
            {step === 6 ? <ChoiceList light choices={goalChoices} value={profile.goal} onChange={(value) => { update('goal', value); update('targetWeightKg', profile.weightKg); }} /> : null}
            {step === 7 ? <TargetWeightSelector goal={profile.goal} unit={weightUnit} currentWeightKg={profile.weightKg} valueKg={profile.targetWeightKg ?? profile.weightKg} onChange={(value) => update('targetWeightKg', value)} /> : null}
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <Pressable
            disabled={continueDisabled}
            style={[styles.primaryButton, continueDisabled && styles.primaryButtonDisabled]}
            onPress={continueOnboarding}
          >
            <Text style={[styles.primaryButtonText, styles.continueButtonText]}>Continue</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function AuthIsland({
  visible,
  mode,
  showEmail,
  configured,
  name,
  email,
  password,
  error,
  submitting,
  onClose,
  onShowEmail,
  onNameChange,
  onEmailChange,
  onPasswordChange,
  onSubmit,
}: {
  visible: boolean;
  mode: 'signin' | 'signup';
  showEmail: boolean;
  configured: boolean;
  name: string;
  email: string;
  password: string;
  error: string | null;
  submitting: boolean;
  onClose: () => void;
  onShowEmail: () => void;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const screenHeight = Dimensions.get('window').height;
  const dismissThreshold = screenHeight * 0.18;
  const translateY = useRef(new Animated.Value(screenHeight)).current;
  const [mounted, setMounted] = useState(visible);
  const title = mode === 'signin' ? 'Sign in' : 'Create account';
  const futureAuth = (provider: string) => Alert.alert(`${provider} sign-in`, 'This option will be available soon.');
  const scrimOpacity = translateY.interpolate({
    inputRange: [0, screenHeight],
    outputRange: [0.54, 0],
    extrapolate: 'clamp',
  });

  function animateClose(releaseVelocity = 0) {
    Animated.spring(translateY, {
      toValue: screenHeight,
      velocity: Math.max(0, releaseVelocity),
      damping: 30,
      stiffness: 105,
      mass: 1,
      overshootClamping: true,
      restDisplacementThreshold: 0.5,
      restSpeedThreshold: 0.5,
      useNativeDriver: true,
    }).start(() => {
      // Keep the modal mounted through the final native-driver paint so the
      // island visibly completes its travel off-screen before it is removed.
      setTimeout(() => {
        setMounted(false);
        onClose();
      }, 72);
    });
  }

  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) =>
        gesture.dy > 3 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onMoveShouldSetPanResponderCapture: (_, gesture) =>
        gesture.dy > 3 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderMove: (_, gesture) => translateY.setValue(Math.max(0, gesture.dy)),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy >= dismissThreshold) {
          animateClose(gesture.vy);
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
    // The responder intentionally lives for one mounted island lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dismissThreshold, translateY],
  );

  useEffect(() => {
    if (!visible) return;
    setMounted(true);
    translateY.setValue(screenHeight);
    Animated.timing(translateY, {
      toValue: 0,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [screenHeight, translateY, visible]);

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={() => animateClose()}>
      <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.View pointerEvents="none" style={[styles.modalBackdrop, { opacity: scrimOpacity }]} />
        <Pressable style={StyleSheet.absoluteFill} onPress={() => animateClose()} />
        <Animated.View style={[styles.authIsland, { transform: [{ translateY }] }]}>
          <View style={styles.authHeader} {...panResponder.panHandlers}>
            <Text style={styles.authTitle}>{title}</Text>
          </View>
          <Pressable style={styles.closeButton} onPress={() => animateClose()}>
            <Ionicons name="close" size={19} color={colors.textSecondary} />
          </Pressable>

          <View style={styles.authBody}>
            {!showEmail ? (
              <>
                <Pressable style={[styles.providerButton, styles.appleButton]} onPress={() => futureAuth('Apple')}>
                  <Ionicons name="logo-apple" size={28} color="#FFFFFF" />
                  <Text style={styles.appleButtonText}>Sign in with Apple</Text>
                </Pressable>
                <Pressable style={styles.providerButton} onPress={() => futureAuth('Google')}>
                  <GoogleIcon />
                  <Text style={styles.providerButtonText}>Sign in with Google</Text>
                </Pressable>
                <Pressable style={styles.providerButton} onPress={onShowEmail}>
                  <Ionicons name="mail-outline" size={27} color={colors.text} />
                  <Text style={styles.providerButtonText}>Continue with email</Text>
                </Pressable>
              </>
            ) : (
              <>
                {mode === 'signup' ? (
                  <TextInput placeholder="Name" placeholderTextColor={colors.textMuted} value={name} onChangeText={onNameChange} style={styles.authInput} />
                ) : null}
                <TextInput autoCapitalize="none" autoCorrect={false} keyboardType="email-address" placeholder="Email" placeholderTextColor={colors.textMuted} value={email} onChangeText={onEmailChange} style={styles.authInput} />
                <TextInput secureTextEntry placeholder="Password" placeholderTextColor={colors.textMuted} value={password} onChangeText={onPasswordChange} style={styles.authInput} />
                {!configured ? <Text style={styles.authError}>Firebase is not configured for this build.</Text> : null}
                {error ? <Text style={styles.authError}>{error}</Text> : null}
                <Pressable style={[styles.authSubmit, (!configured || submitting) && styles.authSubmitDisabled]} disabled={!configured || submitting} onPress={onSubmit}>
                  {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>{title}</Text>}
                </Pressable>
              </>
            )}

            <Text style={styles.privacyCopy}>
              By continuing, you agree to our Terms and acknowledge our Privacy Policy.
            </Text>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function GoogleIcon() {
  return (
    <Svg width={27} height={27} viewBox="0 0 24 24">
      <Path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.07 5.07 0 0 1-2.2 3.32v2.76h3.57c2.09-1.92 3.27-4.75 3.27-8.09Z" />
      <Path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.29-2.66l-3.57-2.76c-.99.66-2.25 1.05-3.72 1.05-2.87 0-5.3-1.94-6.17-4.54H2.14v2.85A11 11 0 0 0 12 23Z" />
      <Path fill="#FBBC05" d="M5.83 14.09A6.62 6.62 0 0 1 5.48 12c0-.73.13-1.43.35-2.09V7.06H2.14A11 11 0 0 0 1 12c0 1.77.42 3.44 1.14 4.94l3.69-2.85Z" />
      <Path fill="#EA4335" d="M12 5.37c1.62 0 3.06.56 4.2 1.64l3.17-3.17A10.63 10.63 0 0 0 12 1a11 11 0 0 0-9.86 6.06l3.69 2.85C6.7 7.31 9.13 5.37 12 5.37Z" />
    </Svg>
  );
}

function bmiCategory(bmi: number) {
  if (bmi < 18.5) return { label: 'Under', color: '#4F86D9', backgroundColor: '#EAF2FF' };
  if (bmi < 25) return { label: 'Healthy', color: '#24A86A', backgroundColor: '#EAF7F1' };
  if (bmi < 30) return { label: 'Over', color: '#C68B2C', backgroundColor: '#FFF5E4' };
  return { label: 'High', color: '#D95F63', backgroundColor: '#FDEEEF' };
}

function BmiRangeBar({ bmi }: { bmi: number }) {
  const markerPosition = Math.min(100, Math.max(0, ((bmi - 10) / 30) * 100));

  return (
    <View style={styles.bmiScaleWrap}>
      <View style={styles.bmiScale}>
        <View style={[styles.bmiScaleSegment, styles.bmiUnderweight]} />
        <View style={[styles.bmiScaleSegment, styles.bmiHealthy]} />
        <View style={[styles.bmiScaleSegment, styles.bmiOverweight]} />
        <View style={[styles.bmiScaleSegment, styles.bmiObese]} />
      </View>
      <View style={[styles.bmiMarker, { left: `${markerPosition}%` }]} />
    </View>
  );
}

const WHEEL_ITEM_HEIGHT = 40;
const WHEEL_VISIBLE_ROWS = 5;
const WHEEL_CENTER_ROW = Math.floor(WHEEL_VISIBLE_ROWS / 2);
const WHEEL_PAD = WHEEL_ITEM_HEIGHT * WHEEL_CENTER_ROW;
const MIN_BIRTH_YEAR = 1900;
const MAX_BIRTH_YEAR = 2026;
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const MONTH_VALUES = Array.from({ length: 12 }, (_, index) => index + 1);
const YEAR_VALUES = Array.from({ length: MAX_BIRTH_YEAR - MIN_BIRTH_YEAR + 1 }, (_, index) => MIN_BIRTH_YEAR + index);
const FOOT_VALUES = Array.from({ length: 8 }, (_, index) => index + 1);
const INCH_VALUES = Array.from({ length: 12 }, (_, index) => index);
const CENTIMETER_VALUES = Array.from({ length: 243 }, (_, index) => index + 30);

// Rows sit on one shared cylinder. A row `offset` steps from the selection is
// drawn at radius * sin(angle), tilted by that same angle, and faded by how
// much its face is turned away. Sampling position, tilt, and opacity from that
// geometry is what makes the columns read as one turning drum.
const WHEEL_ROW_ANGLE_DEG = 26;
const WHEEL_ROW_ANGLE = (WHEEL_ROW_ANGLE_DEG * Math.PI) / 180;
const WHEEL_RADIUS = WHEEL_ITEM_HEIGHT / WHEEL_ROW_ANGLE;
const WHEEL_PERSPECTIVE = 420;
const WHEEL_CURVE_LIMIT = WHEEL_CENTER_ROW + 0.5;
const WHEEL_CURVE_STEP = 0.2;
// Descending so the derived scroll input range stays ascending for interpolate.
const WHEEL_ROW_OFFSETS = Array.from(
  { length: Math.round((WHEEL_CURVE_LIMIT * 2) / WHEEL_CURVE_STEP) + 1 },
  (_, index) => WHEEL_CURVE_LIMIT - index * WHEEL_CURVE_STEP,
);
const WHEEL_CURVE_TRANSLATE_Y = WHEEL_ROW_OFFSETS.map(
  (offset) => WHEEL_RADIUS * Math.sin(offset * WHEEL_ROW_ANGLE) - offset * WHEEL_ITEM_HEIGHT,
);
const WHEEL_CURVE_ROTATE_X = WHEEL_ROW_OFFSETS.map((offset) => `${-offset * WHEEL_ROW_ANGLE_DEG}deg`);
const WHEEL_CURVE_OPACITY = WHEEL_ROW_OFFSETS.map((offset) => {
  const distance = Math.abs(offset);
  return distance <= 1 ? 1 - distance * 0.7 : Math.max(0.08, 0.3 - (distance - 1) * 0.14);
});

function wheelInputRange(index: number) {
  return WHEEL_ROW_OFFSETS.map((offset) => (index - offset) * WHEEL_ITEM_HEIGHT);
}

const formatNumberLabel = (value: number) => String(value);
const formatMonthLabel = (value: number) => MONTH_NAMES[value - 1];
const formatFeetLabel = (value: number) => `${value} ft`;
const formatInchesLabel = (value: number) => `${value} in`;
const formatCentimeterLabel = (value: number) => `${value} cm`;

function WheelColumn({
  values,
  selectedValue,
  onChange,
  width,
  style,
  align = 'center',
  decelerationRate = 'fast',
  bounces = false,
  hitSlop,
  itemStyle,
  formatLabel = formatNumberLabel,
}: {
  values: number[];
  selectedValue: number;
  onChange: (value: number) => void;
  width: number;
  style?: object;
  align?: 'left' | 'center' | 'right';
  decelerationRate?: 'fast' | 'normal' | number;
  bounces?: boolean;
  hitSlop?: Insets;
  itemStyle?: object;
  formatLabel?: (value: number) => string;
}) {
  const selectedIndex = Math.max(0, values.indexOf(selectedValue));
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(new Animated.Value(selectedIndex * WHEEL_ITEM_HEIGHT)).current;
  const isDragging = useRef(false);
  const [curveEpoch, setCurveEpoch] = useState(0);

  useEffect(() => {
    if (isDragging.current) return;
    const offset = selectedIndex * WHEEL_ITEM_HEIGHT;
    scrollY.setValue(offset);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: offset, animated: false });
    });
  }, [scrollY, selectedIndex, values.length]);

  // The curve is driven natively, and the native driver only pushes transforms
  // to the row views when its value changes. A column that mounts already
  // sitting on its selected row never gets that push, so it paints flat until
  // the first scroll. Remounting the rows and then nudging the offset by a
  // sub-pixel amount forces the resting curve out on every column.
  useEffect(() => {
    const mountedIndex = selectedIndex;
    let nudge = 0;
    const rebuild = requestAnimationFrame(() => {
      setCurveEpoch((epoch) => epoch + 1);
      nudge = requestAnimationFrame(() => {
        if (isDragging.current) return;
        scrollY.setValue(mountedIndex * WHEEL_ITEM_HEIGHT + 0.01);
        scrollY.setValue(mountedIndex * WHEEL_ITEM_HEIGHT);
      });
    });
    return () => {
      cancelAnimationFrame(rebuild);
      cancelAnimationFrame(nudge);
    };
    // Only the first paint needs this; later scrolls publish the curve on their own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuilding these rows swaps in a fresh set of animated nodes and drops the
  // curve the native driver already published, so they only change when the
  // values they render do.
  const rows = useMemo(
    () =>
      values.map((item, index) => {
        const inputRange = wheelInputRange(index);
        return (
          <View
            key={`${item}-${index}`}
            style={[
              styles.wheelItem,
              align === 'left' && styles.wheelItemLeft,
              align === 'right' && styles.wheelItemRight,
              itemStyle,
            ]}
          >
            <Animated.Text
              numberOfLines={1}
              style={[
                styles.wheelItemText,
                align === 'left' && styles.wheelItemTextLeft,
                align === 'right' && styles.wheelItemTextRight,
                {
                  opacity: scrollY.interpolate({
                    inputRange,
                    outputRange: WHEEL_CURVE_OPACITY,
                    extrapolate: 'clamp',
                  }),
                  transform: [
                    { perspective: WHEEL_PERSPECTIVE },
                    {
                      rotateX: scrollY.interpolate({
                        inputRange,
                        outputRange: WHEEL_CURVE_ROTATE_X,
                        extrapolate: 'clamp',
                      }),
                    },
                    {
                      translateY: scrollY.interpolate({
                        inputRange,
                        outputRange: WHEEL_CURVE_TRANSLATE_Y,
                        extrapolate: 'clamp',
                      }),
                    },
                  ],
                },
              ]}
            >
              {formatLabel(item)}
            </Animated.Text>
          </View>
        );
      }),
    // `curveEpoch` is the first-paint republish above; it belongs here even
    // though the rows never read it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [align, curveEpoch, formatLabel, itemStyle, scrollY, values],
  );

  const settle = (offsetY: number) => {
    const index = Math.max(0, Math.min(values.length - 1, Math.round(offsetY / WHEEL_ITEM_HEIGHT)));
    const snapped = index * WHEEL_ITEM_HEIGHT;
    if (Math.abs(offsetY - snapped) > 0.5) {
      scrollRef.current?.scrollTo({ y: snapped, animated: true });
    }
    const next = values[index];
    if (next !== selectedValue) onChange(next);
  };

  return (
    <Animated.ScrollView
      ref={scrollRef}
      hitSlop={hitSlop}
      style={[{ width, height: WHEEL_ITEM_HEIGHT * WHEEL_VISIBLE_ROWS, overflow: 'hidden' }, style]}
      contentContainerStyle={{ paddingVertical: WHEEL_PAD }}
      showsVerticalScrollIndicator={false}
      snapToInterval={WHEEL_ITEM_HEIGHT}
      decelerationRate={decelerationRate}
      bounces={bounces}
      alwaysBounceVertical={bounces}
      overScrollMode={bounces ? 'auto' : 'never'}
      nestedScrollEnabled
      scrollEventThrottle={16}
      onScrollBeginDrag={() => {
        isDragging.current = true;
      }}
      onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
      onMomentumScrollEnd={(event) => {
        isDragging.current = false;
        settle(event.nativeEvent.contentOffset.y);
      }}
      onScrollEndDrag={(event) => {
        if ((event.nativeEvent.velocity?.y ?? 0) === 0) {
          isDragging.current = false;
          settle(event.nativeEvent.contentOffset.y);
        }
      }}
    >
      {rows}
    </Animated.ScrollView>
  );
}

function WheelRimFades() {
  return (
    <>
      <Svg pointerEvents="none" style={styles.wheelFadeTop}>
        <Defs>
          <LinearGradient id="savorWheelFadeTop" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.background} stopOpacity="0.88" />
            <Stop offset="0.45" stopColor={colors.background} stopOpacity="0.28" />
            <Stop offset="1" stopColor={colors.background} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#savorWheelFadeTop)" />
      </Svg>
      <Svg pointerEvents="none" style={styles.wheelFadeBottom}>
        <Defs>
          <LinearGradient id="savorWheelFadeBottom" x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0" stopColor={colors.background} stopOpacity="0.88" />
            <Stop offset="0.45" stopColor={colors.background} stopOpacity="0.28" />
            <Stop offset="1" stopColor={colors.background} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#savorWheelFadeBottom)" />
      </Svg>
    </>
  );
}

function BirthDateSelector({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [year, month, day] = value.split('-').map(Number);
  const setPart = (nextYear: number, nextMonth: number, nextDay: number) => {
    const daysInMonth = new Date(nextYear, nextMonth, 0).getDate();
    onChange(
      `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(Math.min(nextDay, daysInMonth)).padStart(2, '0')}`,
    );
  };
  const dayCount = new Date(year, month, 0).getDate();
  const dayValues = useMemo(() => Array.from({ length: dayCount }, (_, index) => index + 1), [dayCount]);

  return (
    <View style={styles.dateWheel}>
      <View style={styles.dateWheelInner}>
        <View pointerEvents="none" style={styles.dateWheelSelection} />
        <View style={styles.dateWheelColumns}>
          <WheelColumn
            width={130}
            itemStyle={styles.monthWheelTouchItem}
            decelerationRate="normal"
            bounces
            style={[styles.monthWheelColumn, styles.monthWheelTouchColumn]}
            values={MONTH_VALUES}
            selectedValue={month}
            formatLabel={formatMonthLabel}
            onChange={(next) => setPart(year, next, day)}
          />
          <WheelColumn
            width={44}
            decelerationRate="normal"
            bounces
            style={styles.dayWheelColumn}
            values={dayValues}
            selectedValue={Math.min(day, dayCount)}
            onChange={(next) => setPart(year, month, next)}
          />
          <WheelColumn
            width={104}
            itemStyle={styles.yearWheelTouchItem}
            decelerationRate="normal"
            bounces
            style={styles.yearWheelTouchColumn}
            values={YEAR_VALUES}
            selectedValue={Math.min(MAX_BIRTH_YEAR, Math.max(MIN_BIRTH_YEAR, year))}
            onChange={(next) => setPart(next, month, day)}
          />
        </View>
        <WheelRimFades />
        <View pointerEvents="none" style={[styles.birthdayWheelClip, styles.birthdayWheelClipTop]} />
        <View pointerEvents="none" style={[styles.birthdayWheelClip, styles.birthdayWheelClipBottom]} />
      </View>
    </View>
  );
}

function HeightSelector({ valueCm, onChange }: { valueCm: number; onChange: (valueCm: number) => void }) {
  const [unit, setUnit] = useState<'imperial' | 'metric'>('imperial');
  const togglePosition = useRef(new Animated.Value(0)).current;
  const totalInches = Math.round(valueCm / 2.54);
  const feet = Math.min(8, Math.max(1, Math.floor(totalInches / 12)));
  const inches = totalInches - feet * 12;
  const centimeters = Math.min(272, Math.max(30, Math.round(valueCm)));

  const setHeight = (nextFeet: number, nextInches: number) => {
    onChange(Math.round((nextFeet * 12 + nextInches) * 2.54));
  };

  useEffect(() => {
    Animated.spring(togglePosition, {
      toValue: unit === 'imperial' ? 0 : 92,
      damping: 18,
      stiffness: 180,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  }, [togglePosition, unit]);

  return (
    <View style={styles.heightSelector}>
      <View style={styles.heightUnitToggle}>
        <Animated.View
          pointerEvents="none"
          style={[styles.heightUnitSlider, { transform: [{ translateX: togglePosition }] }]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: unit === 'imperial' }}
          onPress={() => setUnit('imperial')}
          style={styles.heightUnitOption}
        >
          <Text style={styles.heightUnitText}>ft, in</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: unit === 'metric' }}
          onPress={() => setUnit('metric')}
          style={styles.heightUnitOption}
        >
          <Text style={styles.heightUnitText}>cm</Text>
        </Pressable>
      </View>

      <View style={styles.dateWheel}>
        <View style={styles.dateWheelInner}>
          <View pointerEvents="none" style={styles.dateWheelSelection} />
          {unit === 'imperial' ? (
            <View style={[styles.dateWheelColumns, styles.heightWheelColumns]}>
              <WheelColumn
                key="height-feet"
                width={62}
                align="right"
                decelerationRate="normal"
                bounces
                values={FOOT_VALUES}
                selectedValue={feet}
                formatLabel={formatFeetLabel}
                onChange={(next) => setHeight(next, inches)}
              />
              <WheelColumn
                key="height-inches"
                width={62}
                align="left"
                decelerationRate="normal"
                bounces
                values={INCH_VALUES}
                selectedValue={inches}
                formatLabel={formatInchesLabel}
                onChange={(next) => setHeight(feet, next)}
              />
            </View>
          ) : (
            <View style={styles.dateWheelColumns}>
              <WheelColumn
                key="height-centimeters"
                width={90}
                decelerationRate="normal"
                bounces
                values={CENTIMETER_VALUES}
                selectedValue={centimeters}
                formatLabel={formatCentimeterLabel}
                onChange={onChange}
              />
            </View>
          )}
          <WheelRimFades />
          <View pointerEvents="none" style={[styles.birthdayWheelClip, styles.birthdayWheelClipTop]} />
          <View pointerEvents="none" style={[styles.birthdayWheelClip, styles.birthdayWheelClipBottom]} />
        </View>
      </View>
    </View>
  );
}

const KG_PER_LB = 0.45359237;
const WEIGHT_STEP = 0.1;
const WEIGHT_TICK_SPACING = 12;
const KG_WEIGHTS = Array.from({ length: 2151 }, (_, index) => Math.round((35 + index * WEIGHT_STEP) * 10) / 10);
const LB_WEIGHTS = Array.from({ length: 4751 }, (_, index) => Math.round((75 + index * WEIGHT_STEP) * 10) / 10);

function WeightTickStrip({ values, hidden = false }: { values: number[]; hidden?: boolean }) {
  const paths = useMemo(() => {
    const segments = { small: [] as string[], medium: [] as string[], major: [] as string[] };
    values.forEach((value, index) => {
      const x = index * WEIGHT_TICK_SPACING + WEIGHT_TICK_SPACING / 2;
      const tenths = Math.round(value * 10);
      const kind = tenths % 10 === 0 ? 'major' : tenths % 5 === 0 ? 'medium' : 'small';
      const top = kind === 'major' ? 29 : kind === 'medium' ? 42 : 48;
      segments[kind].push(`M${x} ${top}V78`);
    });
    return segments;
  }, [values]);

  return (
    <Svg
      width={values.length * WEIGHT_TICK_SPACING}
      height={78}
      style={hidden ? styles.weightTicksHidden : undefined}
    >
      <Path d={paths.small.join('')} stroke="#99999F" strokeWidth={1.5} />
      <Path d={paths.medium.join('')} stroke="#8A8A90" strokeWidth={1.5} />
      <Path d={paths.major.join('')} stroke="#77777D" strokeWidth={2} />
    </Svg>
  );
}

function WeightRuler({
  values,
  selectedValue,
  referenceValue,
  boundaryContinuation,
  fullRulerValues,
  onChange,
}: {
  values: number[];
  selectedValue: number;
  referenceValue?: number;
  boundaryContinuation?: 'left' | 'right';
  fullRulerValues?: number[];
  onChange: (value: number) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const width = Dimensions.get('window').width;
  const selectedIndex = Math.max(0, Math.min(values.length - 1, Math.round((selectedValue - values[0]) / WEIGHT_STEP)));
  const referenceIndex = referenceValue === undefined
    ? selectedIndex
    : Math.max(0, Math.min(values.length - 1, Math.round((referenceValue - values[0]) / WEIGHT_STEP)));
  const differentialToRight = boundaryContinuation
    ? boundaryContinuation === 'right'
    : referenceIndex >= selectedIndex;
  const scrollX = useRef(new Animated.Value(selectedIndex * WEIGHT_TICK_SPACING)).current;
  const referenceOffset = referenceIndex * WEIGHT_TICK_SPACING;
  const animatedDifferentialWidth = differentialToRight
    ? Animated.subtract(referenceOffset, scrollX)
    : Animated.subtract(scrollX, referenceOffset);
  const lastIndex = useRef(selectedIndex);
  const isScrolling = useRef(false);
  const suppressScroll = useRef(true);
  const initialOffset = useRef(selectedIndex * WEIGHT_TICK_SPACING);
  const fullRulerStartIndex = fullRulerValues
    ? Math.max(0, Math.round((values[0] - fullRulerValues[0]) / WEIGHT_STEP))
    : 0;

  useEffect(() => {
    if (!width || isScrolling.current) return;
    const offset = selectedIndex * WEIGHT_TICK_SPACING;
    lastIndex.current = selectedIndex;
    suppressScroll.current = true;
    scrollX.setValue(offset);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ x: offset, animated: false });
      requestAnimationFrame(() => {
        suppressScroll.current = false;
      });
    });
  }, [scrollX, selectedIndex, width]);

  const selectOffset = (offsetX: number) => {
    if (suppressScroll.current) return;
    const index = Math.max(0, Math.min(values.length - 1, Math.round(offsetX / WEIGHT_TICK_SPACING)));
    if (index !== lastIndex.current) {
      lastIndex.current = index;
      onChange(values[index]);
    }
  };

  return (
    <View style={styles.weightRuler}>
      <Animated.ScrollView
        ref={scrollRef}
        contentOffset={{ x: initialOffset.current, y: 0 }}
        horizontal
        bounces={false}
        overScrollMode="never"
        decelerationRate="normal"
        snapToInterval={WEIGHT_TICK_SPACING}
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingHorizontal: Math.max(0, (width - WEIGHT_TICK_SPACING) / 2) }}
        onScrollBeginDrag={() => {
          isScrolling.current = true;
        }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          {
            useNativeDriver: false,
            listener: (event: { nativeEvent: { contentOffset: { x: number } } }) => {
              selectOffset(event.nativeEvent.contentOffset.x);
            },
          },
        )}
        onMomentumScrollEnd={() => {
          isScrolling.current = false;
          suppressScroll.current = false;
        }}
        onScrollEndDrag={(event) => {
          if ((event.nativeEvent.velocity?.x ?? 0) === 0) isScrolling.current = false;
        }}
      >
        <WeightTickStrip values={values} hidden={Boolean(fullRulerValues)} />
      </Animated.ScrollView>
      {fullRulerValues ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.weightFullTickStrip,
            {
              left: width / 2 - WEIGHT_TICK_SPACING / 2 - fullRulerStartIndex * WEIGHT_TICK_SPACING,
              width: fullRulerValues.length * WEIGHT_TICK_SPACING,
              transform: [{ translateX: Animated.multiply(scrollX, -1) }],
            },
          ]}
        >
          <WeightTickStrip values={fullRulerValues} />
        </Animated.View>
      ) : null}
      {referenceValue !== undefined ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.weightDifferential,
            differentialToRight
              ? { left: '50%', width: animatedDifferentialWidth }
              : { right: '50%', width: animatedDifferentialWidth },
          ]}
        />
      ) : null}
      <View pointerEvents="none" style={styles.weightRulerIndicator} />
    </View>
  );
}

function WeightSelector({
  valueKg,
  unit,
  onUnitChange,
  onChange,
}: {
  valueKg: number;
  unit: 'lbs' | 'kg';
  onUnitChange: (unit: 'lbs' | 'kg') => void;
  onChange: (valueKg: number) => void;
}) {
  const togglePosition = useRef(new Animated.Value(0)).current;
  const pounds = valueKg / KG_PER_LB;
  const rulerValues = unit === 'lbs' ? LB_WEIGHTS : KG_WEIGHTS;
  const rulerValue = unit === 'lbs' ? pounds : valueKg;

  useEffect(() => {
    Animated.spring(togglePosition, {
      toValue: unit === 'lbs' ? 0 : 92,
      damping: 18,
      stiffness: 180,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  }, [togglePosition, unit]);

  return (
    <View style={styles.weightSelector}>
      <View style={[styles.heightUnitToggle, styles.weightUnitTogglePosition]}>
        <Animated.View
          pointerEvents="none"
          style={[styles.heightUnitSlider, { transform: [{ translateX: togglePosition }] }]}
        />
        <Pressable onPress={() => onUnitChange('lbs')} style={styles.heightUnitOption}>
          <Text style={styles.heightUnitText}>lbs</Text>
        </Pressable>
        <Pressable onPress={() => onUnitChange('kg')} style={styles.heightUnitOption}>
          <Text style={styles.heightUnitText}>kg</Text>
        </Pressable>
      </View>

      <View style={styles.weightReadout}>
        <Text style={styles.weightReadoutLabel}>Current weight</Text>
        <View style={styles.weightReadoutNumber}>
          <AnimatedNumber
            value={unit === 'lbs' ? pounds : valueKg}
            decimals={1}
            suffix={` ${unit}`}
            style={styles.weightReadoutValue}
            fadeColor={colors.background}
          />
        </View>
      </View>

      <WeightRuler
        values={rulerValues}
        selectedValue={rulerValue}
        onChange={(value) => onChange(unit === 'lbs' ? value * KG_PER_LB : value)}
      />
    </View>
  );
}

function TargetWeightSelector({
  goal,
  unit,
  currentWeightKg,
  valueKg,
  onChange,
}: {
  goal: WeightGoal;
  unit: 'lbs' | 'kg';
  currentWeightKg: number;
  valueKg: number;
  onChange: (valueKg: number) => void;
}) {
  const pounds = valueKg / KG_PER_LB;
  const currentWeight = unit === 'lbs' ? currentWeightKg / KG_PER_LB : currentWeightKg;
  const roundedCurrentWeight = Math.round(currentWeight / WEIGHT_STEP) * WEIGHT_STEP;
  const allValues = unit === 'lbs' ? LB_WEIGHTS : KG_WEIGHTS;
  const rulerValues = allValues.filter((value) => goal === 'gain' ? value >= roundedCurrentWeight : value <= roundedCurrentWeight);
  const rulerValue = unit === 'lbs' ? pounds : valueKg;
  const difference = rulerValue - currentWeight;
  const differencePrefix = difference > 0 ? '+' : difference < 0 ? '−' : '';

  return (
    <View style={styles.weightSelector}>
      <View style={styles.weightReadout}>
        <Text style={styles.weightReadoutLabel}>{goal === 'gain' ? 'Gain weight' : 'Lose weight'}</Text>
        <View style={styles.weightReadoutNumber}>
          <AnimatedNumber
            value={rulerValue}
            decimals={1}
            suffix={` ${unit}`}
            style={styles.weightReadoutValue}
            fadeColor={colors.background}
          />
        </View>
        <Text style={styles.targetWeightDifference}>
          {differencePrefix}{Math.abs(difference).toFixed(1)} {unit}
        </Text>
      </View>
      <WeightRuler
        values={rulerValues}
        selectedValue={rulerValue}
        referenceValue={roundedCurrentWeight}
        boundaryContinuation={goal === 'gain' ? 'left' : 'right'}
        fullRulerValues={allValues}
        onChange={(value) => onChange(unit === 'lbs' ? value * KG_PER_LB : value)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 24, paddingTop: 18 },
  back: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#F8F8FA', alignItems: 'center', justifyContent: 'center' },
  progressTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#E6E6E6', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.text },
  formContent: { flexGrow: 1, padding: 28 },
  outlinedHeaderBlock: { minHeight: 132 },
  title: { fontSize: 38, lineHeight: 44, fontWeight: '800', color: colors.text, letterSpacing: -1.2 },
  genderTitle: { fontSize: 35, lineHeight: 41, fontWeight: '500' },
  subtitle: { marginTop: 18, fontSize: 19, lineHeight: 27, color: colors.textSecondary },
  genderSubtitle: { marginTop: 14, fontSize: 18, fontWeight: '300' },
  inputArea: { flex: 1, justifyContent: 'center', paddingVertical: 36 },
  choiceList: { gap: 14 },
  outlinedChoiceList: { gap: 16 },
  choice: { minHeight: 92, borderRadius: 20, backgroundColor: '#F8F8FA', paddingHorizontal: 24, paddingVertical: 20, justifyContent: 'space-between', alignItems: 'center', flexDirection: 'row' },
  lightChoice: { height: 66, minHeight: 66, paddingHorizontal: 18, paddingVertical: 8, justifyContent: 'flex-start', gap: 16, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#E2E3E8' },
  activityChoice: { height: 90, minHeight: 90 },
  lightChoiceSelected: { backgroundColor: '#FFFFFF', borderColor: colors.text },
  lightChoiceContent: { flex: 1, alignItems: 'flex-start', justifyContent: 'center' },
  genderIconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F8F8FA', alignItems: 'center', justifyContent: 'center' },
  singleActivityDot: { width: 13, height: 13, borderRadius: 7, backgroundColor: colors.text },
  threeActivityDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.text },
  smallActivityDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.text },
  threeDotPattern: { width: 19, height: 18, alignItems: 'center', justifyContent: 'space-between' },
  threeDotBottom: { width: 19, flexDirection: 'row', justifyContent: 'space-between' },
  sixDotPattern: { width: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  radioOuter: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#D8D9DF', alignItems: 'center', justifyContent: 'center' },
  radioOuterSelected: { borderColor: colors.text, backgroundColor: colors.text },
  radioInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' },
  choiceSelected: { backgroundColor: colors.text },
  choiceLabel: { fontSize: 22, fontWeight: '700', color: colors.text },
  lightChoiceLabel: { fontSize: 17, fontWeight: '500', textAlign: 'left' },
  activityChoiceLabel: { fontSize: 16 },
  lightChoiceDetail: { marginTop: 3, fontSize: 13, lineHeight: 17, fontWeight: '400', color: colors.textSecondary },
  activityChoiceDetail: { marginTop: 1, fontSize: 12, lineHeight: 15 },
  choiceDetail: { marginTop: 6, fontSize: 16, color: colors.textSecondary },
  choiceTextSelected: { color: '#FFFFFF' },
  footer: { borderTopWidth: 1, borderTopColor: '#EEEEEE', paddingHorizontal: 24, paddingTop: 18, paddingBottom: 12 },
  primaryButton: { minHeight: 64, borderRadius: 32, backgroundColor: colors.buttonPrimaryBg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  primaryButtonDisabled: { opacity: 0.35 },
  primaryButtonText: { color: colors.buttonPrimaryText, fontSize: 19, fontWeight: '600' },
  continueButtonText: { fontSize: 18, fontWeight: '500' },
  welcome: { flex: 1, padding: 30, alignItems: 'center', justifyContent: 'center' },
  brandMark: {
    width: 84,
    height: 84,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: colors.text,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: { fontSize: 20, fontWeight: '700', marginTop: 2 },
  heroTitle: { marginTop: 48, fontSize: 44, lineHeight: 49, fontWeight: '800', letterSpacing: -1.6, textAlign: 'center' },
  heroBody: { fontSize: 18, lineHeight: 26, color: colors.textSecondary, textAlign: 'center', marginTop: 18 },
  welcomeActions: { alignSelf: 'stretch', marginTop: 56, gap: 22 },
  signIn: { textAlign: 'center', fontSize: 17 },
  bold: { fontWeight: '800' },
  dateWheel: {
    height: WHEEL_ITEM_HEIGHT * WHEEL_VISIBLE_ROWS - 4,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    alignSelf: 'center',
    overflow: 'hidden',
  },
  dateWheelInner: {
    position: 'relative',
    width: '100%',
    height: WHEEL_ITEM_HEIGHT * WHEEL_VISIBLE_ROWS,
  },
  dateWheelColumns: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 48,
    transform: [{ translateX: -4 }],
  },
  monthWheelTouchColumn: { marginLeft: -40 },
  monthWheelTouchItem: { paddingLeft: 40 },
  yearWheelTouchColumn: { marginRight: -40 },
  yearWheelTouchItem: { paddingRight: 40 },
  heightSelector: { width: '100%', position: 'relative' },
  heightUnitToggle: {
    position: 'absolute',
    top: -86,
    left: '50%',
    marginLeft: -95,
    zIndex: 3,
    width: 190,
    height: 38,
    padding: 3,
    borderRadius: 19,
    backgroundColor: '#EEEEF0',
    flexDirection: 'row',
  },
  heightUnitSlider: {
    position: 'absolute',
    left: 3,
    top: 3,
    width: 92,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  heightUnitOption: { flex: 1, zIndex: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  heightUnitText: { fontSize: 15, fontWeight: '500', color: colors.text },
  heightWheelColumns: { gap: 32, paddingHorizontal: 24, transform: [] },
  weightUnitTogglePosition: { top: -84 },
  weightSelector: {
    width: '100%',
    height: WHEEL_ITEM_HEIGHT * WHEEL_VISIBLE_ROWS,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weightReadout: { alignItems: 'center', marginBottom: 24 },
  weightReadoutLabel: { fontSize: 14, fontWeight: '400', color: '#8A8A8E' },
  weightReadoutNumber: { marginTop: 4, flexDirection: 'row', alignItems: 'center' },
  weightReadoutValue: { fontSize: 30, lineHeight: 36, fontWeight: '600', color: colors.text },
  targetWeightDifference: { marginTop: 3, fontSize: 13, fontWeight: '500', color: '#8A8A8E' },
  weightRuler: { width: Dimensions.get('window').width, height: 78, overflow: 'hidden' },
  weightTicksHidden: { opacity: 0 },
  weightFullTickStrip: {
    position: 'absolute',
    bottom: 0,
    height: 78,
    flexDirection: 'row',
  },
  weightDifferential: {
    position: 'absolute',
    bottom: 0,
    height: 30,
    backgroundColor: 'rgba(142, 142, 147, 0.2)',
  },
  weightRulerIndicator: {
    position: 'absolute',
    left: '50%',
    bottom: 0,
    marginLeft: -2,
    width: 4,
    height: 72,
    backgroundColor: colors.text,
  },
  monthWheelColumn: { marginRight: 6, transform: [{ translateX: 14 }] },
  dayWheelColumn: { marginRight: 4, transform: [{ translateX: 8 }] },
  dateWheelSelection: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: WHEEL_ITEM_HEIGHT * WHEEL_CENTER_ROW,
    height: WHEEL_ITEM_HEIGHT,
    borderRadius: WHEEL_ITEM_HEIGHT / 2,
    backgroundColor: '#F2F2F7',
  },
  birthdayWheelClip: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    zIndex: 4,
    backgroundColor: colors.background,
  },
  birthdayWheelClipTop: { top: 0 },
  birthdayWheelClipBottom: { bottom: 0 },
  wheelFadeTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: WHEEL_ITEM_HEIGHT * 0.95,
    zIndex: 2,
  },
  wheelFadeBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: WHEEL_ITEM_HEIGHT * 0.95,
    zIndex: 2,
  },
  wheelItem: { height: WHEEL_ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  wheelItemLeft: { alignItems: 'flex-start' },
  wheelItemRight: { alignItems: 'flex-end' },
  wheelItemText: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '400',
    letterSpacing: -0.25,
    textAlign: 'center',
    includeFontPadding: false,
    ...(Platform.OS === 'ios' ? { fontFamily: 'System' } : null),
  },
  wheelItemTextLeft: { textAlign: 'left' },
  wheelItemTextRight: { textAlign: 'right' },
  processing: { flex: 1, padding: 28, justifyContent: 'center', alignItems: 'center' },
  processingRing: { width: PROCESSING_RING_SIZE, height: PROCESSING_RING_SIZE, alignItems: 'center', justifyContent: 'center' },
  processingRingPercent: { position: 'absolute', fontSize: 32, fontWeight: '600', color: colors.text },
  percent: { fontSize: 72, fontWeight: '800' },
  processingTitle: { fontSize: 35, lineHeight: 42, fontWeight: '800', textAlign: 'center', marginTop: 20 },
  loadingTrack: { height: 12, borderRadius: 6, backgroundColor: '#DDDDDD', width: '100%', marginTop: 42, overflow: 'hidden' },
  loadingFill: { width: '82%', height: '100%', backgroundColor: '#111111' },
  processingCaption: { fontSize: 18, marginTop: 22 },
  summaryCard: { width: '100%', padding: 28, borderRadius: 22, backgroundColor: '#F8F8FA', marginTop: 40 },
  summaryHeading: { fontSize: 20, fontWeight: '800', marginBottom: 10 },
  summaryLine: { fontSize: 19, lineHeight: 31 },
  resultContent: { paddingHorizontal: 28, paddingVertical: 26, alignItems: 'center' },
  resultPageBackground: { backgroundColor: colors.page },
  resultBack: { alignSelf: 'flex-start', width: 42, height: 42, borderRadius: 21, backgroundColor: '#F8F8FA', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  resultTitle: { fontSize: 35, lineHeight: 41, fontWeight: '800', textAlign: 'center', marginTop: 14 },
  resultSubtitle: { fontSize: 18, lineHeight: 26, textAlign: 'center', marginTop: 18 },
  resultPlan: { width: Dimensions.get('window').width, alignSelf: 'center', paddingVertical: 12, marginVertical: 32 },
  resultCardTitle: { fontSize: 24, fontWeight: '800', marginHorizontal: 36 },
  muted: { color: colors.textMuted, fontSize: 16, marginTop: 5, marginBottom: 18, marginHorizontal: 36 },
  resultCalorieCard: { backgroundColor: colors.card, borderRadius: 24, paddingVertical: 12, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 126 },
  resultCalorieCopy: { flex: 1, paddingRight: 12, paddingLeft: 16 },
  resultCalorieValue: { color: colors.text, fontSize: 36, fontWeight: '600', letterSpacing: -1, lineHeight: 41 },
  resultMetricLabel: { color: colors.textMuted, fontSize: 14, marginTop: 1 },
  resultPagerPage: { gap: 10, paddingHorizontal: 36 },
  resultMacroRow: { flexDirection: 'row', gap: 10 },
  resultMacroCard: { flex: 1, backgroundColor: colors.card, borderRadius: 19, paddingVertical: 8, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', minHeight: 126 },
  resultMacroValue: { color: colors.text, fontSize: 17, fontWeight: '600', lineHeight: 20 },
  resultMacroLabel: { color: colors.textMuted, fontSize: 11, marginTop: 1, marginBottom: 7, textAlign: 'center' },
  resultDetailRow: { flexDirection: 'row', gap: 10 },
  resultDetailCard: { flex: 1, backgroundColor: colors.card, borderRadius: 19, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', minHeight: 126 },
  resultDetailValue: { color: colors.text, fontSize: 18, fontWeight: '600', lineHeight: 21 },
  resultBmiCard: { alignItems: 'stretch', paddingHorizontal: 12 },
  resultBmiTitle: { color: colors.text, fontSize: 13, fontWeight: '700', paddingLeft: 10 },
  resultBmiValueRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 6, paddingLeft: 10 },
  resultBmiValue: { color: colors.text, fontSize: 25, lineHeight: 29, fontWeight: '700', letterSpacing: -0.5 },
  resultBmiBadge: { borderRadius: 12, paddingHorizontal: 7, paddingVertical: 3 },
  resultBmiBadgeText: { fontSize: 10, fontWeight: '700' },
  bmiScaleWrap: { height: 20, justifyContent: 'center', marginTop: 7, marginHorizontal: 10 },
  bmiScale: { height: 7, borderRadius: 4, overflow: 'hidden', flexDirection: 'row', gap: 2 },
  bmiScaleSegment: { height: '100%' },
  bmiUnderweight: { flex: 8.5, backgroundColor: '#6796DC' },
  bmiHealthy: { flex: 6.5, backgroundColor: '#28AA6B' },
  bmiOverweight: { flex: 5, backgroundColor: '#E5B560' },
  bmiObese: { flex: 10, backgroundColor: '#DE666A' },
  bmiMarker: { position: 'absolute', width: 3, height: 17, borderRadius: 2, backgroundColor: colors.text, marginLeft: -1.5 },
  resultPagerDots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 14 },
  resultPagerDot: { width: 7, height: 7, borderRadius: 3.5, borderWidth: 1, borderColor: colors.border, backgroundColor: 'transparent' },
  resultPagerDotActive: { borderWidth: 1.5, borderColor: colors.text, backgroundColor: colors.text },
  saveProgressPage: { flex: 1, paddingHorizontal: 28, paddingTop: 46, paddingBottom: 28 },
  saveProgressIntro: {},
  saveProgressTitle: { fontSize: 37, lineHeight: 43 },
  saveProgressActions: { marginTop: 'auto', marginBottom: 'auto', gap: 14 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.22)' },
  authIsland: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 36, borderTopRightRadius: 36, overflow: 'hidden' },
  authHeader: { minHeight: 68, borderBottomWidth: 1, borderBottomColor: '#E7E7E7', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  authTitle: { fontSize: 23, fontWeight: '600', color: colors.text },
  closeButton: { position: 'absolute', top: 15, right: 22, zIndex: 2, width: 38, height: 38, borderRadius: 19, backgroundColor: '#F8F8F8', alignItems: 'center', justifyContent: 'center' },
  authBody: { paddingHorizontal: 28, paddingTop: 28, paddingBottom: 52, gap: 14 },
  providerButton: { minHeight: 56, borderRadius: 28, borderWidth: 1.5, borderColor: '#D9D9DF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  appleButton: { backgroundColor: '#000000', borderColor: '#000000' },
  appleButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '600' },
  providerButtonText: { color: colors.text, fontSize: 18, fontWeight: '600' },
  authInput: { minHeight: 56, borderRadius: 16, borderWidth: 1.5, borderColor: '#DDDEE3', paddingHorizontal: 18, fontSize: 17, color: colors.text, backgroundColor: '#FAFAFB' },
  authSubmit: { minHeight: 60, borderRadius: 30, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  authSubmitDisabled: { opacity: 0.45 },
  authError: { color: '#C93C3C', fontSize: 14, lineHeight: 19 },
  privacyCopy: { textAlign: 'center', fontSize: 13, lineHeight: 19, color: colors.textMuted, marginTop: 10, paddingHorizontal: 12 },
});
