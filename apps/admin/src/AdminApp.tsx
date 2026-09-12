import { useEffect, useState } from 'react';
import { AdminDashboard } from './AdminDashboard';
import { mockCooks, mockZones, mockOrders } from './data';
import type { CookProfile, DeliveryZone } from '@maas/core';
import { AuthGate } from './AuthGate';
import { supabase } from './lib/supabase';
import { mapCook, mapOrder, mapZone } from './mappers';

export default function AdminApp() {
    const [cooks, setCooks] = useState<typeof mockCooks>([]);
    const [zones, setZones] = useState<typeof mockZones>([]);
    const [orders, setOrders] = useState<typeof mockOrders>([]);

    useEffect(() => {
        const load = async () => {
            if (!supabase) return;
            const [{ data: cookRows }, { data: zoneRows }, { data: orderRows }] = await Promise.all([
                supabase.from('cook_profiles').select('*'),
                supabase.from('delivery_zones').select('*'),
                supabase.from('orders').select('*, customer:profiles!orders_customer_id_fkey(full_name, name, phone, pincode, locality)').order('delivery_date', { ascending: false }),
            ]);
            if (cookRows) setCooks(cookRows.map((row) => mapCook(row as Record<string, unknown>)));
            if (zoneRows) setZones(zoneRows.map((row) => mapZone(row as Record<string, unknown>)));
            if (orderRows) setOrders(orderRows.map((row) => mapOrder(row as Record<string, unknown>)));
        };
        void load();
        const channel = supabase?.channel('admin-live-data')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => void load())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'cook_profiles' }, () => void load())
            .subscribe();
        return () => { if (channel) void supabase?.removeChannel(channel); };
    }, []);

    const updateCook = (cookId: string, updates: Partial<CookProfile>) => {
        setCooks((current) => current.map((cook) => cook.id === cookId ? { ...cook, ...updates } : cook));
        void supabase?.from('cook_profiles').update({ status: updates.verificationStatus === 'approved' ? 'active' : updates.verificationStatus, daily_capacity: updates.capacity }).eq('id', cookId);
    };
    const updateZone = (zoneId: string, updates: Partial<DeliveryZone>) => {
        setZones((current) => current.map((zone) => zone.id === zoneId ? { ...zone, ...updates } : zone));
        void supabase?.from('delivery_zones').update({ has_platform_delivery: updates.hasPlatformDelivery, delivery_fee: updates.deliveryFee, assigned_partner_id: updates.assignedPartnerId }).eq('id', zoneId);
    };

    return <AuthGate><AdminDashboard cooks={cooks} zones={zones} orders={orders} onUpdateCook={updateCook} onUpdateZone={updateZone} /></AuthGate>;
}