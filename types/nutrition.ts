export type NutritionMacros = {
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};

export type NutritionInfo = {
  foodName: string;
  calories: number;
  macros: NutritionMacros;
  healthScore: number;
  description: string;
  nutritionTips: string[];
  /** Local file URI or remote download URL for the meal photo. */
  imageUrl?: string;
};
