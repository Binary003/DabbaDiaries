import { Star } from 'lucide-react';

interface StarRatingProps {
  value: number;
  count?: number;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  onChange?: (value: number) => void;
}

const sizeMap = {
  sm: 14,
  md: 18,
  lg: 28,
};

export function StarRating({
  value,
  count,
  size = 'sm',
  interactive = false,
  onChange,
}: StarRatingProps) {
  const px = sizeMap[size];
  const stars = [1, 2, 3, 4, 5];

  if (interactive) {
    return (
      <div className="flex items-center gap-1">
        {stars.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange?.(n)}
            className="transition-transform hover:scale-110 active:scale-95"
          >
            <Star
              size={px}
              className={
                n <= value
                  ? 'fill-marigold text-marigold'
                  : 'fill-none text-steel/40'
              }
            />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Star size={px} className="fill-marigold text-marigold" />
      <span className="text-sm font-medium text-ink">
        {value.toFixed(1)}
      </span>
      {count !== undefined && (
        <span className="text-xs text-ink-muted">({count})</span>
      )}
    </div>
  );
}
