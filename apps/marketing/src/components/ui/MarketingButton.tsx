import { Link } from 'react-router-dom';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'onDark' | 'onDarkOutline';
type ButtonSize = 'md' | 'lg';

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-navy text-white hover:bg-navy/90 shadow-sm focus-visible:outline-accent',
  secondary:
    'bg-white text-navy border border-navy/15 hover:border-sky hover:text-sky shadow-sm',
  ghost: 'bg-transparent text-navy hover:bg-navy/5',
  onDark:
    'bg-sky text-navy hover:bg-sky/90 shadow-sm focus-visible:outline-white',
  onDarkOutline:
    'bg-transparent text-white border border-white/35 hover:border-sky hover:bg-white/10 focus-visible:outline-white',
};

const sizeClasses: Record<ButtonSize, string> = {
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3.5 text-base',
};

type CommonProps = {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

type ButtonAsButton = CommonProps &
  Omit<ComponentPropsWithoutRef<'button'>, keyof CommonProps> & {
    href?: undefined;
    to?: undefined;
  };

type ButtonAsAnchor = CommonProps &
  Omit<ComponentPropsWithoutRef<'a'>, keyof CommonProps> & {
    href: string;
    to?: undefined;
  };

type ButtonAsLink = CommonProps & {
  to: string;
  href?: undefined;
};

export type MarketingButtonProps = ButtonAsButton | ButtonAsAnchor | ButtonAsLink;

export function MarketingButton(props: MarketingButtonProps) {
  const { children, variant = 'primary', size = 'md', className = '' } = props;

  const classes = [
    'inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors',
    'min-h-11 touch-manipulation',
    variantClasses[variant],
    sizeClasses[size],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if ('to' in props && props.to) {
    return (
      <Link to={props.to} className={classes}>
        {children}
      </Link>
    );
  }

  if ('href' in props && props.href) {
    const href = props.href;
    const external = href.startsWith('http') || href.startsWith('mailto:');
    return (
      <a
        href={href}
        className={classes}
        {...(external ? { rel: 'noopener noreferrer' } : {})}
      >
        {children}
      </a>
    );
  }

  const buttonProps = props as ButtonAsButton;
  const { type = 'button', onClick, disabled } = buttonProps;
  return (
    <button type={type} className={classes} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
