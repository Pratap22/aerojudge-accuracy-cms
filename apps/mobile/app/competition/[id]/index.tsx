import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RankingCategory } from '@aero-judge/shared';
import { RankRow } from '../../../src/components/RankRow';
import { StateMessage } from '../../../src/components/StateMessage';
import { fetchCompetition, fetchResults } from '../../../src/lib/api';
import { errorMessage } from '../../../src/lib/public-api';
import {
  TOP_LAYOUT,
  firstParam,
  formatEventRange,
  formatFetchedAt,
  formatRankingScore,
  resultsStatusLine,
  visibleRankings,
} from '../../../src/lib/results';
import { RESULT_CATEGORIES } from '../../../src/lib/types';
import { colors, spacing } from '../../../src/theme';

export default function CompetitionScreen() {
  const params = useLocalSearchParams<{ id: string; layout?: string }>();
  const competitionId = firstParam(params.id) ?? '';
  const layout = firstParam(params.layout);
  const limited = layout === TOP_LAYOUT;
  const [category, setCategory] = useState<RankingCategory>('OVERALL');
  const activeCategory: RankingCategory = limited ? 'OVERALL' : category;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const competitionQuery = useQuery({
    queryKey: ['public-competition', competitionId],
    queryFn: () => fetchCompetition(competitionId),
    enabled: Boolean(competitionId),
  });
  const resultsQuery = useQuery({
    queryKey: ['public-results', competitionId, activeCategory],
    queryFn: () => fetchResults(competitionId, activeCategory),
    enabled: Boolean(competitionId),
  });

  const competition = competitionQuery.data;
  useEffect(() => {
    navigation.setOptions({ title: competition?.name ?? 'Competition' });
  }, [navigation, competition?.name]);

  const refreshing =
    (competitionQuery.isRefetching || resultsQuery.isRefetching) && !competitionQuery.isLoading;
  const refresh = () => {
    void competitionQuery.refetch();
    void resultsQuery.refetch();
  };

  if (!competitionId) {
    return (
      <StateMessage
        title="Missing competition"
        body="This link does not include a competition."
        actionLabel="Back to competitions"
        onAction={() => router.replace('/')}
      />
    );
  }

  if (competitionQuery.isLoading && !competition) {
    return <ActivityIndicator color={colors.sky} style={styles.spinner} />;
  }

  if (competitionQuery.isError && !competition) {
    return (
      <StateMessage
        tone="danger"
        title="Competition unavailable"
        body={errorMessage(competitionQuery.error)}
        actionLabel="Try again"
        onAction={refresh}
      />
    );
  }

  const rankings = visibleRankings(resultsQuery.data?.rankings ?? [], limited ? TOP_LAYOUT : null);
  const fetchedAtLabel =
    resultsQuery.dataUpdatedAt > 0 ? formatFetchedAt(resultsQuery.dataUpdatedAt) : null;
  const statusLine = resultsQuery.data
    ? resultsStatusLine({
        official: resultsQuery.data.official,
        completed: competition?.status === 'COMPLETED',
        stale: resultsQuery.isError,
        fetchedAtLabel,
      })
    : null;

  return (
    <FlatList
      data={resultsQuery.data ? rankings : []}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <RankRow row={item} />}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.sky} />
      }
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl, flexGrow: 1 }}
      initialNumToRender={12}
      windowSize={7}
      ListHeaderComponent={
        <View style={styles.header}>
          {competition?.organizer ? (
            <Text style={styles.organizer}>{competition.organizer}</Text>
          ) : null}
          <Text style={styles.name}>{competition?.name}</Text>
          <Text style={styles.place}>
            {competition?.venue}
            {competition?.country ? ` · ${competition.country}` : ''}
          </Text>
          {competition ? (
            <Text style={styles.dates}>
              {formatEventRange(competition.startDate, competition.endDate)}
              {competition.code ? ` · ${competition.code}` : ''}
            </Text>
          ) : null}

          {competitionQuery.isError ? (
            <Text style={styles.warning}>Couldn't refresh competition details.</Text>
          ) : null}

          <View style={styles.chips}>
            {RESULT_CATEGORIES.map((item) => {
              const selected = item.id === activeCategory;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled: limited && item.id !== 'OVERALL' }}
                  disabled={limited && item.id !== 'OVERALL'}
                  onPress={() => setCategory(item.id)}
                  style={[
                    styles.chip,
                    selected && styles.chipSelected,
                    limited && item.id !== 'OVERALL' && styles.chipDisabled,
                  ]}
                >
                  <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {limited ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Show full results"
              onPress={() =>
                router.replace({ pathname: '/competition/[id]', params: { id: competitionId } })
              }
              style={styles.fullResults}
            >
              <Text style={styles.fullResultsLabel}>Showing top 10 · Show full results</Text>
            </Pressable>
          ) : null}

          <Text style={styles.columnLabel}>Score (cm)</Text>
          {statusLine ? <Text style={styles.status}>{statusLine}</Text> : null}
          {resultsQuery.isError && resultsQuery.data ? (
            <Text style={styles.warning}>These standings may be out of date.</Text>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        resultsQuery.isLoading ? (
          <ActivityIndicator color={colors.sky} style={styles.spinner} />
        ) : resultsQuery.isError ? (
          <StateMessage
            tone="danger"
            title="Results unavailable"
            body={errorMessage(resultsQuery.error)}
            actionLabel="Try again"
            onAction={() => {
              void resultsQuery.refetch();
            }}
          />
        ) : (
          <StateMessage
            title="No standings yet"
            body="This category does not have published rankings."
          />
        )
      }
      ListFooterComponent={
        rankings.length > 0 ? (
          <Text style={styles.footer}>
            {rankings.length} {rankings.length === 1 ? 'row' : 'rows'}
            {resultsQuery.data
              ? ` · Lowest score leads · ${formatRankingScore(0)} is a bullseye`
              : ''}
          </Text>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  spinner: {
    marginTop: spacing.xl,
  },
  header: {
    padding: spacing.lg,
    gap: spacing.xs,
    backgroundColor: colors.background,
  },
  organizer: {
    color: colors.sky,
    fontStyle: 'italic',
    fontSize: 14,
  },
  name: {
    color: colors.foreground,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
  },
  place: {
    color: colors.foreground,
    fontSize: 16,
  },
  dates: {
    color: colors.muted,
    fontSize: 14,
    marginBottom: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  chip: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: colors.navy,
    borderColor: colors.navy,
  },
  chipDisabled: {
    opacity: 0.45,
  },
  chipLabel: {
    color: colors.foreground,
    fontWeight: '600',
  },
  chipLabelSelected: {
    color: colors.white,
  },
  fullResults: {
    minHeight: 44,
    justifyContent: 'center',
  },
  fullResultsLabel: {
    color: colors.sky,
    fontWeight: '600',
  },
  columnLabel: {
    marginTop: spacing.md,
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    textAlign: 'right',
  },
  status: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  warning: {
    color: colors.warningText,
    backgroundColor: colors.warningSurface,
    overflow: 'hidden',
    borderRadius: 8,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  footer: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
    padding: spacing.lg,
  },
});
