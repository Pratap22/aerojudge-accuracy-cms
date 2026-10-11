import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CompetitionCard } from '../src/components/CompetitionCard';
import { StateMessage } from '../src/components/StateMessage';
import { fetchCompetitions } from '../src/lib/api';
import { errorMessage } from '../src/lib/public-api';
import { competitionMatchesQuery } from '../src/lib/results';
import type { PublicCompetitionSummary } from '../src/lib/types';
import { colors, spacing } from '../src/theme';

const logo = require('../assets/logo.png');

export default function CompetitionListScreen() {
  const [query, setQuery] = useState('');
  const competitions = useQuery({
    queryKey: ['public-competitions'],
    queryFn: fetchCompetitions,
  });

  const sections = useMemo(() => {
    const active = (competitions.data?.active ?? []).filter((item) =>
      competitionMatchesQuery(item, query),
    );
    const past = (competitions.data?.past ?? []).filter((item) =>
      competitionMatchesQuery(item, query),
    );
    return [
      { title: 'Active', data: active, empty: 'No active competitions match.' },
      { title: 'Completed', data: past, empty: 'No completed competitions match.' },
    ];
  }, [competitions.data, query]);

  const openCompetition = (competition: PublicCompetitionSummary) => {
    router.push({ pathname: '/competition/[id]', params: { id: competition.id } });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Image source={logo} style={styles.logo} accessibilityLabel="AeroJudge" />
        <Text style={styles.kicker}>Competitions</Text>
        <Text style={styles.subtitle}>Live standings for published competitions</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search name, place, or code"
          placeholderTextColor="#9AA8B5"
          autoCorrect={false}
          autoCapitalize="none"
          accessibilityLabel="Search competitions"
          style={styles.search}
        />
      </View>

      {competitions.isLoading ? (
        <ActivityIndicator color={colors.sky} style={styles.spinner} />
      ) : competitions.isError && !competitions.data ? (
        <StateMessage
          tone="danger"
          title="Competitions unavailable"
          body={errorMessage(competitions.error)}
          actionLabel="Try again"
          onAction={() => {
            void competitions.refetch();
          }}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          style={styles.listFill}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl
              refreshing={competitions.isRefetching && !competitions.isLoading}
              onRefresh={() => {
                void competitions.refetch();
              }}
              tintColor={colors.sky}
            />
          }
          ListHeaderComponent={
            competitions.isError ? (
              <View style={styles.stale}>
                <Text style={styles.staleText}>
                  Couldn't refresh. Showing the last list loaded.
                </Text>
              </View>
            ) : null
          }
          renderSectionHeader={({ section }) => <Text style={styles.section}>{section.title}</Text>}
          renderItem={({ item }) => (
            <CompetitionCard competition={item} onPress={() => openCompetition(item)} />
          )}
          renderSectionFooter={({ section }) =>
            section.data.length === 0 ? <Text style={styles.empty}>{section.empty}</Text> : null
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.xs,
  },
  logo: {
    width: 148,
    height: 48,
    resizeMode: 'contain',
    backgroundColor: colors.white,
    borderRadius: 8,
    marginBottom: spacing.sm,
  },
  kicker: {
    color: colors.white,
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: '#B7D7EA',
    fontSize: 15,
  },
  search: {
    marginTop: spacing.md,
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
    color: colors.foreground,
    fontSize: 16,
  },
  spinner: {
    marginTop: spacing.xl,
  },
  listFill: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    padding: spacing.lg,
    flexGrow: 1,
  },
  section: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  separator: {
    height: spacing.md,
  },
  empty: {
    color: colors.muted,
    paddingVertical: spacing.md,
  },
  stale: {
    backgroundColor: colors.warningSurface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  staleText: {
    color: colors.warningText,
    fontSize: 14,
    lineHeight: 20,
  },
});
