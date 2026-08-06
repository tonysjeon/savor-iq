import * as ImageManipulator from 'expo-image-manipulator';

import type { CapturedMealPhoto } from '@/components/MealCamera';

const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.55;

/** Shrink meal photos before Gemini so uploads finish faster. */
export async function prepareMealPhotoForAnalysis(
  photo: CapturedMealPhoto,
): Promise<CapturedMealPhoto> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      photo.uri,
      [{ resize: { width: MAX_EDGE } }],
      {
        compress: JPEG_QUALITY,
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
