import { Monitor, Projector, Tv, Wallpaper } from 'lucide-react';

const surfaces = [
  { icon: Wallpaper, label: 'LED Wall' },
  { icon: Tv, label: 'TV' },
  { icon: Projector, label: 'Projector' },
  { icon: Monitor, label: 'External Monitor' },
];

export function DisplayPreview() {
  return (
    <div className="mt-10 grid items-center gap-8 lg:grid-cols-[1.2fr_0.8fr]">
      <div
        className="overflow-hidden rounded-xl border border-navy/20 bg-[#050d1a] text-white shadow-xl"
        aria-hidden="true"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-sky">
          <span>AeroJudge Display</span>
          <span>Full screen · Browser</span>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-[1fr_auto]">
          <div>
            <p className="text-xs text-white/50">Current pilot</p>
            <p className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">#42 · M. Chen</p>
            <p className="mt-2 text-sm text-white/65">Round 4 · Team North</p>
            <div className="mt-5 flex flex-wrap gap-4 text-sm">
              <div>
                <p className="text-white/45">Score</p>
                <p className="font-display text-2xl font-bold text-sky">0 cm</p>
              </div>
              <div>
                <p className="text-white/45">Overall</p>
                <p className="font-display text-2xl font-bold">51 cm</p>
              </div>
              <div>
                <p className="text-white/45">Rank</p>
                <p className="font-display text-2xl font-bold">#2</p>
              </div>
            </div>
          </div>
          <div className="flex h-28 w-28 items-center justify-center rounded-full border-2 border-sky/40 bg-sky/10 sm:h-32 sm:w-32">
            <div className="text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-white/10" />
              <p className="mt-2 text-[10px] uppercase tracking-wider text-white/50">Photo</p>
            </div>
          </div>
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-3">
        {surfaces.map(({ icon: Icon, label }) => (
          <li
            key={label}
            className="flex flex-col items-center gap-2 rounded-lg border border-border bg-white px-3 py-5 text-center shadow-sm"
          >
            <Icon className="h-6 w-6 text-sky" aria-hidden />
            <span className="text-sm font-medium text-navy">{label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
