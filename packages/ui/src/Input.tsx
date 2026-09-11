import { type InputHTMLAttributes, type ReactNode } from 'react';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string;
  hint?: string;
  error?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
}

export function Input({
  label,
  hint,
  error,
  prefix,
  suffix,
  className = '',
  id,
  ...props
}: InputProps) {
  const inputId = id || props.name;
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-sm font-medium text-ink"
        >
          {label}
        </label>
      )}
      <div
        className={[
          'flex items-center rounded-md border bg-white/60 transition-colors',
          error
            ? 'border-rust/40'
            : 'border-steel/25 hover:border-steel/40 focus-within:border-marigold focus-within:bg-white',
          className,
        ].join(' ')}
      >
        {prefix && (
          <span className="pl-3 text-ink-muted text-sm">{prefix}</span>
        )}
        <input
          id={inputId}
          className={[
            'w-full bg-transparent px-3 py-2.5 text-sm text-ink placeholder:text-ink-faint',
            'focus:outline-none',
            prefix ? 'pl-2' : '',
            suffix ? 'pr-2' : '',
          ].join(' ')}
          {...props}
        />
        {suffix && (
          <span className="pr-3 text-ink-muted text-sm">{suffix}</span>
        )}
      </div>
      {error ? (
        <p className="mt-1.5 text-xs text-rust">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}
