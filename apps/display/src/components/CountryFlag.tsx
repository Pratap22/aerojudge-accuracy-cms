import { motion } from 'framer-motion';
import { countryCodeToEmoji } from '../lib/utils';

interface CountryFlagProps {
  code: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeMap = {
  sm: 'text-2xl',
  md: 'text-4xl',
  lg: 'text-6xl',
  xl: 'text-8xl',
};

export function CountryFlag({ code, size = 'md', className = '' }: CountryFlagProps) {
  const emoji = countryCodeToEmoji(code);
  return (
    <motion.span
      className={`leading-none ${sizeMap[size]} ${className}`}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300 }}
      aria-label={`Country ${code}`}
    >
      {emoji}
    </motion.span>
  );
}
