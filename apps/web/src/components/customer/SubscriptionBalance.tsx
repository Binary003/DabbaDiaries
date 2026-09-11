import { ReceiptText, ShieldCheck, WalletCards } from 'lucide-react';
import type { Subscription } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Panel } from '@/components/ui/Panel';
import { formatINR } from '@/utils';

interface SubscriptionBalanceProps {
  subscription: Subscription;
}

export function SubscriptionBalance({ subscription }: SubscriptionBalanceProps) {
  const completedDays = Math.min(subscription.daysCompleted, subscription.daysTotal);
  const usedValue = Math.round((subscription.totalPaid * completedDays) / subscription.daysTotal);
  const remainingValue = Math.max(0, subscription.totalPaid - usedValue);
  const progress = Math.round((completedDays / subscription.daysTotal) * 100);
  const dailyValue = Math.round(subscription.totalPaid / subscription.daysTotal);

  return (
    <Panel className="overflow-hidden border-spice/15 bg-spice text-paper">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-paper/70">
            <WalletCards size={16} />
            <span className="text-xs font-medium uppercase tracking-[0.12em]">Subscription balance</span>
          </div>
          <p className="font-display text-3xl font-semibold tracking-tight">
            {formatINR(remainingValue)}
          </p>
          <p className="mt-1 text-sm text-paper/70">Estimated value remaining in this plan</p>
        </div>
        <Badge tone="leaf">Active plan</Badge>
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between text-xs text-paper/70">
          <span>{completedDays} of {subscription.daysTotal} meals used</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-paper/20">
          <div className="h-full rounded-full bg-marigold transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 border-t border-paper/15 pt-4 sm:grid-cols-3">
        <div>
          <p className="text-xs text-paper/60">Plan committed</p>
          <p className="mt-1 font-medium">{formatINR(subscription.totalPaid)}</p>
        </div>
        <div>
          <p className="text-xs text-paper/60">Used so far</p>
          <p className="mt-1 font-medium">{formatINR(usedValue)}</p>
        </div>
        <div>
          <p className="text-xs text-paper/60">Daily value</p>
          <p className="mt-1 font-medium">{formatINR(dailyValue)}</p>
        </div>
      </div>

      <div className="mt-4 rounded-md bg-paper/10 px-3 py-2.5 text-xs text-paper/75">
        <div className="flex items-start gap-2">
          <ReceiptText size={14} className="mt-0.5 shrink-0 text-marigold" />
          <span>
            Includes the meal plan, platform service fee, and selected delivery charges. Final deductions will be tied to delivered orders when payments are connected.
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-paper/55">
        <ShieldCheck size={12} />
        Prototype ledger only. No wallet withdrawal or refund is active yet.
      </div>
    </Panel>
  );
}
