import { outputLanguageInstruction } from '@/lib/i18n';
import type { MealPlan } from '@/types/mealPlan';
import { weekdaysStartingFrom } from '@/types/mealPlan';
import type { NutritionInfo } from '@/types/nutrition';
import type { Recipe } from '@/types/recipe';

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const TEXT_MODEL = 'gemini-3.5-flash';
const VISION_MODEL = 'gemini-3.5-flash';

export const isGeminiConfigured = Boolean(API_KEY);

type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

type GeminiResponse = {
  candidates?: Array<{
    finishReason?: string;
    content?: {
      parts?: Array<{ text?: string; thought?: boolean }>;
    };
  }>;
};

const GEMINI_TIMEOUT_MS = 45_000;

async function post(
  model: string,
  parts: GeminiPart[],
  generationConfig?: Record<string, unknown>,
): Promise<GeminiResponse> {
  if (!API_KEY) {
    throw new Error(
      'Gemini is not configured. Add EXPO_PUBLIC_GEMINI_API_KEY to your .env and restart Expo.',
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(
      `${BASE_URL}/models/${model}:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          ...(generationConfig ? { generationConfig } : {}),
        }),
        signal: controller.signal,
      },
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Gemini timed out. Check your connection and try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${body}`);
  }

  return (await response.json()) as GeminiResponse;
}

function extractText(json: GeminiResponse): string {
  const candidate = json.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  const text = parts
    .filter((part) => !part.thought && typeof part.text === 'string')
    .map((part) => part.text!)
    .join('')
    .trim();

  if (!text) {
    throw new Error('Could not parse text from Gemini response');
  }

  if (candidate?.finishReason === 'MAX_TOKENS') {
    throw new Error(
      'Gemini ran out of output tokens before finishing. Try again.',
    );
  }

  return text;
}

function parseJsonObject(raw: string): Record<string, unknown> {
  const cleaned = stripJsonFences(raw);
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    throw new Error('Could not parse JSON from Gemini response.');
  }
}

function stripJsonFences(raw: string): string {
  let cleaned = raw.replace(/```json|```/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) cleaned = match[0];
  return cleaned;
}

function themeImageUrl(recipeTitle: string): string {
  const t = recipeTitle.toLowerCase();

  if (t.includes('pasta') || t.includes('spaghetti') || t.includes('noodle')) {
    return 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&auto=format&fit=crop';
  }
  if (t.includes('salad') || t.includes('vegetable') || t.includes('vegan')) {
    return 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop';
  }
  if (t.includes('chicken') || t.includes('poultry')) {
    return 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=800&auto=format&fit=crop';
  }
  if (t.includes('beef') || t.includes('steak') || t.includes('meat')) {
    return 'https://images.unsplash.com/photo-1546241072-48010ad2862c?w=800&auto=format&fit=crop';
  }
  if (t.includes('soup') || t.includes('stew')) {
    return 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&auto=format&fit=crop';
  }
  if (t.includes('dessert') || t.includes('cake') || t.includes('sweet')) {
    return 'https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?w=800&auto=format&fit=crop';
  }
  if (t.includes('breakfast') || t.includes('egg') || t.includes('pancake')) {
    return 'https://images.unsplash.com/photo-1533089860892-a9b969b76ab6?w=800&auto=format&fit=crop';
  }
  if (t.includes('fish') || t.includes('seafood') || t.includes('salmon')) {
    return 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&auto=format&fit=crop';
  }
  if (t.includes('rice') || t.includes('biryani') || t.includes('pilaf')) {
    return 'https://images.unsplash.com/photo-1536304929831-ee1ca9d44906?w=800&auto=format&fit=crop';
  }
  if (t.includes('burger') || t.includes('sandwich') || t.includes('wrap')) {
    return 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop';
  }
  if (t.includes('pizza')) {
    return 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&auto=format&fit=crop';
  }
  if (t.includes('curry') || t.includes('dal') || t.includes('masala')) {
    return 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=800&auto=format&fit=crop';
  }

  return 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop';
}

