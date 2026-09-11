import { type ReactNode } from 'react';

interface PanelProps {
  children: ReactNode;
  className?: string;
  bordered?: boolean;
  padded?: boolean;
}

export function Panel({
  children,
  className = '',
  bordered = true,
  padded = true,
}: PanelProps) {
  return (
    <div
      className={[
        'rounded-lg bg-paper-50',
        bordered ? 'border border-steel/15' : '',
        padded ? 'p-5' : '',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}
