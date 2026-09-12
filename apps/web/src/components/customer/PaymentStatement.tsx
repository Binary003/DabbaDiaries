import { useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, CircleDollarSign, Clock3, ReceiptText, RotateCcw, WalletCards } from 'lucide-react';
import { parsePaymentBreakdown } from '@maas/core';
import type { CookProfile, PaymentRecord, RefundRecord, Subscription, TransferRecord } from '@/types';
import { Panel } from '@/components/ui/Panel';
import { formatINR } from '@/utils';

interface PaymentStatementProps {
  payments: PaymentRecord[];
  transfers: TransferRecord[];
  refunds: RefundRecord[];
  onBack: () => void;
  activeSubscription?: Subscription | null;
  activeCook?: CookProfile | null;
  cooks?: CookProfile[];
}

export function PaymentStatement({ payments, transfers, refunds, onBack, activeSubscription = null, activeCook = null, cooks = [] }: PaymentStatementProps) {
  const [historyPage, setHistoryPage] = useState(1);
  const [expandedPayments, setExpandedPayments] = useState<Record<string, boolean>>({});
  const orderedPayments = [...payments].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  const activePlanPayment = orderedPayments.find((payment) => parsePaymentBreakdown(payment.description).kind === 'subscription') ?? null;
  const historyPayments = orderedPayments.filter((payment) => payment.id !== activePlanPayment?.id);
  const historyPageSize = 5;
  const historyPageCount = Math.max(1, Math.ceil(historyPayments.length / historyPageSize));
  const currentHistoryPage = Math.min(historyPage, historyPageCount);
  const billingHistory = historyPayments.slice((currentHistoryPage - 1) * historyPageSize, currentHistoryPage * historyPageSize);

  return <main className="mx-auto max-w-5xl px-4 py-7 sm:px-6 animate-fade-in">
    <button onClick={onBack} className="mb-6 flex min-h-11 items-center gap-1.5 text-sm text-ink-muted hover:text-ink"><ArrowLeft size={16} /> Back to cooks</button>
    <div className="mb-7"><p className="text-sm text-ink-muted">Payment history</p><h1 className="mt-1 font-display text-3xl font-semibold text-ink">Payment statement</h1><p className="mt-1 text-sm text-ink-muted">Payments, cook transfers, and refunds. No spendable wallet balance is held here.</p></div>
    <div className="grid gap-5 lg:grid-cols-[1.1fr_1.4fr]">
      <Panel padded>
        <div className="flex items-center gap-2"><WalletCards size={18} className="text-marigold" /><h2 className="font-display text-xl font-semibold text-ink">Active plan</h2></div>
        {activeSubscription ? (() => {
          const breakdown = parsePaymentBreakdown(activePlanPayment?.description);
          return <div className="mt-4">
            <div className="flex items-start justify-between gap-3"><div><p className="font-display text-2xl font-semibold text-ink">{activeCook?.name || 'Home-cooked meal plan'}</p><p className="mt-1 text-sm capitalize text-ink-muted">{activeSubscription.planType} plan · {activeSubscription.mealSlot}</p></div><span className="rounded-full bg-leaf-50 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-leaf-dark">{activeSubscription.status}</span></div>
            <dl className="mt-4 grid grid-cols-2 gap-3 border-y border-steel/10 py-3 text-sm"><div><dt className="text-xs text-ink-muted">Plan amount</dt><dd className="mt-1 font-medium text-ink">{formatINR(activeSubscription.totalPaid)}</dd></div><div><dt className="text-xs text-ink-muted">Next renewal</dt><dd className="mt-1 font-medium text-ink">{new Date(activeSubscription.endDate).toLocaleDateString()}</dd></div></dl>
            {activePlanPayment && <>
            <div className="mt-3 flex items-center justify-between gap-3 text-sm"><span className="text-ink-muted">Original payment</span><span className="font-medium text-ink">{formatINR(activePlanPayment.amount)}</span></div>
            <div className="mt-3 space-y-1 text-xs text-ink-muted">
              {breakdown.items.map((item) => <div key={`${activePlanPayment.id}-${item.label}`} className="flex items-center justify-between gap-3"><span>{item.label}</span><span>{formatINR(item.amount)}</span></div>)}
              {breakdown.items.length > 0 && <div className="mt-1 border-t border-steel/10 pt-1"><div className="flex items-center justify-between gap-3 font-medium text-ink"><span>Total</span><span>{formatINR(breakdown.total)}</span></div></div>}
            </div>
            <p className="mt-2 text-[11px] text-ink-muted">Started {new Date(activeSubscription.startDate).toLocaleDateString()}</p></>}
          </div>;
        })() : <p className="mt-4 text-sm text-ink-muted">No active plan. Subscribe to a cook to see your plan details here.</p>}
      </Panel>
      <Panel padded>
        <div className="flex items-center gap-2"><ReceiptText size={18} className="text-steel" /><h2 className="font-display text-xl font-semibold text-ink">Billing history</h2></div>
        <div className="mt-3 divide-y divide-steel/10">{billingHistory.length === 0 ? <p className="py-4 text-sm text-ink-muted">No past charges yet.</p> : billingHistory.map((payment) => {
          const breakdown = parsePaymentBreakdown(payment.description);
          const expanded = Boolean(expandedPayments[payment.id]);
          const transactionLabel = breakdown.kind === 'subscription'
            ? `${breakdown.planDays ? `${breakdown.planDays}-day ` : ''}Subscription`
            : breakdown.kind === 'single_order' ? 'Single-day order' : 'Payment';
          const transferCookId = transfers.find((transfer) => transfer.paymentId === payment.id)?.cookId;
          const cookName = breakdown.cookName || cooks.find((cook) => cook.id === transferCookId)?.name;
          return <div key={payment.id} className="py-3">
            <button type="button" onClick={() => setExpandedPayments((current) => ({ ...current, [payment.id]: !expanded }))} className="flex min-h-11 w-full items-center justify-between gap-3 text-left"><span><span className="block font-medium text-ink">{transactionLabel}</span><span className="mt-0.5 block text-xs text-ink-muted">{cookName || 'Cook details unavailable'} · {new Date(payment.createdAt).toLocaleDateString()}</span></span><span className="text-right"><span className="block font-medium text-ink">{formatINR(payment.amount)}</span><span className="mt-0.5 block text-[11px] capitalize text-ink-muted">{expanded ? 'Hide details' : payment.status}</span></span></button>
            {expanded && <div className="mt-2 space-y-1 text-xs text-ink-muted">
              {breakdown.items.map((item) => <div key={`${payment.id}-${item.label}`} className="flex items-center justify-between gap-3"><span>{item.label}</span><span>{formatINR(item.amount)}</span></div>)}
              {breakdown.items.length > 0 && <div className="mt-1 border-t border-steel/10 pt-1"><div className="flex items-center justify-between gap-3 font-medium text-ink"><span>Total</span><span>{formatINR(breakdown.total)}</span></div></div>}
            </div>}
          </div>;
        })}</div>
        {historyPayments.length > historyPageSize && <div className="mt-4 flex items-center justify-between border-t border-steel/10 pt-3"><button type="button" onClick={() => setHistoryPage((page) => Math.max(1, page - 1))} disabled={currentHistoryPage === 1} aria-label="Previous billing history page" className="flex min-h-11 items-center gap-1 rounded-md px-2 text-sm font-medium text-spice transition-colors hover:bg-paper-100 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={16} /> Previous</button><span className="text-xs text-ink-muted">Page {currentHistoryPage} of {historyPageCount}</span><button type="button" onClick={() => setHistoryPage((page) => Math.min(historyPageCount, page + 1))} disabled={currentHistoryPage === historyPageCount} aria-label="Next billing history page" className="flex min-h-11 items-center gap-1 rounded-md px-2 text-sm font-medium text-spice transition-colors hover:bg-paper-100 disabled:cursor-not-allowed disabled:opacity-40">Next <ChevronRight size={16} /></button></div>}
      </Panel>
    </div>
    <div className="mt-5 grid gap-5 lg:grid-cols-2">
      <Panel padded><div className="flex items-center gap-2"><CircleDollarSign size={18} className="text-leaf" /><h2 className="font-display text-xl font-semibold text-ink">Cook transfers</h2></div><div className="mt-3 divide-y divide-steel/10">{transfers.length === 0 ? <p className="py-4 text-sm text-ink-muted">Transfers will appear after checkout.</p> : transfers.map((transfer) => <div key={transfer.id} className="flex items-center justify-between gap-3 py-3"><div><p className="font-medium text-ink">{formatINR(transfer.amount)}</p><p className="text-xs text-ink-muted">{transfer.status === 'released' ? 'Released to cook' : `Held until ${transfer.holdUntil ? new Date(transfer.holdUntil).toLocaleDateString() : 'handover'}`}</p></div><span className={transfer.status === 'released' ? 'text-xs font-medium text-leaf-dark' : 'flex items-center gap-1 text-xs text-marigold-dark'}>{transfer.status === 'released' ? 'Released' : <><Clock3 size={13} /> On hold</>}</span></div>)}</div></Panel>
      <Panel padded><div className="flex items-center gap-2"><RotateCcw size={18} className="text-steel" /><h2 className="font-display text-xl font-semibold text-ink">Refunds</h2></div>{refunds.length === 0 ? <p className="mt-3 text-sm text-ink-muted">No refunds recorded.</p> : refunds.map((refund) => <div key={refund.id} className="flex justify-between gap-3 border-b border-steel/10 py-3 text-sm"><span>{refund.reason}</span><strong>{formatINR(refund.amount)}</strong></div>)}</Panel>
    </div>
  </main>;
}
