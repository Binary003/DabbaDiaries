import { FormEvent, useState } from 'react';
import { Coins, ShieldCheck } from 'lucide-react';
import { Button, Input, Panel } from '@maas/ui';
import { supabase } from '../../lib/supabase';

export function WalletTopUpScreen({ onComplete }: { onComplete: () => void }) {
    const [amount, setAmount] = useState(1000);
    const [custom, setCustom] = useState('');
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    const selectedAmount = custom ? Number(custom) : amount;

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (!supabase || !Number.isFinite(selectedAmount) || selectedAmount < 1) return setMessage('Enter an amount greater than ₹0.');
        setBusy(true);
        const { data: userData } = await supabase.auth.getUser();
        const { error } = userData.user
            ? await supabase.rpc('top_up_wallet', { customer: userData.user.id, topup_amount: selectedAmount })
            : { error: new Error('Your session has expired. Please sign in again.') };
        setBusy(false);
        if (error) return setMessage(error.message);
        onComplete();
    };

    return (
        <main className="flex min-h-screen items-center justify-center px-4 py-10">
            <Panel className="w-full max-w-lg" padded>
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-marigold-50 text-marigold-dark"><Coins size={24} /></div>
                <p className="text-sm font-medium text-marigold-dark">Welcome to DabbaDiaries</p>
                <h1 className="mt-1 font-display text-3xl font-semibold text-ink">Add money to get started</h1>
                <p className="mt-2 text-sm leading-6 text-ink-muted">Use your in-app balance to subscribe to a cook or try a single tiffin. This prototype records the wallet entry without charging a card.</p>
                <form onSubmit={submit} className="mt-6 space-y-4">
                    <div className="grid grid-cols-3 gap-2">
                        {[1000, 1500, 2000].map((value) => <button key={value} type="button" onClick={() => { setAmount(value); setCustom(''); }} className={`rounded-lg border-2 px-3 py-3 text-sm font-semibold transition-all ${!custom && amount === value ? 'border-marigold bg-marigold-50 text-ink shadow-soft' : 'border-steel/15 bg-paper-50 text-ink-muted hover:border-steel/35'}`}>₹{value}</button>)}
                    </div>
                    <Input label="Or choose a custom amount" name="amount" type="number" min="1" prefix="₹" value={custom} onChange={(event) => setCustom(event.target.value)} placeholder="e.g. 1200" />
                    {message && <p className="rounded-md bg-rust-50 p-3 text-sm text-rust-dark">{message}</p>}
                    <Button fullWidth size="lg" type="submit" disabled={busy}>{busy ? 'Adding balance...' : `Add ₹${Number.isFinite(selectedAmount) ? selectedAmount : 0}`}</Button>
                </form>
                <div className="mt-5 flex items-start gap-2 border-t border-steel/10 pt-4 text-xs text-ink-muted"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-leaf" /><span>Prototype wallet only. Razorpay verification will be added before real money is credited.</span></div>
            </Panel>
        </main>
    );
}
