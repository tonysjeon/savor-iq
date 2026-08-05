import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

import { MealCamera, type CapturedMealPhoto } from '@/components/MealCamera';
import { NutritionCard } from '@/components/NutritionCard';
import { useAuth } from '@/context/AuthContext';
import { colors } from '@/constants/theme';
import { saveNutritionAnalysis } from '@/lib/firestore';
import { analyzeNutritionFromImage, isGeminiConfigured } from '@/lib/gemini';
import type { NutritionInfo } from '@/types/nutrition';

export default function AnalyzeScreen() {
  const { user } = useAuth();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [image, setImage] = useState<CapturedMealPhoto | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nutrition, setNutrition] = useState<NutritionInfo | null>(null);

  async function ensureLibraryPermission(): Promise<boolean> {
    const current = await ImagePicker.getMediaLibraryPermissionsAsync();
    const result = current.granted
      ? current
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!result.granted) {
      setError('Photo library permission is required to choose an image.');
      return false;
    }
    return true;
  }

  async function analyzePhoto(picked: CapturedMealPhoto) {
    if (!isGeminiConfigured) {
      setError(
        'Gemini is not configured. Add EXPO_PUBLIC_GEMINI_API_KEY to your .env and restart Expo.',
      );
      return;
    }

    setImage(picked);
    setNutrition(null);
    setError(null);
    setAnalyzing(true);

    try {
      const info = await analyzeNutritionFromImage(picked.base64, picked.mimeType);
      setNutrition(info);

      if (user) {
        try {
          await saveNutritionAnalysis(user.uid, info);
        } catch (cloudErr) {
          setError(
            cloudErr instanceof Error
              ? `Analysis ready, but cloud save failed: ${cloudErr.message}`
              : 'Analysis ready, but cloud save failed.',
          );
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed.');
    } finally {
      setAnalyzing(false);
    }
  }

  function handleCameraCapture(photo: CapturedMealPhoto) {
    setCameraOpen(false);
    void analyzePhoto(photo);
  }

  async function pickFromGallery() {
    if (!isGeminiConfigured) {
      setError(
        'Gemini is not configured. Add EXPO_PUBLIC_GEMINI_API_KEY to your .env and restart Expo.',
      );
      return;
    }

    const allowed = await ensureLibraryPermission();
    if (!allowed) return;

    setError(null);

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
      allowsEditing: true,
      aspect: [4, 3],
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    if (!asset.base64) {
      setError('Could not read image data. Try another photo.');
      return;
    }

    await analyzePhoto({
      uri: asset.uri,
      base64: asset.base64,
      mimeType: asset.mimeType ?? 'image/jpeg',
    });
  }

  return (
    <>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.heading}>Analyze a meal</Text>
        <Text style={styles.subheading}>
          Frame the plate in the live camera, review the shot, then get calories, macros, and tips.
        </Text>

        {!isGeminiConfigured ? (
          <Text style={styles.notice}>
            Add EXPO_PUBLIC_GEMINI_API_KEY to your .env file, then restart Expo.
          </Text>
        ) : null}

        <View style={styles.preview}>
          {image ? (
            <Image source={{ uri: image.uri }} style={styles.previewImage} />
          ) : (
            <View style={styles.previewEmpty}>
              <Ionicons name="camera-outline" size={40} color={colors.textMuted} />
              <Text style={styles.previewEmptyText}>No photo yet</Text>
            </View>
          )}

          {analyzing ? (
            <View style={styles.analyzingOverlay}>
              <ActivityIndicator color={colors.text} size="large" />
              <Text style={styles.analyzingText}>Analyzing nutrition…</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.actions}>
          <Pressable
            style={[
              styles.primaryButton,
              (!isGeminiConfigured || analyzing) && styles.buttonDisabled,
            ]}
            disabled={!isGeminiConfigured || analyzing}
            onPress={() => setCameraOpen(true)}
          >
            <Ionicons name="camera" size={18} color={colors.buttonPrimaryText} />
            <Text style={styles.primaryButtonText}>Take Photo</Text>
          </Pressable>

          <Pressable
            style={[
              styles.secondaryButton,
              (!isGeminiConfigured || analyzing) && styles.buttonDisabled,
            ]}
            disabled={!isGeminiConfigured || analyzing}
            onPress={pickFromGallery}
          >
            <Ionicons name="images-outline" size={18} color={colors.text} />
            <Text style={styles.secondaryButtonText}>Gallery</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {nutrition ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Results</Text>
            <NutritionCard info={nutrition} />
          </View>
        ) : null}
      </ScrollView>

      <MealCamera
        visible={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={handleCameraCapture}
      />
    </>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  heading: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subheading: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 20,
  },
  notice: {
    color: colors.textSecondary,
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    lineHeight: 20,
  },
  preview: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: 16,
    aspectRatio: 4 / 3,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  previewEmptyText: {
    color: colors.textMuted,
    fontSize: 15,
  },
  analyzingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  analyzingText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.buttonPrimaryBg,
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonText: {
    color: colors.buttonPrimaryText,
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  error: {
    color: '#FF6B6B',
    marginTop: 8,
    marginBottom: 8,
    lineHeight: 20,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
});
