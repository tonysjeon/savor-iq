import * as ImageManipulator from 'expo-image-manipulator';

import type { CapturedMealPhoto } from '@/components/MealCamera';

const ANALYSIS_WIDTH = 1600;
const DISPLAY_WIDTH = 1280;
const ANALYSIS_QUALITY = 0.75;
const DISPLAY_QUALITY = 0.68;

async function prepareMealPhoto(
  photo: CapturedMealPhoto,
  options: { width: number; quality: number },
): Promise<CapturedMealPhoto> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      photo.uri,
      [{ resize: { width: options.width } }],
      {
        compress: options.quality,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      },
    );

    if (!result.base64) return photo;

    return {
      uri: result.uri,
      base64: result.base64,
      mimeType: 'image/jpeg',
    };
  } catch {
    return photo;
  }
}

/**
 * Prepare analysis and display sizes without changing the original framing.
 */
export async function prepareMealPhotos(photo: CapturedMealPhoto): Promise<{
  analysis: CapturedMealPhoto;
  display: CapturedMealPhoto;
}> {
  const [analysis, display] = await Promise.all([
    prepareMealPhoto(photo, {
      width: ANALYSIS_WIDTH,
      quality: ANALYSIS_QUALITY,
    }),
    prepareMealPhoto(photo, {
      width: DISPLAY_WIDTH,
      quality: DISPLAY_QUALITY,
    }),
  ]);
  return { analysis, display };
}