function fallbackRecipe(
  ingredients: string,
  preparationMethod: string,
  servings: number,
): Recipe {
  const title = `Recipe with ${ingredients
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(', ')}`;

  return {
    title,
    ingredients: ingredients
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    steps: [
      'Prepare all ingredients.',
      'Combine in a suitable pan or dish.',
      `Cook using ${preparationMethod}.`,
      `Serve in ${servings} portions and enjoy!`,
    ],
    imageUrl: themeImageUrl(title),
    nutrition: 'Nutritional info not available',
    preparationMethod,
    servings,
  };
}

type RecipeJson = {
  title?: unknown;
  ingredients?: unknown;
  steps?: unknown;
  nutrition?: unknown;
};

export async function generateRecipe(
  ingredients: string,
  dietFilter: string,
  preparationMethod: string,
  servings: number,
): Promise<Recipe> {
  const diet =
    dietFilter === 'None' || dietFilter.trim() === '' ? '' : `${dietFilter} `;
  const method =
    preparationMethod === 'Any Method' || preparationMethod.trim() === ''
      ? 'any cooking method'
      : preparationMethod;

  try {
    const response = await post(
      TEXT_MODEL,
      [
        {
          text: `You are a professional chef. Create a ${diet}recipe using: ${ingredients}.
Preparation: ${method}. Servings: ${servings}.

Return ONLY valid JSON (no markdown, no extra text) with this exact shape:
{
  "title": "Recipe Name",
  "ingredients": ["item 1", "item 2"],
  "steps": ["Step 1 description", "Step 2 description"],
  "nutrition": "Calories: ~X kcal | Protein: Xg | Carbs: Xg | Fat: Xg"
}${outputLanguageInstruction()}`,
        },
      ],
      {
        temperature: 0.7,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 },
      },
    );

    const raw = stripJsonFences(extractText(response));
    let data: RecipeJson;
    try {
      data = parseJsonObject(raw) as RecipeJson;
    } catch {
      return fallbackRecipe(ingredients, preparationMethod, servings);
    }

    const title =
      typeof data.title === 'string' && data.title.trim()
        ? data.title
        : `Recipe for ${ingredients}`;

    const recipeIngredients = Array.isArray(data.ingredients)
      ? data.ingredients.map(String)
      : ingredients
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

    const steps = Array.isArray(data.steps)
      ? data.steps.map(String)
      : ['Prepare all ingredients.', `Cook using ${method}.`];

    const nutrition =
      typeof data.nutrition === 'string' && data.nutrition.trim()
        ? data.nutrition
        : 'Nutritional info not available';

    return {
      title,
      ingredients: recipeIngredients,
      steps,
      imageUrl: themeImageUrl(title),
      nutrition,
      preparationMethod,
      servings,
    };
  } catch (error) {
    if (!isGeminiConfigured) {
      throw error;
    }
    return fallbackRecipe(ingredients, preparationMethod, servings);
  }
}

function toNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function isUnidentifiedFoodName(name: string): boolean {
  const n = name.trim().toLowerCase();
  if (!n) return true;
  return (
    n.includes('unknown') ||
    n.includes('unidentified') ||
    n.includes('unrecognizable') ||
    n.includes('not identifiable') ||
    n.includes('food not found') ||
    n.includes('cannot identify') ||
    n.includes("can't identify") ||
    n.includes('no food') ||
    n.includes('not food') ||
    n === 'n/a' ||
    n === 'none'
  );
}

