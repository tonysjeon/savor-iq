import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';

export type CapturedMealPhoto = {
  uri: string;
  base64: string;
  mimeType: string;
};

type MealCameraProps = {
  onClose: () => void;
  onCapture: (photo: CapturedMealPhoto, source: 'camera' | 'gallery') => void;
  disabled?: boolean;
};

export function MealCamera({ onClose, onCapture, disabled = false }: MealCameraProps) {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [torch, setTorch] = useState(false);
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [pickingGallery, setPickingGallery] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function takePhoto() {
    if (!cameraRef.current || !ready || capturing || disabled) return;

    setCapturing(true);
    setError(null);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.45,
        base64: true,
        exif: false,
        shutterSound: Platform.OS === 'ios',
      });

      if (!photo?.uri || !photo.base64) {
        setError('Could not capture photo. Try again.');
        return;
      }

      onCapture(
        {
          uri: photo.uri,
          base64: photo.base64,
          mimeType: 'image/jpeg',
        },
        'camera',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Camera capture failed.');
    } finally {
      setCapturing(false);
    }
  }

  async function openGallery() {
    if (disabled || pickingGallery || capturing) return;

    setPickingGallery(true);
    setError(null);

    try {
      const current = await ImagePicker.getMediaLibraryPermissionsAsync();
      const result = current.granted
        ? current
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!result.granted) {
        setError('Photo library permission is required to choose an image.');
        return;
      }

      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.45,
        base64: true,
        allowsEditing: true,
        aspect: [4, 3],
      });

      if (picked.canceled || !picked.assets?.[0]) return;

      const asset = picked.assets[0];
      if (!asset.base64) {
        setError('Could not read image data. Try another photo.');
        return;
      }

      onCapture(
        {
          uri: asset.uri,
          base64: asset.base64,
          mimeType: asset.mimeType ?? 'image/jpeg',
        },
        'gallery',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open gallery.');
    } finally {
      setPickingGallery(false);
    }
  }

  const busy = capturing || pickingGallery || disabled;

  return (
    <View style={styles.root}>
      {!permission ? (
        <View style={[styles.center, { paddingTop: insets.top }]}>
          <ActivityIndicator color={colors.text} />
        </View>
      ) : !permission.granted ? (
        <View style={[styles.center, { paddingTop: insets.top }]}>
          <Pressable
            style={[styles.iconButton, styles.permissionBack, { top: insets.top + 4 }]}
            onPress={onClose}
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} style={styles.backIcon} />
          </Pressable>
          <Ionicons name="camera-outline" size={40} color={colors.textMuted} />
          <Text style={styles.permissionTitle}>Camera access needed</Text>
          <Text style={styles.permissionBody}>
            Allow camera access to photograph your meal for nutrition analysis.
          </Text>
          <Pressable style={styles.primaryButton} onPress={requestPermission}>
            <Text style={styles.primaryButtonText}>Allow Camera</Text>
          </Pressable>
          <Pressable style={styles.textButton} onPress={onClose}>
            <Text style={styles.textButtonLabel}>Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.flex}>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
            enableTorch={torch && facing === 'back'}
            mode="picture"
            onCameraReady={() => setReady(true)}
          />

          <View style={styles.frameGuide} pointerEvents="none">
            <View style={styles.frameCornerTL} />
            <View style={styles.frameCornerTR} />
            <View style={styles.frameCornerBL} />
            <View style={styles.frameCornerBR} />
            <Text style={styles.frameHint}>Center the meal in the frame</Text>
          </View>

          <View style={[styles.topBar, { top: Math.max(insets.top, 4) }]}>
            <Pressable
              style={styles.iconButton}
              onPress={onClose}
              accessibilityLabel="Go back"
            >
              <Ionicons
                name="chevron-back"
                size={24}
                color={colors.text}
                style={styles.backIcon}
              />
            </Pressable>
            <View style={styles.topActions}>
              {facing === 'back' ? (
                <Pressable
                  style={styles.iconButton}
                  onPress={() => setTorch((value) => !value)}
                  accessibilityLabel={torch ? 'Turn torch off' : 'Turn torch on'}
                >
                  <Ionicons
                    name={torch ? 'flash' : 'flash-outline'}
                    size={22}
                    color={colors.text}
                  />
                </Pressable>
              ) : null}
              <Pressable
                style={styles.iconButton}
                onPress={() => {
                  setTorch(false);
                  setFacing((current) => (current === 'back' ? 'front' : 'back'));
                }}
                accessibilityLabel="Flip camera"
              >
                <Ionicons name="camera-reverse-outline" size={22} color={colors.text} />
              </Pressable>
            </View>
          </View>

          <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.controlsRow}>
              <Pressable
                style={[styles.galleryButton, busy && styles.shutterDisabled]}
                disabled={busy}
                onPress={openGallery}
                accessibilityLabel="Open gallery"
              >
                <Ionicons name="images-outline" size={24} color={colors.text} />
              </Pressable>

              <Pressable
                style={[styles.shutter, (!ready || busy) && styles.shutterDisabled]}
                disabled={!ready || busy}
                onPress={takePhoto}
                accessibilityLabel="Take photo"
              >
                {capturing ? (
                  <ActivityIndicator color={colors.buttonPrimaryText} />
                ) : (
                  <View style={styles.shutterInner} />
                )}
              </Pressable>

              <View style={styles.gallerySpacer} />
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const CORNER = 28;
const STROKE = 3;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  flex: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  permissionBack: {
    position: 'absolute',
    top: 8,
    left: 16,
  },
  permissionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginTop: 8,
  },
  permissionBody: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 8,
  },
  topBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  topActions: {
    flexDirection: 'row',
    gap: 10,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    // Ionicons chevron-back sits left of center in its glyph box.
    transform: [{ translateX: 2 }],
  },
  frameGuide: {
    position: 'absolute',
    left: '10%',
    right: '10%',
    top: '22%',
    bottom: '30%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 16,
  },
  frameCornerTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: CORNER,
    height: CORNER,
    borderTopWidth: STROKE,
    borderLeftWidth: STROKE,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  frameCornerTR: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: CORNER,
    height: CORNER,
    borderTopWidth: STROKE,
    borderRightWidth: STROKE,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  frameCornerBL: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: CORNER,
    height: CORNER,
    borderBottomWidth: STROKE,
    borderLeftWidth: STROKE,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  frameCornerBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: CORNER,
    height: CORNER,
    borderBottomWidth: STROKE,
    borderRightWidth: STROKE,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  frameHint: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    gap: 12,
    paddingTop: 16,
    paddingHorizontal: 28,
  },
  controlsRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  galleryButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gallerySpacer: {
    width: 48,
  },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.text,
  },
  shutterDisabled: {
    opacity: 0.45,
  },
  primaryButton: {
    backgroundColor: colors.buttonPrimaryBg,
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  primaryButtonText: {
    color: colors.buttonPrimaryText,
    fontSize: 15,
    fontWeight: '600',
  },
  textButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  textButtonLabel: {
    color: colors.textSecondary,
    fontSize: 15,
  },
  error: {
    color: '#FF6B6B',
    paddingHorizontal: 20,
    textAlign: 'center',
  },
});
