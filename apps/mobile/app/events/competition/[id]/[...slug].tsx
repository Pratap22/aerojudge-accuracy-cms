import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { firstParam } from '../../../../src/lib/results';
import { colors, spacing } from '../../../../src/theme';

export default function UnsupportedEventSection() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const competitionId = firstParam(id);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Not in the app yet</Text>
      <Text style={styles.body}>
        This part of the event website is still on the web. Results for the competition are
        available here.
      </Text>
      {competitionId ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open results"
          style={styles.button}
          onPress={() =>
            router.replace({ pathname: '/competition/[id]', params: { id: competitionId } })
          }
        >
          <Text style={styles.buttonLabel}>Open results</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    padding: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  title: {
    color: colors.foreground,
    fontSize: 22,
    fontWeight: '700',
  },
  body: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 22,
  },
  button: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  buttonLabel: {
    color: colors.white,
    fontWeight: '600',
  },
});