function capitalizeFoodName(name: string): string {
  return name.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function hasNutritionEstimate(
  data: Record<string, unknown>,
  macros: Record<string, unknown>,
): boolean {
  return (
    toNumber(data.calories) > 0 ||
    ['protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium'].some(
      (key) => toNumber(macros[key]) > 0,
    )
  );
}

function parseNutrition(data: Record<string, unknown>): NutritionInfo {
  const macrosRaw =
    data.macros && typeof data.macros === 'object'
      ? (data.macros as Record<string, unknown>)
      : {};

  const tips = Array.isArray(data.nutritionTips)
    ? data.nutritionTips.map(String)
    : [];

  const rawFoodName =
    typeof data.foodName === 'string' ? data.foodName.trim() : '';

  if (isUnidentifiedFoodName(rawFoodName) && !hasNutritionEstimate(data, macrosRaw)) {
    throw new FoodNotDetectedError();
  }
  const foodName = isUnidentifiedFoodName(rawFoodName)
    ? 'Estimated Food Portion'
    : rawFoodName;

  return {
    foodName: capitalizeFoodName(foodName),
    calories: Math.round(toNumber(data.calories)),
    macros: {
      protein: toNumber(macrosRaw.protein),
      carbs: toNumber(macrosRaw.carbs),
      fat: toNumber(macrosRaw.fat),
      fiber: toNumber(macrosRaw.fiber),
      sugar: toNumber(macrosRaw.sugar),
      sodium: toNumber(macrosRaw.sodium),
    },
    healthScore: Math.min(10, Math.max(0, Math.round(toNumber(data.healthScore, 5)))),
    description:
      typeof data.description === 'string' ? data.description : '',
    nutritionTips: tips,
    foodPresenceConfidence: Math.min(
      1,
      Math.max(0, toNumber(data.foodPresenceConfidence, 0.5)),
    ),
    identificationConfidence: Math.min(
      1,
      Math.max(0, toNumber(data.identificationConfidence, 0.5)),
    ),
    remainingFraction: Math.min(
      1,
      Math.max(0, toNumber(data.remainingFraction, 1)),
    ),
  };
}

export class FoodNotDetectedError extends Error {
  readonly code = 'FOOD_NOT_DETECTED' as const;

  constructor() {
    super('Food not detected');
    this.name = 'FoodNotDetectedError';
  }
}

/** @deprecated Use FoodNotDetectedError */
export class NoFoodDetectedError extends FoodNotDetectedError {}

/** @deprecated Use FoodNotDetectedError */
export class UnknownFoodDetectedError extends FoodNotDetectedError {}

export function isFoodNotDetectedError(err: unknown): boolean {
  return (
    err instanceof FoodNotDetectedError ||
    (err instanceof Error &&
      (err.message === 'Food not detected' ||
        err.message === 'No food detected' ||
        err.message === 'Food not found' ||
        (err as { code?: string }).code === 'FOOD_NOT_DETECTED' ||
        (err as { code?: string }).code === 'NO_FOOD_DETECTED' ||
        (err as { code?: string }).code === 'UNKNOWN_FOOD_DETECTED'))
  );
}

export const isNoFoodDetectedError = isFoodNotDetectedError;
export const isUnknownFoodDetectedError = isFoodNotDetectedError;

function isFoodNotDetectedPayload(data: Record<string, unknown>): boolean {
  const saysNoFood =
    data.foodPresent === false ||
    data.foodNotDetected === true ||
    data.noFoodDetected === true ||
    data.unknownFoodDetected === true;
  if (!saysNoFood) return false;
  return toNumber(data.foodPresenceConfidence, 1) >= 0.95;
}

export async function analyzeNutritionFromImage(
  base64: string,
  mimeType: string = 'image/jpeg',
): Promise<NutritionInfo> {
  if (!base64) {
    throw new Error('No image data provided.');
  }

  const response = await post(
    VISION_MODEL,
    [
      {
        text: `Analyze this full camera image as a nutrition vision expert. Use the entire image for context, including the plate, bowl, paper, napkin, wrapper, utensils, and surrounding scale cues.

First decide whether ANY edible food is visible. Use a deliberately lenient detection threshold: small, cropped, stemless, partly eaten, unusual-looking, or packaged foods still count. Food on paper, a napkin, wrapper, tray, or plate still counts. Return foodPresent=false only when you are at least 95% confident there is no edible food anywhere in the image. If uncertain, make the best likely food identification instead of rejecting it.

When food is present, identify it using shape, color, texture, ingredients, and context. Estimate the original full portion, then estimate remainingFraction from 0 to 1 based on missing bites, crumbs, cut surfaces, empty container space, and visible volume. Calculate top-level calories and macros for ONLY the food currently remaining in the image by proportionally adjusting the full-portion values. If consumption is visually clear, include a concise adjective in foodName such as "Partially Eaten"; otherwise omit it.

Return ONLY compact JSON in one of these forms.
No food (only at >=0.95 confidence):
{"foodPresent":false,"foodPresenceConfidence":0.95}
Food present:
{"foodPresent":true,"foodPresenceConfidence":0.9,"foodName":"Specific Capitalized Food Name","identificationConfidence":0.8,"remainingFraction":0.75,"fullPortionNutrition":{"calories":0,"macros":{"protein":0,"carbs":0,"fat":0,"fiber":0,"sugar":0,"sodium":0}},"calories":0,"macros":{"protein":0,"carbs":0,"fat":0,"fiber":0,"sugar":0,"sodium":0},"healthScore":0,"description":"one short sentence","nutritionTips":["short tip","short tip"]}

Use Title Case for foodName. Protein, carbs, fat, fiber, and sugar are grams; sodium is milligrams. healthScore is 0-10. Keep text brief.${outputLanguageInstruction()}`,
      },
      {
        inline_data: {
          mime_type: mimeType,
          data: base64,
        },
      },
    ],
    {
      temperature: 0.2,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 512 },
    },
  );

  const raw = stripJsonFences(extractText(response));
  try {
    const data = parseJsonObject(raw);
    if (isFoodNotDetectedPayload(data)) {
      throw new FoodNotDetectedError();
    }
    return parseNutrition(data);
  } catch (err) {
    if (isFoodNotDetectedError(err)) throw err;
    throw new FoodNotDetectedError();
  }
}

