/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        navy: 'hsl(var(--navy))',
        sky: 'hsl(var(--sky))',
        slate: 'hsl(var(--slate))',
        bullseye: 'hsl(var(--score-bullseye))',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Outfit', 'system-ui', 'sans-serif'],
        display: ['Syne', 'Outfit', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        content: '72rem',
      },
      backgroundImage: {
        'hero-sky':
          'radial-gradient(ellipse 80% 60% at 50% -10%, hsl(199 89% 48% / 0.18), transparent 55%), linear-gradient(180deg, hsl(210 40% 98%) 0%, hsl(210 35% 96%) 45%, hsl(0 0% 100%) 100%)',
        'target-ring':
          'radial-gradient(circle at center, transparent 28%, hsl(199 89% 48% / 0.06) 29%, transparent 30%, transparent 48%, hsl(207 100% 16% / 0.05) 49%, transparent 50%)',
      },
    },
  },
  plugins: [],
};
