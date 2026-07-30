import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { PublicCompetition } from '../lib/types';
import { formatDate } from '../lib/utils';

interface HeroProps {
  competition: PublicCompetition;
  slug: string;
  topPilots?: { rank: number; name: string; score: number; country: string }[];
}

export function Hero({ competition, slug, topPilots = [] }: HeroProps) {
  return (
    <section className="relative min-h-[85vh] overflow-hidden">
      {/* Atmospheric mountain gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a1628] via-[#0f2744] to-[#050d1a]" />
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 80% 50% at 50% 100%, rgba(56, 189, 248, 0.15) 0%, transparent 60%),
            radial-gradient(ellipse 60% 40% at 20% 80%, rgba(251, 191, 36, 0.08) 0%, transparent 50%),
            linear-gradient(180deg, transparent 60%, rgba(5, 13, 26, 0.9) 100%)
          `,
        }}
      />
      {/* Mountain silhouette */}
      <div
        className="absolute bottom-0 left-0 right-0 h-64 opacity-30"
        style={{
          background: `linear-gradient(to top, #050d1a 0%, transparent 100%),
            polygon(0% 100%, 0% 60%, 15% 45%, 30% 55%, 45% 35%, 60% 50%, 75% 30%, 90% 45%, 100% 25%, 100% 100%)`,
          clipPath: 'polygon(0% 100%, 0% 60%, 15% 45%, 30% 55%, 45% 35%, 60% 50%, 75% 30%, 90% 45%, 100% 25%, 100% 100%)',
          backgroundColor: '#0a1628',
        }}
      />

      <div className="relative mx-auto flex min-h-[85vh] max-w-7xl flex-col justify-center px-6 py-24">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <p className="mb-4 font-serif text-lg italic text-sky-300/80">
            Nepal Paragliding & Hang Gliding Association
          </p>
          <h1 className="mb-2 font-display text-7xl font-bold leading-none tracking-tight text-white md:text-8xl lg:text-9xl">
            NPHA
          </h1>
          <h2 className="mb-8 max-w-3xl font-serif text-3xl font-light text-sky-100 md:text-4xl">
            {competition.name}
          </h2>
          <p className="mb-2 text-lg text-sky-300/70">
            {competition.venue} · {competition.country}
          </p>
          <p className="mb-12 text-sky-400/60">
            {formatDate(competition.startDate)} – {formatDate(competition.endDate)}
          </p>

          <Link
            to={`/${slug}/results`}
            className="group inline-flex items-center gap-3 rounded-full bg-sky-500 px-8 py-4 text-lg font-semibold text-[#050d1a] transition-all hover:bg-sky-400 hover:shadow-lg hover:shadow-sky-500/25"
          >
            View Full Results
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Link>
        </motion.div>

        {topPilots.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="mt-16 border-t border-white/10 pt-12"
          >
            <p className="mb-6 text-sm uppercase tracking-[0.3em] text-sky-400/70">Live Leaderboard</p>
            <div className="grid gap-4 sm:grid-cols-3">
              {topPilots.slice(0, 3).map((pilot) => (
                <div key={pilot.rank} className="flex items-baseline gap-4">
                  <span className="font-display text-4xl text-sky-400/50">#{pilot.rank}</span>
                  <div>
                    <p className="text-xl font-semibold text-white">{pilot.name}</p>
                    <p className="text-sm text-sky-300/60">
                      {pilot.country} · {pilot.score} cm
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}
