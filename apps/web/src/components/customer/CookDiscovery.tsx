import { useState, useMemo } from 'react';
import { ChevronLeft, SlidersHorizontal, Leaf, Drumstick } from 'lucide-react';
import { type CookProfile } from '@/types';
import type { ResolvedLocation } from '../../lib/geolocation';
import { getDistanceKm } from '@maas/core';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StarRating } from '@/components/ui/StarRating';
import { EmptyState } from '@/components/ui/EmptyState';
import { CookListSkeleton } from '@/components/ui/Skeleton';
import { formatINR } from '@/utils';

interface CookDiscoveryProps {
  pincode: string;
  cooks: CookProfile[];
  loading?: boolean;
  onBack: () => void;
  onSelectCook: (cook: CookProfile) => void;
  userLocation?: ResolvedLocation | null;
}

type VegFilter = 'all' | 'veg' | 'mixed';
type SortFilter = 'rating' | 'price-low' | 'price-high';

export function CookDiscovery({
  pincode,
  cooks,
  loading = false,
  onBack,
  onSelectCook,
  userLocation = null,
}: CookDiscoveryProps) {
  const [vegFilter, setVegFilter] = useState<VegFilter>('all');
  const [sort, setSort] = useState<SortFilter>('rating');
  const [showFilters, setShowFilters] = useState(false);
  const [distanceFilter, setDistanceFilter] = useState<'1' | '2' | '3' | null>(null);

  const filtered = useMemo(() => {
    let result = cooks.filter((c) => c.pincodes.includes(pincode));
    if (vegFilter === 'veg') result = result.filter((c) => c.vegType === 'veg');
    if (vegFilter === 'mixed')
      result = result.filter((c) => c.vegType === 'mixed');

    const withDistance = result.map((cook) => ({
      cook,
      distanceKm: userLocation && cook.latitude != null && cook.longitude != null
        ? getDistanceKm(userLocation.latitude, userLocation.longitude, cook.latitude, cook.longitude)
        : undefined,
    }));
    const distanceFiltered = distanceFilter && userLocation
      ? withDistance.filter(({ distanceKm }) => distanceKm != null && (distanceFilter === '1' ? distanceKm <= 1 : distanceFilter === '2' ? distanceKm > 1 && distanceKm <= 2 : distanceKm > 2 && distanceKm <= 3))
      : withDistance;
    return [...distanceFiltered].sort((a, b) => {
      if (userLocation && a.distanceKm != null && b.distanceKm != null) return a.distanceKm - b.distanceKm;
      if (sort === 'rating') return b.cook.rating - a.cook.rating;
      if (sort === 'price-low') return a.cook.weeklyPrice - b.cook.weeklyPrice;
      return b.cook.weeklyPrice - a.cook.weeklyPrice;
    }).map(({ cook }) => cook);
  }, [cooks, pincode, vegFilter, sort, userLocation, distanceFilter]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 animate-fade-in">
      <button
        onClick={onBack}
        className="mb-4 flex items-center gap-1 text-sm text-ink-muted hover:text-ink transition-colors"
      >
        <ChevronLeft size={16} />
        Change pincode
      </button>

      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">
            Cooks serving pincode {pincode}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {filtered.length} {filtered.length === 1 ? 'kitchen' : 'kitchens'}{' '}
            near you
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters((s) => !s)}
        >
          <SlidersHorizontal size={14} />
          Filter
        </Button>
      </div>

      {showFilters && (
        <div className="mb-6 flex flex-wrap items-center gap-4 rounded-lg border border-steel/15 bg-paper-50 p-4 animate-slide-up">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-ink-muted">Type:</span>
            {(['all', 'veg', 'mixed'] as VegFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setVegFilter(f)}
                className={[
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  vegFilter === f
                    ? 'bg-spice text-paper'
                    : 'text-ink-muted hover:bg-paper-200/60',
                ].join(' ')}
              >
                {f === 'all' ? 'All' : f === 'veg' ? 'Veg only' : 'Mixed'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-ink-muted">Sort:</span>
            {(
              [
                ['rating', 'Top rated'],
                ['price-low', 'Price: low to high'],
                ['price-high', 'Price: high to low'],
              ] as [SortFilter, string][]
            ).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setSort(val)}
                className={[
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  sort === val
                    ? 'bg-spice text-paper'
                    : 'text-ink-muted hover:bg-paper-200/60',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {userLocation && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-steel/15 bg-paper-50 px-4 py-3">
          <span className="mr-1 text-xs font-medium text-ink-muted">Distance:</span>
          {([['1', 'Within 1 km'], ['2', '1–2 km'], ['3', '2–3 km']] as const).map(([value, label]) => (
            <button key={value} onClick={() => setDistanceFilter(distanceFilter === value ? null : value)} className={["rounded-md px-2.5 py-1 text-xs font-medium transition-all", distanceFilter === value ? 'bg-marigold text-white shadow-soft' : 'text-ink-muted hover:bg-paper-200/60'].join(' ')}>{label}</button>
          ))}
        </div>
      )}

      {userLocation && <p className="mb-4 text-xs text-ink-muted">Sorted by walking distance from {userLocation.locality || 'your location'}.</p>}

      {loading ? (
        <CookListSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Leaf size={28} strokeWidth={1.5} />}
          title="No cooks in this pincode yet"
          description="We're still growing in this area. Try a nearby pincode — Bengaluru 560001 or 560002 have active kitchens."
          action={distanceFilter ? <Button variant="outline" onClick={() => setDistanceFilter(null)}>Show cooks further away</Button> : <Button variant="outline" onClick={onBack}>Try another pincode</Button>}
        />
      ) : (
        <div className="divide-y divide-steel/10 border-y border-steel/10">
          {filtered.map((cook) => (
            <button
              key={cook.id}
              onClick={() => onSelectCook(cook)}
              className="group flex w-full items-center gap-4 py-4 text-left transition-colors hover:bg-paper-200/30 -mx-2 px-2 rounded-md"
            >
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md border border-steel/15">
                <img
                  src={cook.kitchenPhoto}
                  alt={cook.name}
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-lg font-medium text-ink truncate">
                    {cook.name}
                  </h3>
                  {cook.vegType === 'veg' ? (
                    <Badge tone="leaf">
                      <Leaf size={10} /> Pure Veg
                    </Badge>
                  ) : (
                    <Badge tone="rust">
                      <Drumstick size={10} /> Mixed
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 truncate text-sm text-ink-muted">
                  {cook.tagline}
                </p>
                <div className="mt-1.5 flex items-center gap-3">
                  <StarRating value={cook.rating} count={cook.ratingCount} />
                  <span className="text-xs text-ink-faint">
                    {cook.activeSubscribers} subscribers
                  </span>
                  {userLocation && cook.latitude != null && cook.longitude != null && (
                    <span className="text-xs text-spice">
                      {Math.max(1, Math.round(getDistanceKm(userLocation.latitude, userLocation.longitude, cook.latitude, cook.longitude) * 13))} min walk
                    </span>
                  )}
                </div>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-xs text-ink-muted">Starting from</p>
                <p className="font-display text-lg font-semibold text-ink">
                  {formatINR(cook.weeklyPrice)}
                  <span className="text-xs font-normal text-ink-muted">
                    {' '}/wk
                  </span>
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
