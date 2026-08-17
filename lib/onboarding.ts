import AsyncStorage from '@react-native-async-storage/async-storage';

export type Gender = 'male' | 'female' | 'other';
export type WorkoutFrequency = '0-2' | '3-5' | '6+';
export type WeightGoal = 'lose' | 'maintain' | 'gain';

export type OnboardingProfile = {
  gender: Gender | null;
  workoutFrequency: WorkoutFrequency | null;
  heightCm: number;
  weightKg: number;
  birthDate: string;
  goal: WeightGoal;
  targetWeightKg: number | null;
};

export type NutritionRecommendation = {
  bmi: number;
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  waterMl: number;
  fiberGrams: number;
  sugarGrams: number;
  sodiumMg: number;
};

const DRAFT_KEY = 'savor-iq:onboarding-draft';

export const defaultOnboardingProfile: OnboardingProfile = {
  gender: null,
  workoutFrequency: null,
  heightCm: 165,
  weightKg: 54.4310844,
  birthDate: '2024-01-01',
  goal: 'maintain',
  targetWeightKg: null,
};

function ageFromBirthDate(birthDate: string) {
  const birth = new Date(`${birthDate}T12:00:00`);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (
    now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())
  ) {
    age -= 1;
  }
  return Math.max(18, age);
}

export function calculateRecommendation(profile: OnboardingProfile): NutritionRecommendation {
  const heightM = profile.heightCm / 100;
  const bmi = profile.weightKg / (heightM * heightM);
  const sexAdjustment = profile.gender === 'male' ? 5 : profile.gender === 'female' ? -161 : -78;
  const bmr =
    10 * profile.weightKg + 6.25 * profile.heightCm - 5 * ageFromBirthDate(profile.birthDate) + sexAdjustment;
  const activityMultiplier =
    profile.workoutFrequency === '0-2' ? 1.3 : profile.workoutFrequency === '3-5' ? 1.55 : 1.725;
  const goalAdjustment = profile.goal === 'lose' ? -400 : profile.goal === 'gain' ? 350 : 0;
  const calories = Math.max(1200, Math.round((bmr * activityMultiplier + goalAdjustment) / 10) * 10);

  const proteinPerKg = profile.goal === 'maintain' ? 1.6 : 2;
  const proteinGrams = Math.round(profile.weightKg * proteinPerKg);
  const fatGrams = Math.round((calories * 0.27) / 9);
  const carbsGrams = Math.max(0, Math.round((calories - proteinGrams * 4 - fatGrams * 9) / 4));
  const waterMl = Math.max(1500, Math.round((profile.weightKg * 35) / 50) * 50);
  const fiberGrams = Math.round((calories / 1000) * 14);
  const sugarGrams = Math.round((calories * 0.1) / 4);
  const sodiumMg = Math.min(2300, Math.max(1500, Math.round(calories / 50) * 50));

  return {
    bmi: Math.round(bmi * 10) / 10,
    calories,
    proteinGrams,
    carbsGrams,
    fatGrams,
    waterMl,
    fiberGrams,
    sugarGrams,
    sodiumMg,
  };
}

export async function saveOnboardingDraft(profile: OnboardingProfile) {
  await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(profile));
}

export async function getOnboardingDraft(): Promise<OnboardingProfile | null> {
  const value = await AsyncStorage.getItem(DRAFT_KEY);
  if (!value) return null;
  try {
    return JSON.parse(value) as OnboardingProfile;
  } catch {
    return null;
  }
}

export async function clearOnboardingDraft() {
  await AsyncStorage.removeItem(DRAFT_KEY);
}
