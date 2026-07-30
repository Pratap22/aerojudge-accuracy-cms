import { Layout } from '../components/Layout';
import { PilotSearch } from '../components/PilotSearch';

export function PilotsPage() {
  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-6 py-12">
        <h1 className="mb-8 font-display text-4xl font-bold text-white">Pilot Search</h1>
        <PilotSearch />
      </div>
    </Layout>
  );
}
