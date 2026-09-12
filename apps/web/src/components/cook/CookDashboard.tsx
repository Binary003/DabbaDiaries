import { useState, useMemo } from 'react';
import { validateCapacity, validateHandoverCode } from '@maas/core';
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Bike,
  Truck,
  Store,
  TrendingUp,
  Users,
  Edit2,
  Leaf,
  Drumstick,
} from 'lucide-react';
import { type CookProfile, type Order, type Payment, type DeliveryMode } from '@/types';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Panel } from '@/components/ui/Panel';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Input } from '@/components/ui/Input';
import { formatINR, getFullDayName } from '@/utils';
import { CAPACITY_CAP, PLATFORM_FEE_PER_MEAL } from '@/data';

interface CookDashboardProps {
  cook: CookProfile;
  orders: Order[];
  payments: Payment[];
  onUpdateCook: (updates: Partial<CookProfile>) => void;
  onUpdateOrder: (orderId: string, updates: Partial<Order>, submittedCode?: string) => void;
  onEditProfile: () => void;
}

export function CookDashboard({
  cook,
  orders,
  payments,
  onUpdateCook,
  onUpdateOrder,
  onEditProfile,
}: CookDashboardProps) {
  const [codeInputs, setCodeInputs] = useState<Record<string, string>>({});
  const [codeErrors, setCodeErrors] = useState<Record<string, string>>({});
  const [editingCapacity, setEditingCapacity] = useState(false);
  const [capacityInput, setCapacityInput] = useState(cook.capacity);
  const [capacityError, setCapacityError] = useState('');
  const [editingMenu, setEditingMenu] = useState(false);
  const [menuDraft, setMenuDraft] = useState(cook.weeklyMenu);

  const todayOrders = useMemo(
    () => orders.filter((o) => o.cookId === cook.id),
    [orders, cook.id],
  );

  const pendingOrders = todayOrders.filter(
    (o) => o.status === 'pending',
  );
  const confirmedOrders = todayOrders.filter(
    (o) => o.status === 'confirmed',
  );

  const weekEarnings = useMemo(() => {
    const selfPickup = payments
      .filter((p) => p.cookId === cook.id && p.deliveryMode === 'self-pickup')
      .reduce((sum, p) => sum + p.cookEarning, 0);
    const selfDelivery = payments
      .filter((p) => p.cookId === cook.id && p.deliveryMode === 'cook-delivery')
      .reduce((sum, p) => sum + p.cookEarning + p.deliveryFee, 0);
    const platformDelivery = payments
      .filter((p) => p.cookId === cook.id && p.deliveryMode === 'platform-delivery')
      .reduce((sum, p) => sum + p.cookEarning, 0);
    const total = selfPickup + selfDelivery + platformDelivery;
    return { selfPickup, selfDelivery, platformDelivery, total };
  }, [payments, cook.id]);

  const handleVerifyCode = (orderId: string, expectedCode: string) => {
    const input = codeInputs[orderId] || '';
    if (validateHandoverCode(expectedCode, input)) {
      setCodeErrors((prev) => ({ ...prev, [orderId]: '' }));
      setCodeInputs((prev) => ({ ...prev, [orderId]: '' }));
      onUpdateOrder(orderId, { status: 'confirmed' }, input);
    } else {
      setCodeErrors((prev) => ({
        ...prev,
        [orderId]: 'Wrong code. Ask the customer for the correct 4-digit code.',
      }));
      setCodeInputs((prev) => ({ ...prev, [orderId]: '' }));
    }
  };

  const handleCapacitySave = () => {
    const result = validateCapacity(capacityInput);
    if (!result.valid) {
      setCapacityInput(Math.min(CAPACITY_CAP, Math.max(1, capacityInput)));
      setCapacityError(result.reason);
      return;
    }
    setCapacityError('');
    onUpdateCook({ capacity: capacityInput });
    setEditingCapacity(false);
  };

  const handleMenuSave = () => {
    onUpdateCook({ weeklyMenu: menuDraft });
    setEditingMenu(false);
  };

  const deliveryIcons: Record<DeliveryMode, typeof Store> = {
    'self-pickup': Store,
    'cook-delivery': Bike,
    'platform-delivery': Truck,
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 animate-fade-in">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-ink-muted">{getFullDayName()}, today</p>
          <h1 className="font-display text-2xl font-semibold text-ink">
            {cook.name}
          </h1>
          <p className="mt-0.5 text-sm text-ink-muted">{cook.tagline}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onEditProfile}>
          <Edit2 size={14} />
          Edit profile
        </Button>
      </div>

      {/* Stats row */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Panel padded className="p-4">
          <div className="flex items-center gap-2 text-xs text-ink-muted">
            <Users size={14} /> Active subscribers
          </div>
          <p className="mt-1 font-display text-2xl font-semibold text-ink">
            {cook.activeSubscribers}
          </p>
        </Panel>
        <Panel padded className="p-4">
          <div className="flex items-center gap-2 text-xs text-ink-muted">
            <TrendingUp size={14} /> This week's earnings
          </div>
          <p className="mt-1 font-display text-2xl font-semibold text-ink">
            {formatINR(weekEarnings.total)}
          </p>
        </Panel>
        <Panel padded className="p-4">
          <div className="flex items-center gap-2 text-xs text-ink-muted">
            <Clock size={14} /> Today's orders
          </div>
          <p className="mt-1 font-display text-2xl font-semibold text-ink">
            {todayOrders.length}
          </p>
        </Panel>
        <Panel padded className="p-4">
          <div className="flex items-center gap-2 text-xs text-ink-muted">
            <CheckCircle2 size={14} /> Confirmed today
          </div>
          <p className="mt-1 font-display text-2xl font-semibold text-ink">
            {confirmedOrders.length}
          </p>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Orders + handover codes */}
        <div className="space-y-6">
          {/* Pending handover codes */}
          <div>
            <SectionHeader
              title="Pending handover codes"
              subtitle="Enter the code shown by the customer to confirm delivery"
            />
            {pendingOrders.length === 0 ? (
              <Panel className="text-center">
                <CheckCircle2 size={24} className="mx-auto mb-2 text-leaf" strokeWidth={1.5} />
                <p className="text-sm text-ink-muted">
                  All today's orders confirmed. No pending codes.
                </p>
              </Panel>
            ) : (
              <div className="space-y-3">
                {pendingOrders.map((order) => {
                  const Icon = deliveryIcons[order.deliveryMode];
                  return (
                    <Panel key={order.id} padded className="p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-ink">
                            {order.customerName}
                          </p>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-muted">
                            <Icon size={12} />
                            <span className="capitalize">
                              {order.deliveryMode.replace(/-/g, ' ')}
                            </span>
                            <span>·</span>
                            <span className="capitalize">{order.mealSlot}</span>
                          </div>
                        </div>
                        <Badge tone="marigold">
                          <Clock size={10} /> Pending
                        </Badge>
                      </div>
                      {order.deliveryMode === 'cook-delivery' && (
                        <div className="mb-3 rounded-md border border-marigold/20 bg-marigold-50/60 px-3 py-2 text-xs text-ink">
                          <p className="font-medium text-ink">Delivery details</p>
                          <p className="mt-1">{order.customerPhone || 'Phone not provided'} · {order.customerLocality || order.address || 'Locality not provided'}</p>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={4}
                          placeholder="Code"
                          value={codeInputs[order.id] || ''}
                          onChange={(e) => {
                            setCodeInputs((prev) => ({
                              ...prev,
                              [order.id]: e.target.value.replace(/\D/g, ''),
                            }));
                            if (codeErrors[order.id])
                              setCodeErrors((prev) => ({ ...prev, [order.id]: '' }));
                          }}
                          onKeyDown={(e) =>
                            e.key === 'Enter' &&
                            (codeInputs[order.id] || '').length === 4 &&
                            handleVerifyCode(order.id, order.handoverCode || '')
                          }
                          className={[
                            'w-32 rounded-md border bg-white/60 px-3 py-2 text-center font-display text-lg tracking-[0.15em] text-ink placeholder:text-ink-faint',
                            'focus:outline-none focus:border-marigold focus:bg-white transition-colors',
                            codeErrors[order.id]
                              ? 'border-rust/40 animate-shake'
                              : 'border-steel/25',
                          ].join(' ')}
                        />
                        <Button
                          size="sm"
                          onClick={() =>
                            handleVerifyCode(order.id, order.handoverCode || '')
                          }
                          disabled={(codeInputs[order.id] || '').length !== 4}
                        >
                          <CheckCircle2 size={14} />
                          Confirm
                        </Button>
                      </div>
                      {codeErrors[order.id] && (
                        <p className="mt-2 flex items-center gap-1 text-xs text-rust">
                          <AlertCircle size={12} />
                          {codeErrors[order.id]}
                        </p>
                      )}
                    </Panel>
                  );
                })}
              </div>
            )}
          </div>

          {/* Confirmed orders */}
          {confirmedOrders.length > 0 && (
            <div>
              <SectionHeader title="Confirmed today" />
              <div className="space-y-2">
                {confirmedOrders.map((order) => {
                  const Icon = deliveryIcons[order.deliveryMode];
                  return (
                    <div
                      key={order.id}
                      className="flex items-center justify-between rounded-md border border-leaf/15 bg-leaf-50/50 px-4 py-2.5"
                    >
                      <div>
                        <p className="text-sm font-medium text-ink">
                          {order.customerName}
                        </p>
                        {order.deliveryMode === 'cook-delivery' && <p className="mt-0.5 text-xs text-ink-muted">{order.customerPhone || 'Phone not provided'} · {order.customerLocality || order.address || 'Locality not provided'}</p>}
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-muted">
                          <Icon size={12} />
                          <span className="capitalize">
                            {order.deliveryMode.replace(/-/g, ' ')}
                          </span>
                        </div>
                      </div>
                      <CheckCircle2 size={18} className="text-leaf" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right: Capacity, earnings, menu */}
        <div className="space-y-6">
          {/* Capacity */}
          <div>
            <SectionHeader title="Daily capacity" />
            <Panel>
              {editingCapacity ? (
                <div className="space-y-3">
                  <Input
                    type="number"
                    value={capacityInput}
                    onChange={(e) => setCapacityInput(Number(e.target.value))}
                    suffix={`/ ${CAPACITY_CAP} max`}
                    error={capacityError}
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingCapacity(false);
                        setCapacityInput(cook.capacity);
                        setCapacityError('');
                      }}
                    >
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleCapacitySave}>
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-display text-2xl font-semibold text-ink">
                      {cook.capacity}{' '}
                      <span className="text-sm font-normal text-ink-muted">
                        meals/day
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      Capped at {CAPACITY_CAP} for home kitchens
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingCapacity(true)}
                  >
                    <Edit2 size={14} />
                    Change
                  </Button>
                </div>
              )}
              <div className="mt-3 border-t border-steel/15 pt-3">
                <div className="mb-1 flex justify-between text-xs text-ink-muted">
                  <span>In use</span>
                  <span>
                    {cook.activeSubscribers} / {cook.capacity}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-paper-200">
                  <div
                    className={[
                      'h-full rounded-full transition-all',
                      cook.activeSubscribers >= cook.capacity
                        ? 'bg-rust'
                        : 'bg-spice',
                    ].join(' ')}
                    style={{
                      width: `${Math.min(100, (cook.activeSubscribers / cook.capacity) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </Panel>
          </div>

          {/* Earnings summary */}
          <div>
            <SectionHeader title="This week's earnings" subtitle="Itemized by delivery mode" />
            <Panel>
              <div className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-ink-muted">
                    <Store size={14} /> Self-pickup
                  </span>
                  <span className="font-medium text-ink">
                    {formatINR(weekEarnings.selfPickup)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-ink-muted">
                    <Bike size={14} /> Self-delivery (meal + delivery fee)
                  </span>
                  <span className="font-medium text-ink">
                    {formatINR(weekEarnings.selfDelivery)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-ink-muted">
                    <Truck size={14} /> Platform delivery
                  </span>
                  <span className="font-medium text-ink">
                    {formatINR(weekEarnings.platformDelivery)}
                  </span>
                </div>
                <div className="border-t border-steel/15 pt-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-ink">Total this week</span>
                    <span className="font-display text-xl font-semibold text-ink">
                      {formatINR(weekEarnings.total)}
                    </span>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-xs text-ink-muted">
                Platform fee ({formatINR(PLATFORM_FEE_PER_MEAL)}/meal) is charged
                to customers separately and never deducted from your earnings.
              </p>
            </Panel>
          </div>

          {/* Weekly menu editor */}
          <div>
            <SectionHeader
              title="Weekly menu"
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => editingMenu ? handleMenuSave() : setEditingMenu(true)}
                >
                  {editingMenu ? (
                    <>
                      <CheckCircle2 size={14} />
                      Save
                    </>
                  ) : (
                    <>
                      <Edit2 size={14} />
                      Edit
                    </>
                  )}
                </Button>
              }
            />
            <Panel padded={false} className="overflow-hidden">
              <div className="divide-y divide-steel/10">
                {cook.weeklyMenu.map((menu, i) => (
                  <div
                    key={menu.day}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <span className="w-10 shrink-0 font-display text-sm font-semibold text-spice">
                      {menu.day}
                    </span>
                    {editingMenu ? (
                      <div className="flex flex-1 items-center gap-2">
                        <input
                          type="text"
                          value={menuDraft[i].dish}
                          onChange={(e) =>
                            setMenuDraft((prev) =>
                              prev.map((m, idx) =>
                                idx === i ? { ...m, dish: e.target.value } : m,
                              ),
                            )
                          }
                          className="flex-1 rounded-md border border-steel/25 bg-white/60 px-2 py-1.5 text-sm text-ink focus:border-marigold focus:bg-white focus:outline-none transition-colors"
                        />
                        <button
                          onClick={() =>
                            setMenuDraft((prev) =>
                              prev.map((m, idx) =>
                                idx === i
                                  ? {
                                    ...m,
                                    vegType:
                                      m.vegType === 'veg' ? 'non-veg' : 'veg',
                                  }
                                  : m,
                              ),
                            )
                          }
                          className={[
                            'flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors',
                            menuDraft[i].vegType === 'veg'
                              ? 'border-leaf bg-leaf-50 text-leaf-dark'
                              : 'border-rust bg-rust-50 text-rust-dark',
                          ].join(' ')}
                        >
                          {menuDraft[i].vegType === 'veg' ? (
                            <Leaf size={12} />
                          ) : (
                            <Drumstick size={12} />
                          )}
                          {menuDraft[i].vegType === 'veg' ? 'Veg' : 'Non-veg'}
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-1 items-center gap-2">
                        <span className="text-sm text-ink">{menu.dish}</span>
                        {menu.vegType === 'veg' ? (
                          <Leaf size={14} className="text-leaf" />
                        ) : (
                          <Drumstick size={14} className="text-rust" />
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