export async function generateMealPlan(
  preferences: string,
  dietFilter: string,
  startDays: string[],
): Promise<MealPlan> {
  const diet =
    dietFilter === 'None' || dietFilter.trim() === '' ? 'balanced' : dietFilter;
  const daysList = startDays.length === 7 ? startDays : weekdaysStartingFrom();
  const dayShape = daysList
    .map(
      (name) =>
        `    {"name": "${name}", "breakfast": "...", "lunch": "...", "dinner": "..."}`,
    )
    .join(',\n');

  const response = await post(
    TEXT_MODEL,
    [
      {
        text: `You are a nutrition expert. Generate a 7-day meal plan starting today (${daysList[0]}).
Use these exact day names in order: ${daysList.join(', ')}.
Diet: ${diet}.
User preferences:
${preferences}

Return ONLY valid JSON with this exact shape:
{
  "days": [
${dayShape}
  ]
}${outputLanguageInstruction()}`,
      },
    ],
    {
      temperature: 0.7,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0 },
    },
  );

  const raw = extractText(response);
  let data: Record<string, unknown>;
  try {
    data = parseJsonObject(raw);
  } catch {
    throw new Error('Could not parse meal plan from Gemini response.');
  }

  if (!Array.isArray(data.days)) {
    throw new Error('Meal plan response was missing a days array.');
  }

  const days = data.days.map((day, index) => {
    const item =
      day && typeof day === 'object' ? (day as Record<string, unknown>) : {};
    return {
      name:
        typeof item.name === 'string' && item.name.trim()
          ? item.name
          : daysList[index] ?? `Day ${index + 1}`,
      breakfast:
        typeof item.breakfast === 'string' ? item.breakfast : 'Not specified',
      lunch: typeof item.lunch === 'string' ? item.lunch : 'Not specified',
      dinner: typeof item.dinner === 'string' ? item.dinner : 'Not specified',
    };
  });

  if (days.length === 0) {
    throw new Error('Gemini returned an empty meal plan.');
  }

  return { days };
}
