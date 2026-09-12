import { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, UserRound } from 'lucide-react';
import { Button, Input, Panel } from '@maas/ui';
import { supabase } from '../../lib/supabase';

interface ProfilePageProps {
    profile: { fullName: string; phone: string; pincode: string; locality: string };
    onBack: () => void;
    onSaved: (profile: ProfilePageProps['profile']) => void;
}

export function ProfilePage({ profile, onBack, onSaved }: ProfilePageProps) {
    const [form, setForm] = useState(profile);
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        const loadProfile = async () => {
            if (!supabase) return;
            const { data: userData } = await supabase.auth.getUser();
            if (!userData.user) return;
            const { data, error } = await supabase.from('profiles').select('full_name, name, phone, pincode, locality').eq('id', userData.user.id).maybeSingle();
            if (error || !data) return;
            const nextProfile = { fullName: data.full_name || data.name || '', phone: data.phone || '', pincode: data.pincode || '', locality: data.locality || '' };
            setForm(nextProfile);
            onSaved(nextProfile);
        };
        void loadProfile();
    }, [onSaved]);

    const save = async (event: FormEvent) => {
        event.preventDefault();
        if (!supabase) return;
        setBusy(true);
        const { data: userData } = await supabase.auth.getUser();
        const { error } = userData.user
            ? await supabase.from('profiles').update({ full_name: form.fullName, name: form.fullName, phone: form.phone, pincode: form.pincode, locality: form.locality }).eq('id', userData.user.id)
            : { error: new Error('Session expired') };
        setBusy(false);
        if (error) return setMessage(error.message);
        setMessage('Profile updated.');
        onSaved(form);
    };

    return <main className="mx-auto max-w-2xl px-4 py-7 sm:px-6 animate-fade-in">
        <button onClick={onBack} className="mb-6 flex min-h-11 items-center gap-1.5 text-sm text-ink-muted hover:text-ink"><ArrowLeft size={16} /> Back</button>
        <div className="mb-6 flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-full bg-spice-50 text-spice"><UserRound size={21} /></div><div><p className="text-sm text-ink-muted">Your account</p><h1 className="font-display text-3xl font-semibold text-ink">Profile</h1></div></div>
        <Panel padded><form onSubmit={save} className="space-y-4"><Input label="Full name" name="fullName" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required /><Input label="Phone number" name="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required /><div className="grid gap-4 sm:grid-cols-2"><Input label="Pincode" name="pincode" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} required /><Input label="Locality" name="locality" value={form.locality} onChange={(e) => setForm({ ...form, locality: e.target.value })} required /></div>{message && <p className="text-sm text-leaf-dark">{message}</p>}<Button type="submit" disabled={busy}>{busy ? 'Saving...' : 'Save profile'}</Button></form></Panel>
    </main>;
}
