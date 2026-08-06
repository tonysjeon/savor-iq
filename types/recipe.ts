export type Recipe = {
  title: string;
  ingredients: string[];
  steps: string[];
  imageUrl: string;
  nutrition: string;
  preparationMethod: string;
  servings: number;
};

export const DIET_OPTIONS = [
  'None',
  'Vegan',
  'Nut-free',
  'Vegetarian',
  'Keto',
  'Gluten-free',
  'Dairy-free',
] as const;

export const PREPARATION_METHODS = [
  'Any Method',
  'Steamed',
  'Baked',
  'Slow Cooked',
  'Grilled',
  'Stir Fried',
  'Fried',
  'Raw/Fresh',
] as const;

export const SERVING_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10, 12] as const;

export const INGREDIENT_PRESETS = [
  'Chicken',
  'Tofu',
  'Eggs',
  'Salmon',
  'Pasta',
  'Rice',
  'Beans',
  'Mixed vegetables',
  'Leftover-friendly',
] as const;

export type DietOption = (typeof DIET_OPTIONS)[number];
export type PreparationMethod = (typeof PREPARATION_METHODS)[number];
export type IngredientPreset = (typeof INGREDIENT_PRESETS)[number];
export type ServingOption = (typeof SERVING_OPTIONS)[number];
