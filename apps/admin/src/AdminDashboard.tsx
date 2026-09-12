import { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Check,
  X,
  Truck,
  MapPin,
  Users,
  DollarSign,
  ClipboardList,
  AlertCircle,
} from 'lucide-react';
import {
  type CookProfile,
  type DeliveryZone,
  type Order,
} from '@maas/core';
import { validateCapacity } from '@maas/core';
import { Button, Badge, Panel, SectionHeader, EmptyState, Modal, Input } from '@maas/ui';
import { formatINR, getFullDayName } from './utils';

export interface AdminOperationsSummary {
  summary: {
    total_orders: number;
    pending_orders: number;
    confirmed_orders: number;
    delivered_orders: number;
    cancelled_orders: number;
    platform_revenue: number;
    cook_payouts: number;
  };
  cooks: Array<{ cook_id: string; cook_name: string; order_count: number; delivered_count: number; open_count: number; meal_value: number }>;
}

const emptySummary: AdminOperationsSummary = {
  summary: { total_orders: 0, pending_orders: 0, confirmed_orders: 0, delivered_orders: 0, cancelled_orders: 0, platform_revenue: 0, cook_payouts: 0 },
  cooks: [],
};

interface AdminDashboardProps {
  cooks: CookProfile[];
  zones: DeliveryZone[];
  orders: Order[];
  onUpdateCook: (cookId: string, updates: Partial<CookProfile>) => void;
  onUpdateZone: (zoneId: string, updates: Partial<DeliveryZone>) => void;
  operationsSummary?: AdminOperationsSummary;
}

type Tab = 'verification' | 'zones' | 'orders' | 'payouts';

