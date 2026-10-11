import { Pressable, StyleSheet, Text, View } from 'react-native';
import { competitionStatusLabel, formatEventRange } from '../lib/results';
import type { PublicCompetitionSummary } from '../lib/types';
import { colors, spacing } from '../theme';

interface CompetitionCardProps {
  competition: PublicCompetitionSummary;
  onPress: () => void;
}

export function CompetitionCard({ competition, onPress }: CompetitionCardProps) {
  const meta = [
    competition.pilotCount != null ? `${competition.pilotCount} pilots` : null,
    competition.teamCount != null && competition.teamCount > 0
      ? `${competition.teamCount} teams`
      : null,
    competition.roundCount != null && competition.roundCount > 0
      ? `${competition.roundCount} rounds`
      : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${competition.name}, ${competitionStatusLabel(competition.status)}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {competition.organizer ? <Text style={styles.organizer}>{competition.organizer}</Text> : null}
      <View style={styles.titleRow}>
        <Text style={styles.name}>{competition.name}</Text>
        <Text style={styles.status}>{competitionStatusLabel(competition.status)}</Text>
      </View>
      <Text style={styles.place}>
        {competition.venue}
        {competition.country ? ` · ${competition.country}` : ''}
      </Text>
      <Text style={styles.dates}>
        {formatEventRange(competition.startDate, competition.endDate)}
      </Text>
      {meta.length > 0 ? <Text style={styles.meta}>{meta.join(' · ')}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  pressed: {
    borderColor: colors.sky,
  },
  organizer: {
    color: colors.sky,
    fontSize: 13,
    fontStyle: 'italic',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  name: {
    flex: 1,
    color: colors.foreground,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
  },
  status: {
    color: colors.navy,
    backgroundColor: '#E7F6FD',
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  place: {
    color: colors.foreground,
    fontSize: 15,
  },
  dates: {
    color: colors.muted,
    fontSize: 14,
  },
  meta: {
    marginTop: spacing.xs,
    color: colors.muted,
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});
