import { useLocalSearchParams } from 'expo-router';
import { CompetitionRedirect } from '../../../src/components/CompetitionRedirect';

export default function DisplayCompetitionLink() {
  const { id, layout } = useLocalSearchParams<{ id: string; layout?: string }>();
  return <CompetitionRedirect id={id} layout={layout} results={false} />;
}
