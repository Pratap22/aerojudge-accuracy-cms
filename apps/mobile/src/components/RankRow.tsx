import { StyleSheet, Text, View } from 'react-native';
import { formatRankingScore, rankingEntryName, rankingSubtitle } from '../lib/results';
import type { PublicRankingRow } from '../lib/types';
import { colors, spacing } from '../theme';

const PODIUM = [colors.gold, colors.silver, colors.bronze] as const;

export function RankRow({ row }: { row: PublicRankingRow }) {
  const podium = row.rank >= 1 && row.rank <= 3 ? PODIUM[row.rank - 1] : colors.border;
  const subtitle = rankingSubtitle(row);

  return (
    <View style={styles.row} accessibilityLabel={`Rank ${row.rank}, ${rankingEntryName(row)}`}>
      <View style={[styles.rank, { borderColor: podium }]}>
        <Text style={styles.rankText}>{row.rank}</Text>
      </View>
      <View style={styles.copy}>
        <Text style={styles.name} numberOfLines={2}>
          {rankingEntryName(row)}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Text style={styles.score}>{formatRankingScore(row.totalScoreCm)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
    minHeight: 64,
  },
  rank: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    color: colors.navy,
    fontWeight: '700',
    fontSize: 14,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  name: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
  },
  score: {
    color: colors.navy,
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    minWidth: 52,
    textAlign: 'right',
  },
});
