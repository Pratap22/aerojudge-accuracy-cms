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
        /* Match Admin / product shell (Inter via globals + shared weights) */
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        content: '72rem',
      },
      backgroundImage: {
        'hero-sky':
          'radial-gradient(ellipse 80% 55% at 70% -15%, hsl(199 89% 48% / 0.22), transparent 50%), radial-gradient(ellipse 50% 40% at 10% 20%, hsl(207 100% 16% / 0.06), transparent 45%), linear-gradient(180deg, hsl(210 40% 98%) 0%, hsl(210 35% 96%) 50%, hsl(0 0% 100%) 100%)',
        'target-ring':
          'radial-gradient(circle at center, transparent 28%, hsl(199 89% 48% / 0.07) 29%, transparent 30%, transparent 48%, hsl(207 100% 16% / 0.06) 49%, transparent 50%)',
      },
    },
  },
  plugins: [],
};
