import { ArrowLeft, History, PackageCheck } from 'lucide-react';
import type { CookProfile, Order, Subscription } from '@/types';
import { Panel } from '@/components/ui/Panel';
import { CustomerDashboard } from './CustomerDashboard';
import { OrderTracking } from './OrderTracking';

interface MyOrdersProps {
  subscription: Subscription | null;
  subscriptionCook: CookProfile | null;
  cooks: CookProfile[];
  orders: Order[];
  onUpdateSubscription: (updates: Partial<Subscription>) => void;
  onRate: (stars: number) => void;
  onCancelSubscription?: () => void;
  loading?: boolean;
  error?: string;
  onBack: () => void;
}

export function MyOrders({ subscription, subscriptionCook, cooks, orders, onUpdateSubscription, onRate, onCancelSubscription, loading = false, error = '', onBack }: MyOrdersProps) {
  const activeSingleOrders = orders.filter((order) => order.orderType === 'single' && ['pending', 'confirmed'].includes(order.status));
  const pastOrders = orders
    .filter((order) => !activeSingleOrders.includes(order) && (order.orderType === 'single' || order.status === 'delivered' || order.status === 'cancelled'))
    .sort((left, right) => (right.deliveryDate || right.date).localeCompare(left.deliveryDate || left.date))
    .slice(0, 20);

  return (
    <main className="mx-auto max-w-5xl px-4 py-7 sm:px-6 animate-fade-in">
      <button onClick={onBack} className="mb-6 flex min-h-11 items-center gap-1.5 text-sm text-ink-muted hover:text-ink"><ArrowLeft size={16} /> Back to cooks</button>
      <div className="mb-7">
        <p className="text-sm text-ink-muted">Your food history</p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-ink">My Orders</h1>
        <p className="mt-1 text-sm text-ink-muted">Pending handovers stay here until they are completed.</p>
      </div>

      {loading && <Panel className="mb-6" padded><p className="text-sm text-ink-muted">Loading your orders...</p></Panel>}
      {error && <Panel className="mb-6 border-rust/20 bg-rust-50" padded><p className="text-sm text-rust-dark">{error}</p></Panel>}

      {subscription && subscriptionCook && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-semibold text-ink"><PackageCheck size={19} className="text-marigold" /> Today's subscription order</h2>
          <CustomerDashboard subscription={subscription} cook={subscriptionCook} onSubscribe={() => undefined} onUpdateSubscription={onUpdateSubscription} onRate={onRate} orders={orders.filter((order) => order.subscriptionId === subscription.id)} />
          {onCancelSubscription && <button onClick={onCancelSubscription} className="mt-3 min-h-11 text-sm text-rust-dark underline underline-offset-2">Cancel subscription and refund remaining held days</button>}
        </section>
      )}

      {activeSingleOrders.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 font-display text-xl font-semibold text-ink">Single-day orders</h2>
          <div className="space-y-4">
            {activeSingleOrders.map((order) => <OrderTracking key={order.id} order={order} cook={cooks.find((cook) => cook.id === order.cookId) ?? null} onBack={() => undefined} />)}
          </div>
        </section>
      )}

      {!subscription && activeSingleOrders.length === 0 && pastOrders.length === 0 && (
        <Panel className="text-center" padded><p className="font-display text-xl font-semibold text-ink">No orders yet</p><p className="mt-2 text-sm text-ink-muted">Your active orders and handover codes will appear here.</p></Panel>
      )}

      {pastOrders.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-semibold text-ink"><History size={19} className="text-steel" /> Past orders</h2>
          <Panel padded>
            <div className="divide-y divide-steel/10">
              {pastOrders.map((order) => (
                <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <div><p className="font-medium text-ink">{order.cookName || cooks.find((cook) => cook.id === order.cookId)?.name || 'Home cook'}</p><p className="text-xs text-ink-muted">{order.deliveryDate || order.date} · {order.mealSlot}</p></div>
                  <span className="capitalize text-ink-muted">{order.status}</span>
                </div>
              ))}
            </div>
          </Panel>
        </section>
      )}
    </main>
  );
}
