import { type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useEffect } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizes = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/30 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className={[
          'w-full bg-paper-50 rounded-t-lg sm:rounded-lg border border-steel/15 shadow-float',
          'max-h-[90vh] overflow-y-auto scrollbar-thin',
          'animate-slide-up',
          sizes[size],
        ].join(' ')}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-steel/10 px-5 py-4">
            <h3 className="font-display text-lg font-semibold text-ink">
              {title}
            </h3>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-ink-muted hover:bg-paper-200/60 hover:text-ink transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
