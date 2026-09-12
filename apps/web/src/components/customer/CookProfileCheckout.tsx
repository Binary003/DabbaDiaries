import { useState, useMemo } from 'react';
import { getDeliveryFee, isDeliveryModeAvailable } from '@maas/core';
import {
  ChevronLeft,
  Leaf,
  Drumstick,
  Bike,
  Truck,
  Store,
  Check,
  ShieldCheck,
  Clock,
} from 'lucide-react';
import { type CookProfile, type DeliveryMode, type PlanType, type DeliveryZone } from '@/types';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Panel } from '@/components/ui/Panel';
import { StarRating } from '@/components/ui/StarRating';
import { Modal } from '@/components/ui/Modal';
import { formatINR } from '@/utils';
import { PLATFORM_FEE_PER_MEAL } from '@/data';

interface CookProfileCheckoutProps {
  cook: CookProfile;
  zone?: DeliveryZone;
  onBack: () => void;
  onSubscribe: (data: {
    cook: CookProfile;
    planType: PlanType;
    deliveryMode: DeliveryMode;
  }) => void;
}

export function CookProfileCheckout({
  cook,
  zone,
  onBack,
  onSubscribe,
}: CookProfileCheckoutProps) {
  const [selectedDay, setSelectedDay] = useState(0);
  const [planType, setPlanType] = useState<PlanType>('weekly');
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode | null>(null);
  const [mealSlot, setMealSlot] = useState<'lunch' | 'dinner'>('lunch');
  const [showConfirm, setShowConfirm] = useState(false);

  const dayMenu = cook.weeklyMenu[selectedDay];

  const deliveryOptions = useMemo(() => {
    const opts: {
      mode: DeliveryMode;
      label: string;
      desc: string;
      fee: number;
      available: boolean;
      icon: typeof Store;
    }[] = [
        {
          mode: 'self-pickup',
          label: 'Self-pickup',
          desc: `Pick up from ${cook.name}'s kitchen — no delivery fee`,
          fee: getDeliveryFee('self-pickup', cook.selfDeliveryFee, zone),
          available: isDeliveryModeAvailable('self-pickup', cook.selfDelivery, zone),
          icon: Store,
        },
        {
          mode: 'cook-delivery',
          label: "Cook's delivery",
          desc: cook.selfDelivery
            ? `${cook.name} delivers personally`
            : 'This cook does not offer personal delivery',
          fee: getDeliveryFee('cook-delivery', cook.selfDeliveryFee, zone),
          available: isDeliveryModeAvailable('cook-delivery', cook.selfDelivery, zone),
          icon: Bike,
        },
        {
          mode: 'platform-delivery',
          label: 'Platform zone delivery',
          desc: zone?.hasPlatformDelivery
            ? `Zone partner: ${zone.deliveryPartner} · ${zone.deliveryWindow}`
            : 'No platform delivery partner in this zone yet',
          fee: getDeliveryFee('platform-delivery', cook.selfDeliveryFee, zone),
          available: isDeliveryModeAvailable('platform-delivery', cook.selfDelivery, zone),
          icon: Truck,
        },
      ];
    return opts;
  }, [cook, zone]);

  const planPrice = planType === 'single' ? cook.pricePerMeal : planType === 'weekly' ? cook.weeklyPrice : cook.monthlyPrice;
  const planDays = planType === 'single' ? 1 : planType === 'weekly' ? 7 : 30;

  const selectedDelivery = deliveryOptions.find((o) => o.mode === deliveryMode);
  const deliveryFee = selectedDelivery?.fee || 0;
  const totalMeals = planDays;
  const totalPlatformFee = PLATFORM_FEE_PER_MEAL * totalMeals;
  const totalDeliveryFee = deliveryFee * totalMeals;
  const grandTotal = planPrice + totalPlatformFee + totalDeliveryFee;

  const canSubscribe = deliveryMode !== null;

  const handleSubscribe = () => {
    if (!deliveryMode) return;
    setShowConfirm(true);
  };

  const confirmSubscribe = () => {
    if (!deliveryMode) return;
    onSubscribe({ cook, planType, deliveryMode });
    setShowConfirm(false);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 animate-fade-in">
      <button
        onClick={onBack}
        className="mb-4 flex items-center gap-1 text-sm text-ink-muted hover:text-ink transition-colors"
      >
        <ChevronLeft size={16} />
        Back to cooks
      </button>

      {/* Cook header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="h-28 w-28 shrink-0 overflow-hidden rounded-lg border border-steel/15">
          <img
            src={cook.kitchenPhoto}
            alt={cook.name}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-semibold text-ink">
              {cook.name}
            </h1>
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
          <p className="mt-1 text-ink-muted">{cook.tagline}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <StarRating value={cook.rating} count={cook.ratingCount} />
            <span className="flex items-center gap-1 text-xs text-ink-muted">
              <ShieldCheck size={14} className="text-leaf" />
              FSSAI verified
            </span>
            <span className="flex items-center gap-1 text-xs text-ink-muted">
              <Clock size={14} />
              {cook.activeSubscribers} active subscribers
            </span>
          </div>
          <p className="mt-3 max-w-xl text-sm text-ink-light leading-relaxed">
            {cook.bio}
          </p>
        </div>
      </div>

      {/* Weekly menu board */}
      <div className="mb-8">
        <h2 className="mb-3 font-display text-lg font-semibold text-ink">
          This week's menu
        </h2>
        <div className="overflow-x-auto scrollbar-thin">
          <div className="flex min-w-max gap-1 border-b border-steel/15">
            {cook.weeklyMenu.map((menu, i) => (
              <button
                key={menu.day}
                onClick={() => setSelectedDay(i)}
                className={[
                  'relative px-4 py-2.5 text-sm font-medium transition-colors',
                  selectedDay === i
                    ? 'text-spice'
                    : 'text-ink-muted hover:text-ink',
                ].join(' ')}
              >
                {menu.day}
                {selectedDay === i && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-spice" />
                )}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 rounded-lg border border-steel/15 bg-paper-50 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-xl font-medium text-ink">
                  {dayMenu.dish}
                </h3>
                {dayMenu.vegType === 'veg' ? (
                  <Leaf size={16} className="text-leaf" />
                ) : (
                  <Drumstick size={16} className="text-rust" />
                )}
              </div>
              <p className="mt-1 text-sm text-ink-muted">
                {dayMenu.description}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs text-ink-muted">Per meal</p>
              <p className="font-display text-lg font-semibold text-ink">
                {formatINR(cook.pricePerMeal)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Plan selector */}
      <div className="mb-8">
        <h2 className="mb-3 font-display text-lg font-semibold text-ink">
          Choose your plan
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ['single', 'Try it today', 1, cook.pricePerMeal] as [PlanType, string, number, number],
              ['weekly', 'Weekly', 7, cook.weeklyPrice] as [PlanType, string, number, number],
              ['monthly', 'Monthly', 30, cook.monthlyPrice] as [PlanType, string, number, number],
            ]
          ).map(([type, label, days, price]) => (
            <button
              key={type}
              onClick={() => setPlanType(type)}
              className={[
                'relative min-h-11 rounded-lg border-2 p-4 text-left transition-all',
                planType === type
                  ? 'border-marigold bg-marigold-50/50'
                  : 'border-steel/15 bg-paper-50 hover:border-steel/30',
              ].join(' ')}
            >
              {planType === type && (
                <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-marigold text-white">
                  <Check size={12} />
                </div>
              )}
              <h3 className="font-display text-lg font-medium text-ink">
                {label}
              </h3>
              <p className="text-sm text-ink-muted">{days} days, 1 meal/day</p>
              <p className="mt-2 font-display text-2xl font-semibold text-ink">
                {formatINR(price)}
              </p>
              <p className="text-xs text-ink-muted">{formatINR(Math.round(price / days))} per meal</p>
              {type === 'single' && <p className="mt-2 text-xs text-ink-muted">No delivery-mode flexibility or savings — try one meal before subscribing.</p>}
            </button>
          ))}
        </div>
      </div>

      {/* Meal slot */}
      <div className="mb-8">
        <h2 className="mb-3 font-display text-lg font-semibold text-ink">
          Meal slot
        </h2>
        <div className="flex gap-3">
          {(['lunch', 'dinner'] as const).map((slot) => (
            <button
              key={slot}
              onClick={() => setMealSlot(slot)}
              className={[
                'min-h-11 rounded-md border px-4 py-2.5 text-sm font-medium capitalize transition-colors',
                mealSlot === slot
                  ? 'border-spice bg-spice-50 text-spice-dark'
                  : 'border-steel/15 bg-paper-50 text-ink-muted hover:border-steel/30',
              ].join(' ')}
            >
              {slot}
            </button>
          ))}
        </div>
      </div>

      {/* Delivery mode */}
      <div className="mb-8">
        <h2 className="mb-3 font-display text-lg font-semibold text-ink">
          Delivery mode
        </h2>
        <div className="space-y-3">
          {deliveryOptions.map((opt) => {
            const Icon = opt.icon;
            const isSelected = deliveryMode === opt.mode;
            return (
              <button
                key={opt.mode}
                onClick={() => opt.available && setDeliveryMode(opt.mode)}
                disabled={!opt.available}
                className={[
                  'flex w-full items-center gap-3 rounded-lg border-2 p-4 text-left transition-all',
                  !opt.available
                    ? 'border-steel/10 bg-paper-200/30 opacity-60 cursor-not-allowed'
                    : isSelected
                      ? 'border-marigold bg-marigold-50/50'
                      : 'border-steel/15 bg-paper-50 hover:border-steel/30',
                ].join(' ')}
              >
                <div
                  className={[
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-md',
                    isSelected
                      ? 'bg-marigold text-white'
                      : 'bg-paper-200/60 text-steel',
                  ].join(' ')}
                >
                  <Icon size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-ink">{opt.label}</h3>
                    {opt.fee === 0 ? (
                      <Badge tone="leaf">Free</Badge>
                    ) : (
                      <Badge tone="steel">{formatINR(opt.fee)}/meal</Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-ink-muted">{opt.desc}</p>
                </div>
                {isSelected && (
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-marigold text-white">
                    <Check size={12} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Price summary */}
      <Panel className="mb-6">
        <h2 className="mb-4 font-display text-lg font-semibold text-ink">
          Price summary
        </h2>
        <div className="space-y-2.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-ink-muted">
              {planType === 'single' ? 'Single day' : planType === 'weekly' ? 'Weekly' : 'Monthly'} plan ({totalMeals}{' '}
              meals)
            </span>
            <span className="font-medium text-ink">{formatINR(planPrice)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-ink-muted">
              Platform service fee ({formatINR(PLATFORM_FEE_PER_MEAL)} ×{' '}
              {totalMeals} meals)
              <span className="ml-1 text-xs text-ink-faint">→ goes to platform</span>
            </span>
            <span className="font-medium text-ink">
              {formatINR(totalPlatformFee)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-ink-muted">
              Delivery fee
              {deliveryMode === 'self-pickup' && (
                <span className="ml-1 text-xs text-ink-faint">→ self-pickup, free</span>
              )}
              {deliveryMode === 'cook-delivery' && (
                <span className="ml-1 text-xs text-ink-faint">
                  → goes to cook
                </span>
              )}
              {deliveryMode === 'platform-delivery' && (
                <span className="ml-1 text-xs text-ink-faint">
                  → goes to delivery partner
                </span>
              )}
            </span>
            <span className="font-medium text-ink">
              {deliveryFee === 0 ? 'Free' : formatINR(totalDeliveryFee)}
            </span>
          </div>
          <div className="border-t border-steel/15 pt-2.5">
            <div className="flex items-center justify-between">
              <span className="font-medium text-ink">Total</span>
              <span className="font-display text-xl font-semibold text-ink">
                {formatINR(grandTotal)}
              </span>
            </div>
          </div>
        </div>
      </Panel>

      <Button
        size="lg"
        fullWidth
        onClick={handleSubscribe}
        disabled={!canSubscribe}
      >
        {planType === 'single' ? 'Order one tiffin' : 'Subscribe'} &amp; pay {formatINR(grandTotal)}
      </Button>
      {!canSubscribe && (
        <p className="mt-2 text-center text-xs text-ink-muted">
          Select a delivery mode to continue
        </p>
      )}

      <Modal
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        title={planType === 'single' ? 'Confirm one-day order' : 'Confirm subscription'}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">
            {planType === 'single' ? 'You are ordering one tiffin from ' : 'You are subscribing to '}<strong className="text-ink">{cook.name}</strong>{' '}
            {planType === 'single' ? 'for today.' : `${planType} plan with `}
            {deliveryOptions.find((o) => o.mode === deliveryMode)?.label.toLowerCase()}.
          </p>
          <div className="rounded-lg border border-steel/15 bg-paper-100 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-muted">Total</span>
              <span className="font-semibold text-ink">
                {formatINR(grandTotal)}
              </span>
            </div>
          </div>
          <p className="text-xs text-ink-muted">
            This is a prototype — no real payment will be charged. You'll get a
            daily 4-digit handover code to confirm each meal.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" fullWidth onClick={() => setShowConfirm(false)}>
              Cancel
            </Button>
            <Button fullWidth onClick={confirmSubscribe}>
              Confirm &amp; pay
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
