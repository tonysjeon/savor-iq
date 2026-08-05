import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { MealCamera, type CapturedMealPhoto } from '@/components/MealCamera';
import { colors } from '@/constants/theme';
import { startAnalyzeSession } from '@/lib/analyzeSession';
import { isGeminiConfigured } from '@/lib/gemini';

export default function AnalyzeScreen() {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function beginSession(photo: CapturedMealPhoto, source: 'camera' | 'gallery') {
    startAnalyzeSession(photo, source);
    setCameraOpen(false);
    setError(null);
    router.push('/analyze/confirm');
  }

  function handleCameraCapture(photo: CapturedMealPhoto) {
    beginSession(photo, 'camera');
  }

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

    beginSession(
      {
        uri: asset.uri,
        base64: asset.base64,
        mimeType: asset.mimeType ?? 'image/jpeg',
      },
      'gallery',
    );
  }

  return (
    <>
      <View style={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="restaurant-outline" size={36} color={colors.text} />
          </View>
          <Text style={styles.heading}>Analyze a meal</Text>
          <Text style={styles.subheading}>
            Take or choose a photo, confirm it, then we’ll process nutrition on the next screens.
          </Text>
        </View>

        {!isGeminiConfigured ? (
          <Text style={styles.notice}>
            Add EXPO_PUBLIC_GEMINI_API_KEY to your .env file, then restart Expo.
          </Text>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            style={[styles.primaryButton, !isGeminiConfigured && styles.buttonDisabled]}
            disabled={!isGeminiConfigured}
            onPress={() => {
              setError(null);
              setCameraOpen(true);
            }}
          >
            <Ionicons name="camera" size={18} color={colors.buttonPrimaryText} />
            <Text style={styles.primaryButtonText}>Take Photo</Text>
          </Pressable>

          <Pressable
            style={[styles.secondaryButton, !isGeminiConfigured && styles.buttonDisabled]}
            disabled={!isGeminiConfigured}
            onPress={pickFromGallery}
          >
            <Ionicons name="images-outline" size={18} color={colors.text} />
            <Text style={styles.secondaryButtonText}>Gallery</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <MealCamera
        visible={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={handleCameraCapture}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 20,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    marginBottom: 28,
    gap: 10,
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  heading: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  subheading: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 320,
  },
  notice: {
    color: colors.textSecondary,
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    lineHeight: 20,
  },
  actions: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: colors.buttonPrimaryBg,
    borderRadius: 12,
    minHeight: 52,
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
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 52,
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
    marginTop: 16,
    lineHeight: 20,
    textAlign: 'center',
  },
});
