import { useState } from 'react';
import {
  Calendar,
  RefreshCw,
  SkipForward,
  CheckCircle2,
  Star,
  Bike,
  Truck,
  Store,
  RotateCcw,
} from 'lucide-react';
import { type Subscription, type CookProfile, type DeliveryMode } from '@/types';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { StarRating } from '@/components/ui/StarRating';
import { EmptyState } from '@/components/ui/EmptyState';
import { SubscriptionBalance } from './SubscriptionBalance';
import type { Order } from '@/types';
import { formatINR, generateHandoverCode, getFullDayName } from '@/utils';

interface CustomerDashboardProps {
  subscription: Subscription | null;
  cook: CookProfile | null;
  onSubscribe: () => void;
  onUpdateSubscription: (updates: Partial<Subscription>) => void;
  onRate: (stars: number) => void;
  orders?: Order[];
}

const deliveryIcons: Record<DeliveryMode, typeof Store> = {
  'self-pickup': Store,
  'cook-delivery': Bike,
  'platform-delivery': Truck,
};

export function CustomerDashboard({
  subscription,
  cook,
  onSubscribe,
  onUpdateSubscription,
  onRate,
  orders = [],
}: CustomerDashboardProps) {
  const [rating, setRating] = useState(subscription?.ratingGiven || 0);
  const [showRateForm, setShowRateForm] = useState(false);
  const [codeRefreshed, setCodeRefreshed] = useState(false);

  if (!subscription || !cook) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <EmptyState
          icon={<Calendar size={28} strokeWidth={1.5} />}
          title="No active subscription"
          description="You don't have an active tiffin subscription right now. Browse cooks in your area to get started."
          action={
            <Button onClick={onSubscribe}>
              Find a cook
            </Button>
          }
        />
      </div>
    );
  }

  if (subscription.status === 'ended') {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <EmptyState
          icon={<RotateCcw size={28} strokeWidth={1.5} />}
          title="Your subscription has ended"
          description={`You completed ${subscription.daysCompleted} meals with ${cook.name}. Renew to keep getting daily home-cooked meals.`}
          action={
            <Button onClick={onSubscribe}>
              Renew subscription
            </Button>
          }
        />
      </div>
    );
  }

  const todayDelivered = subscription.todayStatus === 'delivered';
  const todaySkipped = subscription.todaySkipped;
  const canRate = todayDelivered && !subscription.ratingGiven;
  const DeliveryIcon = deliveryIcons[subscription.deliveryMode];

  const handleSkip = () => {
    onUpdateSubscription({
      todaySkipped: true,
      todayStatus: 'skipped',
    });
  };

  const handleUnskip = () => {
    onUpdateSubscription({
      todaySkipped: false,
      todayStatus: 'pending',
    });
  };

  const handleNewCode = () => {
    onUpdateSubscription({
      todayCode: generateHandoverCode(),
    });
    setCodeRefreshed(true);
    setTimeout(() => setCodeRefreshed(false), 600);
  };

  const handleRate = (stars: number) => {
    setRating(stars);
    onRate(stars);
    onUpdateSubscription({ ratingGiven: stars });
    setShowRateForm(false);
  };

  const progressPct = Math.round(
    (subscription.daysCompleted / subscription.daysTotal) * 100,
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 animate-fade-in">
      {/* Plan summary */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-ink-muted">
          <span>{getFullDayName()}, today</span>
        </div>
        <h1 className="mt-1 font-display text-2xl font-semibold text-ink">
          {cook.name}
        </h1>
        <p className="mt-0.5 text-sm text-ink-muted">{cook.tagline}</p>
      </div>

      <div className="mb-6">
        <SubscriptionBalance subscription={{ ...subscription, daysCompleted: orders.filter((order) => order.status === 'delivered' || Boolean(order.handoverConfirmedAt)).length }} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Plan details */}
        <div className="space-y-4 lg:col-span-1">
          <Panel>
            <h3 className="mb-3 text-sm font-medium text-ink-muted">
              Plan summary
            </h3>
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-muted">Plan</dt>
                <dd className="font-medium text-ink capitalize">
                  {subscription.planType}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-muted">Meal slot</dt>
                <dd className="font-medium text-ink capitalize">
                  {subscription.mealSlot}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-muted">Delivery</dt>
                <dd className="flex items-center gap-1 font-medium text-ink">
                  <DeliveryIcon size={14} />
                  <span className="capitalize">
                    {subscription.deliveryMode.replace(/-/g, ' ')}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-muted">Total paid</dt>
                <dd className="font-medium text-ink">
                  {formatINR(subscription.totalPaid)}
                </dd>
              </div>
            </dl>

            <div className="mt-4 border-t border-steel/15 pt-4">
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="text-ink-muted">Progress</span>
                <span className="font-medium text-ink">
                  {subscription.daysCompleted} / {subscription.daysTotal} days
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-paper-200">
                <div
                  className="h-full rounded-full bg-leaf transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-ink-muted">
                {subscription.daysRemaining} days remaining
              </p>
            </div>
          </Panel>

          {/* Today's menu */}
          <Panel>
            <h3 className="mb-2 text-sm font-medium text-ink-muted">
              Today's dish
            </h3>
            {(() => {
              const todayIdx = new Date().getDay();
              const dayMap: Record<number, string> = {
                0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed',
                4: 'Thu', 5: 'Fri', 6: 'Sat',
              };
              const todayMenu = cook.weeklyMenu.find(
                (m) => m.day === dayMap[todayIdx],
              );
              return todayMenu ? (
                <div>
                  <p className="font-display text-lg font-medium text-ink">
                    {todayMenu.dish}
                  </p>
                  <p className="mt-0.5 text-sm text-ink-muted">
                    {todayMenu.description}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-ink-muted">No menu for today.</p>
              );
            })()}
          </Panel>
        </div>

        {/* Right: Handover code + actions */}
        <div className="space-y-4 lg:col-span-2">
          {/* Handover code — the bold moment */}
          {todaySkipped ? (
            <Panel className="text-center">
              <div className="mb-2 flex justify-center">
                <SkipForward size={32} className="text-steel" strokeWidth={1.5} />
              </div>
              <h3 className="font-display text-lg font-medium text-ink">
                Today's meal skipped
              </h3>
              <p className="mt-1 text-sm text-ink-muted">
                No charge for today. Your subscription resumes tomorrow
                automatically.
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={handleUnskip}>
                Undo skip
              </Button>
            </Panel>
          ) : todayDelivered ? (
            <Panel className="text-center">
              <div className="mb-2 flex justify-center">
                <CheckCircle2 size={32} className="text-leaf" strokeWidth={1.5} />
              </div>
              <h3 className="font-display text-lg font-medium text-ink">
                Today's meal confirmed
              </h3>
              <p className="mt-1 text-sm text-ink-muted">
                Handover code matched. Your meal has been delivered.
              </p>
              {canRate && !showRateForm && (
                <div className="mt-4 border-t border-steel/15 pt-4">
                  <p className="mb-2 text-sm text-ink-muted">
                    How was today's meal?
                  </p>
                  <Button size="sm" onClick={() => setShowRateForm(true)}>
                    <Star size={14} /> Rate this cook
                  </Button>
                </div>
              )}
              {showRateForm && (
                <div className="mt-4 border-t border-steel/15 pt-4 animate-slide-up">
                  <p className="mb-3 text-sm text-ink-muted">
                    Tap to rate {cook.name}'s meal
                  </p>
                  <div className="flex justify-center">
                    <StarRating
                      value={rating}
                      size="lg"
                      interactive
                      onChange={handleRate}
                    />
                  </div>
                </div>
              )}
              {subscription.ratingGiven && (
                <div className="mt-4 border-t border-steel/15 pt-4">
                  <p className="mb-2 text-sm text-ink-muted">Your rating</p>
                  <div className="flex justify-center">
                    <StarRating value={subscription.ratingGiven} size="lg" />
                  </div>
                </div>
              )}
            </Panel>
          ) : (
            <>
              <Panel className="text-center">
                <div className="mb-1 flex items-center justify-center gap-2">
                  <span className="text-sm font-medium text-ink-muted">
                    Today's handover code
                  </span>
                  <button
                    onClick={handleNewCode}
                    className="rounded p-1 text-ink-faint hover:text-ink transition-colors"
                    title="Generate new code"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
                <div
                  key={subscription.todayCode}
                  className={[
                    'my-2 font-display text-6xl font-semibold tracking-[0.3em] text-ink',
                    codeRefreshed ? 'animate-code-emphasis' : 'animate-code-emphasis',
                  ].join(' ')}
                >
                  {subscription.todayCode}
                </div>
                <p className="mt-2 text-sm text-ink-muted">
                  Show this code to {cook.name} or the delivery person when your
                  meal arrives. Only a correct match confirms your meal.
                </p>
              </Panel>

              {/* Skip action */}
              <div className="flex items-center justify-between rounded-lg border border-steel/15 bg-paper-50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-ink">Skip today's meal</p>
                  <p className="text-xs text-ink-muted">
                    No charge, no code needed. Resumes tomorrow.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleSkip}>
                  <SkipForward size={14} />
                  Skip
                </Button>
              </div>

            </>
          )}
        </div>
      </div>
    </div>
  );
}
