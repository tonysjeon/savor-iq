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
};
