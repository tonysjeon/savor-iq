import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { colors } from '@/constants/theme';

const OVERLAY_ICON = '#FFFFFF';
const CORNER = 48;
const CORNER_RADIUS = 20;
const STROKE = 3.5;
const FRAME_STROKE = 'rgba(255,255,255,0.95)';
const FRAME_LEFT = 0.08;
const FRAME_TOP = 0.18;
const FRAME_RIGHT = 0.08;
const FRAME_BOTTOM = 0.28;

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

function FrameCorner({
  corner,
}: {
  corner: 'tl' | 'tr' | 'bl' | 'br';
}) {
  const s = CORNER;
  const r = CORNER_RADIUS;
  const half = STROKE / 2;

  let d = '';
  if (corner === 'tl') {
    d = `M ${half} ${s} L ${half} ${r} Q ${half} ${half} ${r} ${half} L ${s} ${half}`;
  } else if (corner === 'tr') {
    d = `M ${s - half} ${s} L ${s - half} ${r} Q ${s - half} ${half} ${s - r} ${half} L 0 ${half}`;
  } else if (corner === 'bl') {
    d = `M ${half} 0 L ${half} ${s - r} Q ${half} ${s - half} ${r} ${s - half} L ${s} ${s - half}`;
  } else {
    d = `M ${s - half} 0 L ${s - half} ${s - r} Q ${s - half} ${s - half} ${s - r} ${s - half} L 0 ${s - half}`;
  }

  const positionStyle =
    corner === 'tl'
      ? styles.cornerTL
      : corner === 'tr'
        ? styles.cornerTR
        : corner === 'bl'
          ? styles.cornerBL
          : styles.cornerBR;

  return (
    <Svg width={s} height={s} style={positionStyle}>
      <Path
        d={d}
        stroke={FRAME_STROKE}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

export function MealCamera({ onClose, onCapture, disabled = false }: MealCameraProps) {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const shutterScale = useRef(new Animated.Value(1)).current;
  const captureFlashOpacity = useRef(new Animated.Value(0)).current;
  const [pickingGallery, setPickingGallery] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setShutterPressed(pressed: boolean) {
    Animated.timing(shutterScale, {
      toValue: pressed ? 0.985 : 1,
      duration: pressed ? 45 : 65,
      useNativeDriver: true,
    }).start();
  }

  function beginCaptureClick() {
    Animated.sequence([
      Animated.timing(captureFlashOpacity, {
        toValue: 0.2,
        duration: 15,
        useNativeDriver: true,
      }),
      Animated.timing(captureFlashOpacity, {
        // Keep a subtle shade present until native capture finishes so there is
        // no idle-looking gap between the click feedback and dismissal.
        toValue: 0.1,
        duration: 45,
        useNativeDriver: true,
      }),
    ]).start();
  }

  function clearCaptureClick() {
    Animated.timing(captureFlashOpacity, {
      toValue: 0,
      duration: 25,
      useNativeDriver: true,
    }).start();
  }

  async function takePhoto() {
    if (!cameraRef.current || !ready || capturing || disabled) return;

    setCapturing(true);
    setError(null);
    beginCaptureClick();

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
        exif: false,
        shutterSound: Platform.OS === 'ios',
      });

      if (!photo?.uri || !photo.base64) {
        clearCaptureClick();
        setError('Could not capture photo. Try again.');
        return;
      }

      setCapturing(false);

      onCapture(
        {
          uri: photo.uri,
          base64: photo.base64,
          mimeType: 'image/jpeg',
        },
        'camera',
      );
    } catch (err) {
      clearCaptureClick();
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
        quality: 0.8,
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
          <View style={styles.grabberWrap} pointerEvents="none">
            <View style={styles.grabber} />
          </View>
          <Pressable
            style={[styles.circleButton, styles.permissionClose, { top: 8 }]}
            onPress={onClose}
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={22} color={OVERLAY_ICON} />
          </Pressable>
          <Ionicons name="camera-outline" size={40} color="rgba(255,255,255,0.55)" />
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
            facing="back"
            enableTorch={torch}
            mode="picture"
            zoom={0}
            onCameraReady={() => setReady(true)}
          />

          <Animated.View
            pointerEvents="none"
            style={[styles.captureFlash, { opacity: captureFlashOpacity }]}
          />

          <View style={styles.grabberWrap} pointerEvents="none">
            <View style={styles.grabber} />
          </View>

          <View style={styles.frameGuide} pointerEvents="none">
            <FrameCorner corner="tl" />
            <FrameCorner corner="tr" />
            <FrameCorner corner="bl" />
            <FrameCorner corner="br" />
          </View>

          <View style={[styles.topBar, { top: 18 }]}>
            <Pressable
              style={styles.circleButton}
              onPress={onClose}
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={22} color={OVERLAY_ICON} />
            </Pressable>
          </View>

          <View
            style={[
              styles.bottomBar,
              { paddingBottom: Math.max(insets.bottom, 24) + 10 },
            ]}
          >
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.controlsRow}>
              <Pressable
                style={styles.circleButton}
                disabled={busy}
                onPress={openGallery}
                accessibilityLabel="Open gallery"
              >
                <Ionicons name="image" size={22} color={OVERLAY_ICON} />
              </Pressable>

              <Pressable
                style={[styles.shutter, !ready && styles.controlDisabled]}
                disabled={!ready || busy}
                onPress={takePhoto}
                onPressIn={() => setShutterPressed(true)}
                onPressOut={() => setShutterPressed(false)}
                accessibilityLabel="Take photo"
              >
                <Animated.View
                  style={[
                    styles.shutterInner,
                    { transform: [{ scale: shutterScale }] },
                  ]}
                />
              </Pressable>

              <Pressable
                style={styles.circleButton}
                disabled={busy}
                onPress={() => setTorch((value) => !value)}
                accessibilityLabel={torch ? 'Turn flash off' : 'Turn flash on'}
              >
                <Ionicons
                  name={torch ? 'flash' : 'flash-off'}
                  size={18}
                  color={OVERLAY_ICON}
                />
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  flex: {
    flex: 1,
  },
  captureFlash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    zIndex: 1,
  },
  grabberWrap: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 3,
  },
  grabber: {
    width: 56,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  permissionClose: {
    position: 'absolute',
    top: 8,
    left: 16,
  },
  permissionTitle: {
    color: OVERLAY_ICON,
    fontSize: 20,
    fontWeight: '700',
    marginTop: 8,
  },
  permissionBody: {
    color: 'rgba(255,255,255,0.7)',
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
    zIndex: 4,
  },
  circleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(40,40,40,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameGuide: {
    position: 'absolute',
    zIndex: 2,
    left: `${FRAME_LEFT * 100}%`,
    right: `${FRAME_RIGHT * 100}%`,
    top: `${FRAME_TOP * 100}%`,
    bottom: `${FRAME_BOTTOM * 100}%`,
  },
  cornerTL: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  cornerTR: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
  cornerBL: {
    position: 'absolute',
    bottom: 0,
    left: 0,
  },
  cornerBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
  bottomBar: {
    position: 'absolute',
    zIndex: 4,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    gap: 12,
    paddingTop: 16,
    paddingHorizontal: 48,
  },
  controlsRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shutter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  shutterInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
  },
  controlDisabled: {
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
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
  },
  error: {
    color: '#FF6B6B',
    paddingHorizontal: 20,
    textAlign: 'center',
  },
});
