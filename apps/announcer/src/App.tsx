import { Loader2 } from 'lucide-react';
import { PilotPanel } from './components/PilotPanel';
import { LatestScorePanel } from './components/LatestScorePanel';
import { StatsPanel } from './components/StatsPanel';
import { WindDisplay } from './components/WindDisplay';
import { AnnouncementsPanel } from './components/AnnouncementsPanel';
import { useAnnouncerData } from './hooks/useAnnouncerData';

function App() {
  const {
    competition,
    isLoading,
    currentPilot,
    previousPilot,
    nextPilot,
    latestScore,
    wind,
    announcements,
    stats,
    addAnnouncement,
  } = useAnnouncerData();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-tent-navy">
        <Loader2 className="h-10 w-10 animate-spin text-sky-400" />
      </div>
    );
  }

  if (!competition) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-tent-navy p-8 text-center">
        <p className="text-2xl font-bold text-sky-300">Select a competition</p>
        <p className="mt-2 text-sky-400/80">
          Open with <code className="text-sky-200">?competition=your-public-slug</code>
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-tent-navy p-4 md:p-6">
      <header className="mb-6 flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-sky-400/60">Announcer Console</p>
          <h1 className="text-2xl font-bold text-white">{competition?.name ?? 'AeroJudge'}</h1>
        </div>
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Live</span>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-4">
          <PilotPanel pilot={currentPilot} label="Current Pilot" variant="current" />
          <PilotPanel pilot={previousPilot} label="Previous" variant="previous" />
          <PilotPanel pilot={nextPilot} label="Next Up" variant="next" />
        </div>

        <div className="space-y-4 lg:col-span-5">
          <LatestScorePanel score={latestScore} pilot={currentPilot} />
          <StatsPanel stats={stats} />
        </div>

        <div className="space-y-4 lg:col-span-3">
          <WindDisplay wind={wind} />
          <AnnouncementsPanel announcements={announcements} onCompose={addAnnouncement} />
        </div>
      </div>
    </div>
  );
}

export default App;
