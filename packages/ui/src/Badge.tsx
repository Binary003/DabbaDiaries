import { type ReactNode } from 'react';

type Tone = 'leaf' | 'rust' | 'marigold' | 'steel' | 'spice';

interface BadgeProps {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}

const tones: Record<Tone, string> = {
  leaf: 'bg-leaf-50 text-leaf-dark border-leaf/20',
  rust: 'bg-rust-50 text-rust-dark border-rust/20',
  marigold: 'bg-marigold-50 text-marigold-dark border-marigold/20',
  steel: 'bg-steel-50 text-steel-dark border-steel/20',
  spice: 'bg-spice-50 text-spice-dark border-spice/20',
};

export function Badge({ tone = 'steel', children, className = '' }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium',
        tones[tone],
        className,
      ].join(' ')}
    >
      {children}
    </span>
  );
}
