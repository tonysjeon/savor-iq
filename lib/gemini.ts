import type { Recipe } from '@/types/recipe';

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const TEXT_MODEL = 'gemini-2.0-flash';

export const isGeminiConfigured = Boolean(API_KEY);

type GeminiPart = { text: string };

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
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
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Could not parse text from Gemini response');
  }
  return text;
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
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
      },
    );

    const raw = stripJsonFences(extractText(response));
    let data: RecipeJson;
    try {
      data = JSON.parse(raw) as RecipeJson;
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
