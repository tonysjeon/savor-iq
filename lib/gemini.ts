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

  const response = await fetch(
    `${BASE_URL}/models/${model}:generateContent?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        ...(generationConfig ? { generationConfig } : {}),
      }),
    },
  );

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
}`,
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

function fallbackNutrition(): NutritionInfo {
  return {
    foodName: 'Unknown Food',
    calories: 250,
    macros: { protein: 15, carbs: 30, fat: 10, fiber: 5 },
    healthScore: 6,
    description: 'Nutritional analysis could not be completed accurately.',
    nutritionTips: [
      'Eat a balanced diet with diverse food groups.',
      'Consult a nutritionist for personalised advice.',
    ],
  };
}

function parseNutrition(data: Record<string, unknown>): NutritionInfo {
  const macrosRaw =
    data.macros && typeof data.macros === 'object'
      ? (data.macros as Record<string, unknown>)
      : {};

  const tips = Array.isArray(data.nutritionTips)
    ? data.nutritionTips.map(String)
    : [];

  return {
    foodName:
      typeof data.foodName === 'string' && data.foodName.trim()
        ? data.foodName
        : 'Unknown Food',
    calories: Math.round(toNumber(data.calories)),
    macros: {
      protein: toNumber(macrosRaw.protein),
      carbs: toNumber(macrosRaw.carbs),
      fat: toNumber(macrosRaw.fat),
      fiber: toNumber(macrosRaw.fiber),
    },
    healthScore: Math.min(10, Math.max(0, Math.round(toNumber(data.healthScore, 5)))),
    description:
      typeof data.description === 'string' ? data.description : '',
    nutritionTips: tips,
  };
}

export async function analyzeNutritionFromImage(
  base64: string,
  mimeType: string = 'image/jpeg',
): Promise<NutritionInfo> {
  if (!base64) {
    throw new Error('No image data provided.');
  }

  try {
    const response = await post(
      VISION_MODEL,
      [
        {
          text: `Analyse the food in this image and return detailed nutritional information.
Return ONLY valid JSON with this exact shape:
{
  "foodName": "name of the dish",
  "calories": 350,
  "macros": {
    "protein": 25,
    "carbs": 40,
    "fat": 12,
    "fiber": 5
  },
  "healthScore": 7,
  "description": "Brief healthy description of this meal.",
  "nutritionTips": ["Tip 1", "Tip 2"]
}
All quantities in grams except calories. Make educated estimates from what you see.`,
        },
        {
          inline_data: {
            mime_type: mimeType,
            data: base64,
          },
        },
      ],
      {
        temperature: 0.4,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 },
      },
    );

    const raw = stripJsonFences(extractText(response));
    try {
      const data = parseJsonObject(raw);
      return parseNutrition(data);
    } catch {
      return fallbackNutrition();
    }
  } catch (error) {
    if (!isGeminiConfigured) {
      throw error;
    }
    return fallbackNutrition();
  }
}

export async function generateMealPlan(
  preferences: string,
  dietFilter: string,
  startDays: string[] = weekdaysStartingFrom(),
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
}`,
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