export function AdminDashboard({
  cooks,
  zones,
  orders,
  onUpdateCook,
  onUpdateZone,
  operationsSummary = emptySummary,
}: AdminDashboardProps) {
  const [tab, setTab] = useState<Tab>('verification');
  const [rejectCook, setRejectCook] = useState<CookProfile | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [assigningZone, setAssigningZone] = useState<DeliveryZone | null>(null);
  const [partnerName, setPartnerName] = useState('');
  const [partnerFee, setPartnerFee] = useState(30);
  const [payoutTriggered, setPayoutTriggered] = useState(false);

  const pendingCooks = cooks.filter((c) => c.verificationStatus === 'pending');
  const approvedCooks = cooks.filter((c) => c.verificationStatus === 'approved');
  const metrics = operationsSummary.summary;

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'verification', label: 'Verification', count: pendingCooks.length },
    { id: 'zones', label: 'Zones' },
    { id: 'orders', label: 'Order sheet' },
    { id: 'payouts', label: 'Payouts' },
  ];

  const handleApprove = (cookId: string) => {
    const cook = cooks.find((item) => item.id === cookId);
    if (!cook || !validateCapacity(cook.capacity).valid) return;
    onUpdateCook(cookId, { verificationStatus: 'approved', rejectionReason: undefined });
  };

  const handleReject = () => {
    if (rejectCook && rejectReason.trim()) {
      onUpdateCook(rejectCook.id, {
        verificationStatus: 'rejected',
        rejectionReason: rejectReason,
      });
      setRejectCook(null);
      setRejectReason('');
    }
  };

  const handleAssignPartner = () => {
    if (assigningZone && partnerName.trim()) {
      onUpdateZone(assigningZone.id, {
        hasPlatformDelivery: true,
        assignedPartnerId: partnerName.trim().toLowerCase().replace(/\s+/g, '-'),
        deliveryPartner: partnerName,
        deliveryFee: partnerFee,
      });
      setAssigningZone(null);
      setPartnerName('');
      setPartnerFee(30);
    }
  };

  const handleToggleZone = (zone: DeliveryZone) => {
    onUpdateZone(zone.id, {
      hasPlatformDelivery: !zone.hasPlatformDelivery,
      deliveryPartner: !zone.hasPlatformDelivery ? zone.deliveryPartner : undefined,
    });
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 animate-fade-in">
      <div className="mb-6">
        <p className="text-sm text-ink-muted">{getFullDayName()}, admin</p>
        <h1 className="font-display text-2xl font-semibold text-ink">
          Admin dashboard
        </h1>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          ['Orders', metrics.total_orders],
          ['Open orders', metrics.pending_orders + metrics.confirmed_orders],
          ['Delivered', metrics.delivered_orders],
          ['Platform revenue', formatINR(metrics.platform_revenue)],
          ['Cook payouts', formatINR(metrics.cook_payouts)],
        ].map(([label, value]) => (
          <Panel key={String(label)} padded className="p-4">
            <p className="text-xs text-ink-muted">{label}</p>
            <p className="mt-1 font-display text-2xl font-semibold text-ink">{value}</p>
          </Panel>
        ))}
      </div>

      {operationsSummary.cooks.length > 0 && (
        <Panel className="mb-6" padded>
          <SectionHeader title="Orders by cook" subtitle="Counts stay compact; the order sheet shows recent details." />
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {operationsSummary.cooks.map((cook) => (
              <div key={cook.cook_id} className="rounded-md border border-steel/10 bg-paper-50 px-3 py-2.5">
                <p className="text-sm font-medium text-ink">{cook.cook_name}</p>
                <p className="mt-1 text-xs text-ink-muted">{cook.order_count} orders · {cook.open_count} open · {cook.delivered_count} delivered</p>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Tab bar */}
      <div className="mb-6 overflow-x-auto scrollbar-thin">
        <div className="flex min-w-max gap-1 border-b border-steel/15">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={[
                'relative px-4 py-2.5 text-sm font-medium transition-colors',
                tab === t.id
                  ? 'text-spice'
                  : 'text-ink-muted hover:text-ink',
              ].join(' ')}
            >
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rust px-1 text-[10px] font-semibold text-white">
                  {t.count}
                </span>
              )}
              {tab === t.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-spice" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Verification tab */}
      {tab === 'verification' && (
        <div className="animate-fade-in">
          {pendingCooks.length === 0 ? (
            <EmptyState
              icon={<ShieldCheck size={28} strokeWidth={1.5} />}
              title="No cooks pending verification"
              description="All submitted kitchen profiles have been reviewed. New cooks will appear here for FSSAI and kitchen photo approval."
            />
          ) : (
            <div className="space-y-4">
              {pendingCooks.map((cook) => (
                <Panel key={cook.id}>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md border border-steel/15">
                      <img
                        src={cook.kitchenPhoto}
                        alt={cook.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-display text-lg font-medium text-ink">
                          {cook.name}
                        </h3>
                        <Badge tone="marigold">
                          <ShieldAlert size={10} /> Pending
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-sm text-ink-muted">{cook.tagline}</p>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-ink-muted">
                        <span className="flex items-center gap-1">
                          <ShieldCheck size={12} />
                          {cook.fssaiNumber}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin size={12} />
                          {cook.pincodes.join(', ')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users size={12} />
                          {cook.capacity} meals/day
                        </span>
                      </div>
                      {cook.verificationStatus === 'rejected' && cook.rejectionReason && (
                        <div className="mt-3 rounded-md border border-rust/20 bg-rust-50 p-2.5">
                          <p className="flex items-start gap-1.5 text-xs text-rust-dark">
                            <AlertCircle size={14} className="mt-0.5 shrink-0" />
                            {cook.rejectionReason}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRejectCook(cook)}
                      >
                        <X size={14} />
                        Reject
                      </Button>
                      <Button size="sm" onClick={() => handleApprove(cook.id)}>
                        <Check size={14} />
                        Approve cook
                      </Button>
                    </div>
                  </div>
                </Panel>
              ))}
            </div>
          )}

          {/* Approved cooks */}
          {approvedCooks.length > 0 && (
            <div className="mt-8">
              <SectionHeader
                title="Approved cooks"
                subtitle={`${approvedCooks.length} kitchens live`}
              />
              <div className="space-y-2">
                {approvedCooks.map((cook) => (
                  <div
                    key={cook.id}
                    className="flex items-center justify-between rounded-md border border-leaf/15 bg-leaf-50/30 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-ink">{cook.name}</p>
                      <p className="text-xs text-ink-muted">
                        {cook.pincodes.join(', ')} · {cook.activeSubscribers} subscribers
                      </p>
                    </div>
                    <Badge tone="leaf">
                      <ShieldCheck size={10} /> Approved
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Zones tab */}
      {tab === 'zones' && (
        <div className="animate-fade-in">
          <div className="space-y-4">
            {zones.map((zone) => (
              <Panel key={zone.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-lg font-medium text-ink">
                        {zone.name}
                      </h3>
                      {zone.hasPlatformDelivery ? (
                        <Badge tone="leaf">
                          <Truck size={10} /> Delivery active
                        </Badge>
                      ) : (
                        <Badge tone="steel">No delivery</Badge>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-ink-muted">
                      <span className="flex items-center gap-1">
                        <MapPin size={12} />
                        {zone.pincode}
                      </span>
                      {zone.deliveryPartner && (
                        <span>Partner: {zone.deliveryPartner}</span>
                      )}
                      {zone.hasPlatformDelivery && zone.deliveryFee > 0 && (
                        <span>Fee: {formatINR(zone.deliveryFee)}/meal</span>
                      )}
                      <span>{zone.activeOrders} active orders</span>
                    </div>
                    {zone.hasPlatformDelivery && zone.deliveryWindow && (
                      <p className="mt-1.5 text-xs text-ink-muted">
                        {zone.deliveryWindow}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAssigningZone(zone)}
                    >
                      {zone.hasPlatformDelivery ? 'Change partner' : 'Assign partner'}
                    </Button>
                    <Button
                      variant={zone.hasPlatformDelivery ? 'danger' : 'secondary'}
                      size="sm"
                      onClick={() => handleToggleZone(zone)}
                    >
                      {zone.hasPlatformDelivery ? 'Disable' : 'Enable'}
                    </Button>
                  </div>
                </div>
              </Panel>
            ))}
          </div>

          {/* Assign partner modal */}
          <Modal
            open={!!assigningZone}
            onClose={() => setAssigningZone(null)}
            title="Assign delivery partner"
            size="sm"
          >
            <div className="space-y-4">
              <p className="text-sm text-ink-muted">
                Assigning a delivery partner to{' '}
                <strong className="text-ink">{assigningZone?.name}</strong> enables
                platform zone delivery for customers in this area.
              </p>
              <Input
                label="Delivery partner name"
                name="partner"
                placeholder="e.g. Ravi Delivery"
                value={partnerName}
                onChange={(e) => setPartnerName(e.target.value)}
              />
              <Input
                label="Delivery fee per meal"
                name="fee"
                type="number"
                prefix="₹"
                value={partnerFee}
                onChange={(e) => setPartnerFee(Number(e.target.value))}
              />
              <div className="flex gap-3">
                <Button variant="outline" fullWidth onClick={() => setAssigningZone(null)}>
                  Cancel
                </Button>
                <Button fullWidth onClick={handleAssignPartner} disabled={!partnerName.trim()}>
                  Assign partner
                </Button>
              </div>
            </div>
          </Modal>
        </div>
      )}

      {/* Orders tab */}
      {tab === 'orders' && (
        <div className="animate-fade-in">
          <SectionHeader
            title="Recent order sheet"
            subtitle="Showing the latest 25 orders, grouped by zone"
          />
          {(() => {
            const zonesWithOrders = zones.filter((z) =>
              orders.some((o) => o.zoneId === z.id),
            );
            const unzonedOrders = orders.filter((o) => !o.zoneId);

            if (zonesWithOrders.length === 0 && unzonedOrders.length === 0) {
              return (
                <EmptyState
                  icon={<ClipboardList size={28} strokeWidth={1.5} />}
                  title="No orders today"
                  description="Orders will appear here grouped by delivery zone once customers start subscribing."
                />
              );
            }

            return (
              <div className="space-y-6">
                {zonesWithOrders.map((zone) => {
                  const zoneOrders = orders.filter(
                    (o) => o.zoneId === zone.id,
                  );
                  return (
                    <div key={zone.id}>
                      <div className="mb-2 flex items-center gap-2">
                        <Truck size={16} className="text-spice" />
                        <h3 className="font-display text-base font-semibold text-ink">
                          {zone.name}
                        </h3>
                        <Badge tone="steel">
                          {zoneOrders.length} orders
                        </Badge>
                      </div>
                      <Panel padded={false} className="overflow-hidden">
                        <div className="divide-y divide-steel/10">
                          {zoneOrders.map((order) => (
                            <div
                              key={order.id}
                              className="flex items-center justify-between px-4 py-3"
                            >
                              <div>
                                <p className="text-sm font-medium text-ink">
                                  {order.customerName}
                                </p>
                                <p className="text-xs text-ink-muted">
                                  {order.address} · {order.mealSlot}
                                </p>
                                {order.deliveryMode === 'platform-delivery' && (
                                  <p className="mt-1 text-xs text-spice">
                                    {order.customerPhone || 'Phone not provided'} · {order.customerLocality || order.address || 'Locality not provided'}
                                  </p>
                                )}
                              </div>
                              <Badge
                                tone={
                                  order.status === 'confirmed' ? 'leaf' : 'marigold'
                                }
                              >
                                {order.status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </Panel>
                    </div>
                  );
                })}
                {unzonedOrders.length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <Users size={16} className="text-spice" />
                      <h3 className="font-display text-base font-semibold text-ink">
                        Self-pickup & cook delivery
                      </h3>
                      <Badge tone="steel">{unzonedOrders.length} orders</Badge>
                    </div>
                    <Panel padded={false} className="overflow-hidden">
                      <div className="divide-y divide-steel/10">
                        {unzonedOrders.map((order) => (
                          <div
                            key={order.id}
                            className="flex items-center justify-between px-4 py-3"
                          >
                            <div>
                              <p className="text-sm font-medium text-ink">
                                {order.customerName}
                              </p>
                              <p className="text-xs text-ink-muted">
                                {order.deliveryMode.replace(/-/g, ' ')} · {order.mealSlot}
                              </p>
                            </div>
                            <Badge
                              tone={
                                order.status === 'confirmed' ? 'leaf' : 'marigold'
                              }
                            >
                              {order.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </Panel>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Payouts tab */}
      {tab === 'payouts' && (
        <div className="animate-fade-in">
          <SectionHeader
            title="Payout batch"
            subtitle="Review and trigger weekly payouts to cooks"
          />
          <Panel>
            {payoutTriggered ? (
              <div className="text-center py-4">
                <div className="mb-3 flex justify-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-leaf-50">
                    <Check size={24} className="text-leaf" strokeWidth={2} />
                  </div>
                </div>
                <h3 className="font-display text-lg font-medium text-ink">
                  Payout batch triggered
                </h3>
                <p className="mt-1 text-sm text-ink-muted">
                  All approved cooks have been paid for this week. This is a
                  prototype — no real money was transferred.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setPayoutTriggered(false)}
                >
                  Reset
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {approvedCooks.map((cook) => {
                    const earnings = 350 + cook.activeSubscribers * 70;
                    return (
                      <div
                        key={cook.id}
                        className="flex items-center justify-between border-b border-steel/10 pb-3 last:border-0 last:pb-0"
                      >
                        <div>
                          <p className="text-sm font-medium text-ink">
                            {cook.name}
                          </p>
                          <p className="text-xs text-ink-muted">
                            {cook.activeSubscribers} subscribers · {cook.capacity} capacity
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-display text-lg font-semibold text-ink">
                            {formatINR(earnings)}
                          </p>
                          <p className="text-xs text-ink-muted">this week</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 border-t border-steel/15 pt-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="font-medium text-ink">Total batch</span>
                    <span className="font-display text-xl font-semibold text-ink">
                      {formatINR(
                        approvedCooks.reduce(
                          (sum, c) => sum + 350 + c.activeSubscribers * 70,
                          0,
                        ),
                      )}
                    </span>
                  </div>
                  <Button fullWidth onClick={() => setPayoutTriggered(true)}>
                    <DollarSign size={16} />
                    Trigger payout batch
                  </Button>
                  <p className="mt-2 text-center text-xs text-ink-muted">
                    Mock — no real payment will be made.
                  </p>
                </div>
              </>
            )}
          </Panel>
        </div>
      )}

      {/* Reject modal */}
      <Modal
        open={!!rejectCook}
        onClose={() => setRejectCook(null)}
        title="Reject cook"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">
            Provide a reason for rejecting <strong className="text-ink">{rejectCook?.name}</strong>'s
            kitchen profile. They'll see this message and can reapply after fixing the issue.
          </p>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">
              Reason
            </label>
            <textarea
              className="w-full rounded-md border border-steel/25 bg-white/60 px-3 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-marigold focus:bg-white focus:outline-none transition-colors"
              rows={3}
              placeholder="e.g. Kitchen photo is unclear — please upload a photo showing your cooking area clearly."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" fullWidth onClick={() => setRejectCook(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              fullWidth
              onClick={handleReject}
              disabled={!rejectReason.trim()}
            >
              Reject cook
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
