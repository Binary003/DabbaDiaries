import { CircleDollarSign } from 'lucide-react';
import type { TransferRecord } from '@/types';
import { Panel } from '@/components/ui/Panel';
import { formatINR } from '@/utils';

export function CookEarnings({ transfers }: { transfers: TransferRecord[] }) {
  const held = transfers.filter((transfer) => transfer.status === 'on_hold');
  const released = transfers.filter((transfer) => transfer.status === 'released');
  return <Panel className="mx-auto mt-5 max-w-5xl" padded><div className="flex items-center gap-2"><CircleDollarSign size={18} className="text-leaf" /><h2 className="font-display text-xl font-semibold text-ink">Cook earnings</h2></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-md border border-marigold/20 bg-marigold-50 p-3"><p className="text-xs uppercase tracking-[0.1em] text-marigold-dark">Held</p><p className="mt-1 font-display text-2xl font-semibold text-ink">{formatINR(held.reduce((sum, transfer) => sum + transfer.amount, 0))}</p><p className="text-xs text-ink-muted">{held.length} transfer(s), released after handover</p></div><div className="rounded-md border border-leaf/20 bg-leaf-50 p-3"><p className="text-xs uppercase tracking-[0.1em] text-leaf-dark">Released</p><p className="mt-1 font-display text-2xl font-semibold text-ink">{formatINR(released.reduce((sum, transfer) => sum + transfer.amount, 0))}</p><p className="text-xs text-ink-muted">{released.length} delivered transfer(s)</p></div></div></Panel>;
}
