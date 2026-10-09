import logoUrl from '../assets/aerojudge-logo.png';

type AeroJudgeLogoProps = {
  className?: string;
};

/** Official AeroJudge lockup. White plate keeps the navy wordmark readable on dark surfaces. */
export function AeroJudgeLogo({ className = 'h-12 w-auto' }: AeroJudgeLogoProps) {
  return (
    <img
      src={logoUrl}
      alt="AeroJudge"
      className={`rounded-md bg-white object-contain ${className}`}
    />
  );
}
