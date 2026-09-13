import { useEffect, useState } from 'react';
import { AdminDashboard, type AdminOperationsSummary } from './AdminDashboard';
import { mockCooks, mockZones, mockOrders } from './data';
import type { CookProfile, DeliveryZone } from '@maas/core';
import { AuthGate } from './AuthGate';
import { supabase } from './lib/supabase';
import { mapCook, mapOrder, mapZone } from './mappers';

export default function AdminApp() {
    const [cooks, setCooks] = useState<typeof mockCooks>([]);
    const [zones, setZones] = useState<typeof mockZones>([]);
    const [orders, setOrders] = useState<typeof mockOrders>([]);
    const [operationsSummary, setOperationsSummary] = useState<AdminOperationsSummary>({ summary: { total_orders: 0, pending_orders: 0, confirmed_orders: 0, delivered_orders: 0, cancelled_orders: 0, platform_revenue: 0, cook_payouts: 0 }, cooks: [] });
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        let channel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;
        let cancelled = false;

        const load = async () => {
            if (!supabase) return;
            const [cookResult, zoneResult, orderResult, summaryResult] = await Promise.all([
                supabase.from('cook_profiles').select('*'),
                supabase.from('delivery_zones').select('*'),
                supabase.from('orders').select('*, customer:profiles!orders_customer_id_fkey(full_name, name, phone, pincode, locality)').order('delivery_date', { ascending: false }).range(0, 24),
                supabase.rpc('get_admin_operations_summary', { page_number: 1, page_size: 25 }),
            ]);
            const failed = [cookResult, zoneResult, orderResult, summaryResult].find((result) => result.error);
            if (failed?.error) {
                setErrorMessage(`Could not load admin data: ${failed.error.message}`);
                return;
            }
            setErrorMessage('');
            if (cookResult.data) setCooks(cookResult.data.map((row) => mapCook(row as Record<string, unknown>)));
            if (zoneResult.data) setZones(zoneResult.data.map((row) => mapZone(row as Record<string, unknown>)));
            if (orderResult.data) setOrders(orderResult.data.map((row) => mapOrder(row as Record<string, unknown>)));
            if (summaryResult.data) setOperationsSummary(summaryResult.data as AdminOperationsSummary);
        };

        const connect = async () => {
            if (!supabase || cancelled) return;
            const { data } = await supabase.auth.getSession();
            if (!data.session || cancelled) return;
            await load();
            if (cancelled) return;
            channel = supabase.channel('admin-live-data')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => void load())
                .on('postgres_changes', { event: '*', schema: 'public', table: 'cook_profiles' }, () => void load())
                .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => void load())
                .on('postgres_changes', { event: '*', schema: 'public', table: 'transfers' }, () => void load())
                .on('postgres_changes', { event: '*', schema: 'public', table: 'refunds' }, () => void load())
                .subscribe((status, subscriptionError) => {
                    if (subscriptionError || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                        setErrorMessage(`Live updates are unavailable: ${subscriptionError?.message || status}`);
                    }
                });
        };

        void connect();
        const { data: authListener } = supabase?.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_IN') void connect();
            if (event === 'SIGNED_OUT' && channel) {
                void supabase?.removeChannel(channel);
                channel = null;
            }
        }) ?? { data: { subscription: null } };

        return () => {
            cancelled = true;
            if (authListener?.subscription) authListener.subscription.unsubscribe();
            if (channel) void supabase?.removeChannel(channel);
        };
    }, []);

    const updateCook = async (cookId: string, updates: Partial<CookProfile>) => {
        if (!supabase) throw new Error('Supabase is not configured.');
        const status = updates.verificationStatus === 'approved' ? 'active' : updates.verificationStatus;
        const { data, error } = await supabase.from('cook_profiles').update({ status, rejection_reason: updates.rejectionReason, daily_capacity: updates.capacity }).eq('id', cookId).select().single();
        if (error) throw error;
        if (!data) throw new Error('The cook update was not confirmed by Supabase.');
        setErrorMessage('');
        setCooks((current) => current.map((cook) => cook.id === cookId ? mapCook(data as Record<string, unknown>) : cook));
    };
    const updateZone = async (zoneId: string, updates: Partial<DeliveryZone>) => {
        if (!supabase) throw new Error('Supabase is not configured.');
        const { data, error } = await supabase.from('delivery_zones').update({ has_platform_delivery: updates.hasPlatformDelivery, delivery_fee: updates.deliveryFee, assigned_partner_id: updates.assignedPartnerId }).eq('id', zoneId).select().single();
        if (error) throw error;
        if (!data) throw new Error('The zone update was not confirmed by Supabase.');
        setZones((current) => current.map((zone) => zone.id === zoneId ? mapZone(data as Record<string, unknown>) : zone));
    };

    return <AuthGate><AdminDashboard cooks={cooks} zones={zones} orders={orders} operationsSummary={operationsSummary} errorMessage={errorMessage} onUpdateCook={updateCook} onUpdateZone={updateZone} /></AuthGate>;
}