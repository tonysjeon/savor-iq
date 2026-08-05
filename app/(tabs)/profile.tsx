import { Link, Redirect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { useAuth } from '@/context/AuthContext';
import { colors } from '@/constants/theme';
import {
  listNutritionAnalyses,
  listRecipes,
  type SavedNutrition,
  type SavedRecipe,
} from '@/lib/firestore';
import {
  getHistoryCacheSync,
  loadHistoryCache,
} from '@/lib/userHistoryCache';

export default function ProfileScreen() {
  const { user, loading, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [analyses, setAnalyses] = useState<SavedNutrition[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      const uid = user.uid;

      let active = true;
      setHistoryError(null);

      const syncCache = getHistoryCacheSync(uid);
      if (syncCache) {
        setRecipes(syncCache.recipes);
        setAnalyses(syncCache.analyses);
        setLoadingHistory(false);
        setRefreshing(true);
      } else {
        setLoadingHistory(true);
      }

      async function load() {
        if (!syncCache) {
          const disk = await loadHistoryCache(uid);
          if (!active) return;
          if (disk) {
            setRecipes(disk.recipes);
            setAnalyses(disk.analyses);
            setLoadingHistory(false);
            setRefreshing(true);
          }
        }

        try {
          const [nextRecipes, nextAnalyses] = await Promise.all([
            listRecipes(uid, 10),
            listNutritionAnalyses(uid, 10),
          ]);
          if (!active) return;
          setRecipes(nextRecipes);
          setAnalyses(nextAnalyses);
        } catch (err) {
          if (!active) return;
          setHistoryError(
            err instanceof Error
              ? err.message
              : 'Could not load saved history from Firestore.',
          );
        } finally {
          if (active) {
            setLoadingHistory(false);
            setRefreshing(false);
          }
        }
      }

      void load();

      return () => {
        active = false;
      };
    }, [user]),
  );

  if (!loading && !user) {
    return <Redirect href="/(auth)/login" />;
  }

  async function onSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.description}>
        {user?.displayName || user?.email || 'Signed in to Savor IQ'}
      </Text>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Saved recipes</Text>
          {refreshing ? <ActivityIndicator color={colors.textMuted} /> : null}
        </View>
        {loadingHistory ? (
          <ActivityIndicator color={colors.text} style={styles.loader} />
        ) : recipes.length === 0 ? (
          <Text style={styles.empty}>No cloud-saved recipes yet.</Text>
        ) : (
          recipes.map((recipe) => (
            <View key={recipe.id} style={styles.item}>
              <Text style={styles.itemTitle} numberOfLines={1}>
                {recipe.title}
              </Text>
              <Text style={styles.itemMeta} numberOfLines={1}>
                {recipe.preparationMethod} · Serves {recipe.servings}
              </Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Nutrition history</Text>
          {refreshing ? <ActivityIndicator color={colors.textMuted} /> : null}
        </View>
        {loadingHistory ? (
          <ActivityIndicator color={colors.text} style={styles.loader} />
        ) : analyses.length === 0 ? (
          <Text style={styles.empty}>No saved meal analyses yet.</Text>
        ) : (
          analyses.map((item) => (
            <View key={item.id} style={styles.item}>
              <Text style={styles.itemTitle} numberOfLines={1}>
                {item.foodName}
              </Text>
              <Text style={styles.itemMeta} numberOfLines={1}>
                {item.calories} kcal · Score {item.healthScore}/10
              </Text>
            </View>
          ))
        )}
      </View>

      {historyError ? <Text style={styles.error}>{historyError}</Text> : null}

      <Link href="/about" asChild>
        <Pressable style={styles.secondaryButton} accessibilityRole="button">
          <Text style={styles.secondaryButtonText}>About Savor IQ</Text>
        </Pressable>
      </Link>

      <Pressable
        style={styles.button}
        onPress={onSignOut}
        disabled={signingOut}
        accessibilityRole="button"
      >
        {signingOut ? (
          <ActivityIndicator color={colors.buttonPrimaryText} />
        ) : (
          <Text style={styles.buttonText}>Sign out</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '600',
    marginBottom: 10,
  },
  description: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  loader: {
    marginVertical: 8,
  },
  empty: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  item: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  itemTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemMeta: {
    color: colors.textMuted,
    fontSize: 13,
  },
  error: {
    color: '#FF6B6B',
    marginBottom: 16,
    lineHeight: 20,
  },
  button: {
    backgroundColor: colors.buttonPrimaryBg,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: colors.buttonPrimaryText,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
});
