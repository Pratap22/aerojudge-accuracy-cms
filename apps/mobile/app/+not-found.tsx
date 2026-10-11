import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../src/theme';

export default function NotFoundScreen() {
  return (
    <View style={styles.wrap}>
      <Stack.Screen options={{ title: 'Not found' }} />
      <Text style={styles.title}>Page not found</Text>
      <Link href="/" style={styles.link}>
        Back to competitions
      </Link>
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
  link: {
    color: colors.sky,
    fontSize: 16,
    fontWeight: '600',
    minHeight: 44,
  },
});
