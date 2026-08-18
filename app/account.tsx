import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, router, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { LanguageSheet } from '@/components/LanguageSheet';

const CHEVRON_SIZE = 20;
const CHEVRON_COLOR = '#8A8A8A';

export default function AccountScreen() {
  const { user, profile, loading, signOut, deleteAccount } = useAuth();
  const insets = useSafeAreaInsets();
  const [signingOut, setSigningOut] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);

  if (!loading && !user) {
    return <Redirect href={'/onboarding' as Href} />;
  }

  const name = profile?.name || user?.displayName || '';
  const email = profile?.email || user?.email || '';
  const photoUrl = user?.photoURL;

  async function onSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/onboarding' as Href);
    } finally {
      setSigningOut(false);
    }
  }

  function onDeleteAccount() {
    Alert.alert(
      'Delete account?',
      'This permanently removes your account and profile. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteAccount();
              router.replace('/onboarding' as Href);
            } catch {
              Alert.alert('Unable to delete account', 'Please sign in again and try once more.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  }

  const busy = signingOut || deleting;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 4, paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.pageTitle}>Profile</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={name ? `Profile for ${name}` : 'Set name and username'}
          style={({ pressed }) => [styles.identityCard, pressed && styles.identityCardPressed]}
        >
          <View style={styles.avatar}>
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={32} color={colors.textSecondary} />
            )}
          </View>
          <View style={styles.identityText}>
            <Text numberOfLines={1} style={styles.name}>
              {name || 'Tap to set name'}
            </Text>
            <Text numberOfLines={1} style={styles.email}>
              {name && email ? email : 'and username'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={CHEVRON_SIZE} color={CHEVRON_COLOR} />
        </Pressable>

        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.menuCard}>
          <Pressable accessibilityRole="button" style={styles.menuRow}>
            <View style={styles.menuLeading}>
              <Ionicons name="id-card-outline" size={20} color={colors.text} />
              <Text style={styles.menuText}>Personal Details</Text>
            </View>
            <Ionicons name="chevron-forward" size={CHEVRON_SIZE} color={CHEVRON_COLOR} />
          </Pressable>
          <View style={styles.menuDivider} />
          <Pressable
            accessibilityRole="button"
            onPress={() => setLanguageOpen(true)}
            style={styles.menuRow}
          >
            <View style={styles.menuLeading}>
              <Ionicons name="language-outline" size={20} color={colors.text} />
              <Text style={styles.menuText}>Language</Text>
            </View>
            <Ionicons name="chevron-forward" size={CHEVRON_SIZE} color={CHEVRON_COLOR} />
          </Pressable>
        </View>

        <Text style={styles.sectionLabelSpaced}>Account Actions</Text>
        <View style={styles.menuCard}>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onSignOut}
            style={styles.menuRow}
          >
            <View style={styles.menuLeading}>
              <Ionicons name="log-out-outline" size={20} color={colors.text} />
              <Text style={styles.menuText}>Logout</Text>
            </View>
            {signingOut ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <Ionicons name="chevron-forward" size={CHEVRON_SIZE} color={CHEVRON_COLOR} />
            )}
          </Pressable>
          <View style={styles.menuDivider} />
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onDeleteAccount}
            style={styles.menuRow}
          >
            <View style={styles.menuLeading}>
              <Ionicons name="person-remove-outline" size={20} color={colors.text} />
              <Text style={styles.menuText}>Delete Account</Text>
            </View>
            {deleting ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <Ionicons name="chevron-forward" size={CHEVRON_SIZE} color={CHEVRON_COLOR} />
            )}
          </Pressable>
        </View>
      </ScrollView>
      <LanguageSheet
        visible={languageOpen}
        onClose={() => setLanguageOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.page,
  },
  pageTitle: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '400',
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    position: 'relative',
    marginBottom: 22,
  },
  backButton: {
    position: 'absolute',
    left: 0,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EEEFF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonPressed: {
    opacity: 0.72,
  },
  content: {
    paddingHorizontal: 20,
  },
  identityCard: {
    backgroundColor: colors.card,
    borderRadius: 22,
    minHeight: 96,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#7C8288',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2,
  },
  identityCardPressed: {
    opacity: 0.82,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ECECEC',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  identityText: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
  },
  name: {
    color: colors.text,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  email: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '400',
    marginTop: 4,
  },
  sectionLabel: {
    color: '#8A8A8A',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
    marginLeft: 4,
    marginBottom: 8,
  },
  sectionLabelSpaced: {
    color: '#8A8A8A',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
    marginLeft: 4,
    marginTop: 16,
    marginBottom: 8,
  },
  menuCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    overflow: 'hidden',
  },
  menuRow: {
    minHeight: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuLeading: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginRight: 12,
  },
  menuText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
});
