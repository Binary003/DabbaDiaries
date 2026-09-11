import { ArrowLeft, CheckCircle2, ChevronRight, CircleDollarSign, Clock3, ReceiptText, WalletCards } from 'lucide-react';
import type { CookProfile, Order, Subscription, Wallet, WalletTransaction } from '@/types';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { Badge } from '@/components/ui/Badge';
import { formatINR } from '@/utils';

interface SubscriptionWalletProps {
  subscription: Subscription | null;
  cook: CookProfile | null;
  onBackToCooks: () => void;
  onViewCook: () => void;
  orders?: Order[];
  wallet?: Wallet | null;
  transactions?: WalletTransaction[];
  onTopUp?: () => void;
  message?: string;
  onTrySingle?: () => void;
}

export function SubscriptionWallet({ subscription, cook, onBackToCooks, onViewCook, orders = [], wallet, transactions = [], onTopUp, message, onTrySingle }: SubscriptionWalletProps) {
  const relativeTime = (createdAt: string) => {
    const minutes = Math.max(1, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
    if (minutes < 60) return `${minutes} min ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)} hours ago`;
    if (minutes < 2880) return 'Yesterday';
    return `${Math.floor(minutes / 1440)} days ago`;
  };
  const singleTransactions = transactions.filter((item) => item.type === 'single_order_debit');
  const singleTotal = singleTransactions.reduce((sum, item) => sum + item.amount, 0);
  if (!subscription || !cook) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <button onClick={onBackToCooks} className="mb-6 flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
          <ArrowLeft size={16} /> Back to cooks
        </button>
        <Panel className="mx-auto max-w-2xl text-center" padded>
          <div className="mb-5 flex items-center justify-between rounded-lg border border-marigold/20 bg-marigold-50 p-4 text-left"><div><p className="text-xs uppercase tracking-[0.1em] text-marigold-dark">Wallet balance</p><p className="mt-1 font-display text-2xl font-semibold text-ink">{formatINR(wallet?.balance ?? 0)}</p></div>{onTopUp && <Button size="sm" onClick={onTopUp}>Add money</Button>}</div>
          <WalletCards size={34} className="mx-auto mb-3 text-steel" strokeWidth={1.5} />
          <h1 className="font-display text-2xl font-semibold text-ink">No active subscription</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">Choose a home cook to start a plan and your subscription balance will appear here.</p>
          <p className="mt-2 text-xs text-ink-muted">Subscribe to a weekly or monthly plan to track your balance here.</p><Button className="mt-5" onClick={onBackToCooks}>Find cooks</Button>
          {message && <div className="mt-4 rounded-md bg-marigold-50 p-3 text-left text-sm text-marigold-dark"><p>{message}</p>{onTrySingle && <Button size="sm" className="mt-3" onClick={onTrySingle}>Try today's tiffin instead</Button>}</div>}
          {transactions.length > 0 && <div className="mt-8 border-t border-steel/10 pt-5 text-left"><h2 className="font-display text-lg font-semibold text-ink">Recent activity</h2>{transactions.slice(0, 15).map((item) => <div key={item.id} className="flex justify-between border-b border-steel/10 py-3 text-sm"><span className="capitalize text-ink">{item.type.replace(/_/g, ' ')}</span><span className="font-semibold text-ink">{item.type === 'topup' ? '+' : item.type === 'meal_release' ? '' : '-'}{formatINR(item.amount)}</span></div>)}</div>}
        </Panel>
      </div>
    );
  }

  const deliveredOrders = orders.filter((order) => order.status === 'delivered' || Boolean(order.handoverConfirmedAt));
  const usedMeals = deliveredOrders.length;
  const perMealValue = subscription.totalPaid / subscription.daysTotal;
  const usedValue = Math.round(usedMeals * perMealValue);
  const remainingValue = Math.max(0, subscription.totalPaid - usedValue);
  const remainingMeals = Math.max(0, subscription.daysTotal - usedMeals);
  const progress = Math.min(100, Math.round((usedMeals / subscription.daysTotal) * 100));

  return (
    <div className="mx-auto max-w-5xl px-4 py-7 sm:px-6 animate-fade-in">
      <button onClick={onBackToCooks} className="mb-6 flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft size={16} /> Back to cooks
      </button>

      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-muted">Your plan ledger</p>
          <h1 className="mt-1 font-display text-3xl font-semibold text-ink">Subscription balance</h1>
          <p className="mt-1 text-sm text-ink-muted">Track what your active plan covers, meal by meal.</p>
        </div>
        <Badge tone="leaf"><CheckCircle2 size={12} /> Active subscription</Badge>
      </div>

      <Panel className="mb-5 border-marigold/20 bg-marigold-50" padded><div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-[0.12em] text-marigold-dark">Wallet balance</p><p className="mt-1 font-display text-3xl font-semibold text-ink">{formatINR(wallet?.balance ?? 0)}</p></div><div className="flex items-center gap-3"><WalletCards className="text-marigold-dark" />{onTopUp && <Button size="sm" variant="outline" onClick={onTopUp}>Add money</Button>}</div></div>{message && <div className="mt-3 rounded-md bg-white/60 p-3 text-sm text-marigold-dark"><p>{message}</p>{onTrySingle && <Button size="sm" className="mt-3" onClick={onTrySingle}>Try today's tiffin instead</Button>}</div>}</Panel>

      <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
        <Panel className="overflow-hidden bg-spice text-paper" padded>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-paper/70"><WalletCards size={17} /><span className="text-xs font-medium uppercase tracking-[0.12em]">Remaining plan value</span></div>
              <p className="mt-4 font-display text-5xl font-semibold tracking-tight">{formatINR(remainingValue)}</p>
              <p className="mt-2 text-sm text-paper/70">Estimated from your active subscription. This is not a withdrawable wallet balance.</p>
            </div>
            <CircleDollarSign size={34} className="text-marigold" strokeWidth={1.5} />
          </div>
          <div className="mt-8">
            <div className="mb-2 flex justify-between text-xs text-paper/70"><span>{usedMeals} meals used</span><span>{remainingMeals} remaining</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-paper/20"><div className="h-full rounded-full bg-marigold transition-all" style={{ width: `${progress}%` }} /></div>
          </div>
          <div className="mt-7 grid grid-cols-2 gap-4 border-t border-paper/15 pt-4 sm:grid-cols-3">
            <div><p className="text-xs text-paper/60">Subscribed amount</p><p className="mt-1 font-medium">{formatINR(subscription.totalPaid)}</p></div>
            <div><p className="text-xs text-paper/60">Used value</p><p className="mt-1 font-medium">{formatINR(usedValue)}</p></div>
            <div><p className="text-xs text-paper/60">Plan</p><p className="mt-1 font-medium capitalize">{subscription.planType}</p></div>
          </div>
        </Panel>

        <Panel padded>
          <div className="flex items-center gap-2 text-ink"><Clock3 size={17} className="text-marigold" /><h2 className="font-display text-lg font-semibold">Active cook</h2></div>
          <div className="mt-4 flex items-center gap-3">
            <img src={cook.kitchenPhoto} alt="" className="h-14 w-14 rounded-md object-cover" />
            <div className="min-w-0"><p className="truncate font-medium text-ink">{cook.name}</p><p className="truncate text-sm text-ink-muted">{cook.tagline}</p></div>
          </div>
          <div className="mt-4 rounded-md border border-leaf/20 bg-leaf-50 p-3"><div className="flex items-center gap-2 text-sm font-medium text-leaf-dark"><CheckCircle2 size={15} /> Plan is active</div><p className="mt-1 text-xs text-leaf-dark/75">{subscription.mealSlot} · {subscription.deliveryMode.replace(/-/g, ' ')}</p></div>
          <Button variant="outline" fullWidth className="mt-4" onClick={onViewCook}>View cook profile <ChevronRight size={15} /></Button>
        </Panel>
      </div>

      <Panel className="mt-5" padded>
        <div className="flex items-start gap-3"><ReceiptText size={18} className="mt-0.5 text-marigold" /><div><h2 className="font-medium text-ink">How your balance works</h2><p className="mt-1 text-sm leading-6 text-ink-muted">The subscribed amount is allocated across the meals in your plan. Delivered meals reduce the estimated remaining value; skipped meals remain available for later plan rules. Razorpay deductions and refunds will be connected when payments are integrated.</p></div></div>
      </Panel>
      {singleTransactions.length > 0 && <p className="mt-4 text-sm text-ink-muted">Single orders this month: <strong className="text-ink">{formatINR(singleTotal)}</strong> across {singleTransactions.length} orders.</p>}
      <Panel className="mt-5" padded><h2 className="font-display text-lg font-semibold text-ink">Recent activity</h2><div className="mt-3 divide-y divide-steel/10">{transactions.slice(0, 15).map((item) => <div key={item.id} className="flex items-center justify-between py-3 text-sm"><div><p className="font-medium capitalize text-ink">{item.type.replace(/_/g, ' ')}</p><p className="text-xs text-ink-muted">{item.description} · {relativeTime(item.createdAt)}</p></div><span className={item.type === 'topup' ? 'font-semibold text-leaf' : 'font-semibold text-ink'}>{item.type === 'topup' ? '+' : item.type === 'meal_release' ? '' : '-'}{formatINR(item.amount)}</span></div>)}</div></Panel>
    </div>
  );
}
