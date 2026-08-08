export type NutritionMacros = {
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  /** Sodium in milligrams. */
  sodium: number;
};

export type NutritionInfo = {
  foodName: string;
  calories: number;
  macros: NutritionMacros;
  healthScore: number;
  description: string;
  nutritionTips: string[];
  foodPresenceConfidence?: number;
  identificationConfidence?: number;
  /** Estimated fraction of the original portion still visible, from 0 to 1. */
  remainingFraction?: number;
  /** Local file URI or remote download URL for the meal photo. */
  imageUrl?: string;
};
