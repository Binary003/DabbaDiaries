import { useEffect, useRef, useState } from 'react';
import { canAcceptSubscription, cancelSubscription, createPayment, configurePaymentProvider, getDeliveryFee, registerCookPayoutAccount, type PaymentProviderClient } from '@maas/core';
import { type Role, type CookProfile, type Subscription, type Order, type DeliveryZone, type DeliveryMode, type PlanType, type PaymentRecord, type TransferRecord, type RefundRecord } from '@/types';
import {
  mockCooks,
  mockZones,
  mockSubscriptions,
  mockOrders,
  mockCookPayments,
  CURRENT_USER_ID,
  CURRENT_COOK_ID,
  PLATFORM_FEE_PER_MEAL,
} from '@/data';
import { formatINR, generateHandoverCode } from '@/utils';
import { TopNav } from '@/components/ui/TopNav';
import { PincodeEntry } from '@/components/customer/PincodeEntry';
import { CookDiscovery } from '@/components/customer/CookDiscovery';
import { CookProfileCheckout } from '@/components/customer/CookProfileCheckout';
import { CustomerDashboard } from '@/components/customer/CustomerDashboard';
import { CookOnboarding } from '@/components/cook/CookOnboarding';
import { CookDashboard } from '@/components/cook/CookDashboard';
import { AuthScreen } from './components/AuthScreen';
import { PasswordResetScreen } from './components/PasswordResetScreen';
import { ProfilePage } from './components/customer/ProfilePage';
import { OrderTracking } from './components/customer/OrderTracking';
import { MyOrders } from './components/customer/MyOrders';
import { PaymentStatement } from './components/customer/PaymentStatement';
import { CookEarnings } from './components/cook/CookEarnings';
import { supabase } from './lib/supabase';
import { mapCook, mapZone } from './lib/mappers';
import type { ResolvedLocation } from './lib/geolocation';

type CustomerPage =
  | { name: 'pincode' }
  | { name: 'discovery'; pincode: string }
  | { name: 'checkout'; cookId: string }
  | { name: 'dashboard' }
  | { name: 'statement' }
    | { name: 'orders' }
  | { name: 'profile' }
  | { name: 'singleTracking'; orderId: string };

type CookPage = 'onboarding' | 'dashboard';

const SUPABASE_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function mapOrderRow(row: Record<string, unknown>): Order {
  const customer = (row.customer as Record<string, unknown> | null) ?? {};
  const fullName = String(customer.full_name ?? customer.name ?? '');
  const locality = String(customer.locality ?? '');
  return {
    id: String(row.id), subscriptionId: row.subscription_id ? String(row.subscription_id) : undefined,
    orderType: row.order_type as Order['orderType'], customerId: String(row.customer_id), cookId: String(row.cook_id),
    date: String(row.delivery_date), deliveryDate: String(row.delivery_date), mealSlot: row.meal_type as Order['mealSlot'],
    status: row.status as Order['status'], handoverCode: row.handover_code ? String(row.handover_code) : undefined,
    handoverConfirmedAt: row.handover_confirmed_at ? String(row.handover_confirmed_at) : undefined,
    deliveryMode: row.delivery_mode as DeliveryMode, zoneId: row.delivery_zone_id ? String(row.delivery_zone_id) : undefined,
    customerName: fullName, customerPhone: customer.phone ? String(customer.phone) : undefined,
    customerLocality: locality || undefined, cookName: '',
    pincode: customer.pincode ? String(customer.pincode) : '', address: locality || undefined,
  };
}

export default function App() {
  const subscriptionStateKey = 'dabbadiaries-customer-subscription';
  const [sessionReady, setSessionReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [roleReady, setRoleReady] = useState(false);
  const [demoCatalog, setDemoCatalog] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [role, setRole] = useState<Role>('customer');
  const [initialPincode, setInitialPincode] = useState('');
  const [resolvedLocation, setResolvedLocation] = useState<ResolvedLocation | null>(null);
  const [activePincode, setActivePincode] = useState('');
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [refunds, setRefunds] = useState<RefundRecord[]>([]);
  const [paymentMessage, setPaymentMessage] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState<number | null>(null);
  const [customerRecordsLoading, setCustomerRecordsLoading] = useState(false);
  const [customerRecordsError, setCustomerRecordsError] = useState('');
  const [profile, setProfile] = useState({ fullName: '', phone: '', pincode: '', locality: '' });
  const profileSyncGeneration = useRef(0);

  const clearAuthDependentState = () => {
    profileSyncGeneration.current += 1;
    setPayments([]);
    setTransfers([]);
    setRefunds([]);
    setOrders([]);
    setSubscriptions([]);
    setProfile({ fullName: '', phone: '', pincode: '', locality: '' });
    setInitialPincode('');
    setResolvedLocation(null);
    setActivePincode('');
    setCustomerPage({ name: 'pincode' });
    setCustomerRecordsLoading(false);
    setCustomerRecordsError('');
  };

  const syncProfileFromSession = async (userId: string) => {
    const client = supabase;
    if (!client) return;
    const generation = ++profileSyncGeneration.current;

    const loadProfileRow = () => client.from('profiles').select('role, pincode, locality, phone, name, full_name').eq('id', userId).maybeSingle();
    let { data: profileRow, error } = await loadProfileRow();

    if (error?.code === '401' || error?.message?.toLowerCase().includes('jwt')) {
      const { data: refreshedSession, error: refreshError } = await client.auth.refreshSession();
      if (!refreshError && refreshedSession.session?.user.id === userId) {
        ({ data: profileRow, error } = await loadProfileRow());
      }
    }

    if (!error && !profileRow) {
      const result = await client.rpc('ensure_profile_for_current_user');
      profileRow = result.data as typeof profileRow;
      error = result.error;
    }

    if (error) {
      if (generation !== profileSyncGeneration.current) return;
      const message = error.message?.toLowerCase() ?? '';
      const isAuthFailure = error.code === '401' || message.includes('jwt') || message.includes('not authenticated') || message.includes('row level security') || message.includes('permission denied');

      if (isAuthFailure) {
        setAuthenticated(false);
        setRole('customer');
        setProfile({ fullName: '', phone: '', pincode: '', locality: '' });
        setInitialPincode('');
        try {
          await client.auth.signOut();
        } catch {
          // Ignore sign-out failures during a stale session recovery path.
        }
        return;
      }

      console.warn('Profile lookup failed', error);
      return;
    }

    if (generation !== profileSyncGeneration.current) return;
    if (profileRow?.role === 'cook' || profileRow?.role === 'customer') {
      setRole(profileRow.role);
      setProfile({ fullName: profileRow.full_name || profileRow.name || '', phone: profileRow.phone || '', pincode: profileRow.pincode || '', locality: profileRow.locality || '' });
      if (profileRow.role === 'customer' && /^\d{6}$/.test(profileRow.pincode ?? '')) setInitialPincode(profileRow.pincode);
    }
  };

  useEffect(() => {
    const client = supabase;
    if (!client) {
      setRoleReady(true);
      return setSessionReady(true);
    }

    client.auth.getSession().then(async ({ data, error }) => {
      const session = data.session;
      if (error) {
        console.warn('Session fetch failed', error);
      }
      setRoleReady(false);
      setAuthenticated(Boolean(session));
      if (session) {
        await syncProfileFromSession(session.user.id);
      }
      setRoleReady(true);
      setSessionReady(true);
    });

    const { data: listener } = client.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      setRoleReady(false);
      setAuthenticated(Boolean(session));
      if (!session) {
        clearAuthDependentState();
        setRole('customer');
        setProfile({ fullName: '', phone: '', pincode: '', locality: '' });
        return setRoleReady(true);
      }

      await syncProfileFromSession(session.user.id);
      setRoleReady(true);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => { if (supabase) configurePaymentProvider(supabase as unknown as PaymentProviderClient); }, []);

  const loadPayments = async () => {
    if (!supabase) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data: paymentRows } = await supabase.from('payments').select('*').eq('customer_id', userData.user.id).order('created_at', { ascending: false }).limit(20);
    const paymentIds = (paymentRows ?? []).map((payment) => payment.id);
    const [{ data: transferRows }, { data: refundRows }] = paymentIds.length === 0
      ? [{ data: [] }, { data: [] }]
      : await Promise.all([
        supabase.from('transfers').select('*').in('payment_id', paymentIds),
        supabase.from('refunds').select('*').in('payment_id', paymentIds),
      ]);
    if (paymentRows) setPayments(paymentRows.map((row) => ({ id: row.id, customerId: row.customer_id, amount: Number(row.amount), description: row.description ?? '', status: row.status === 'refunded' ? 'refunded' : 'created', createdAt: row.created_at })));
    if (transferRows) setTransfers(transferRows.map((row) => ({ id: row.id, paymentId: row.payment_id, cookId: row.cook_id, orderId: row.order_id ?? undefined, amount: Number(row.amount), status: row.status, holdUntil: row.hold_until ?? undefined, releasedAt: row.released_at ?? undefined, createdAt: row.created_at })));
    if (refundRows) setRefunds(refundRows.map((row) => ({ id: row.id, paymentId: row.payment_id, amount: Number(row.amount), reason: row.reason, createdAt: row.created_at })));
  };

  useEffect(() => { if (!sessionReady || !authenticated || role !== 'customer') return; void loadPayments(); }, [sessionReady, authenticated, role]);

  // Customer state
  const [customerPage, setCustomerPage] = useState<CustomerPage>({ name: 'pincode' });
  const [cooks, setCooks] = useState<CookProfile[]>(mockCooks);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(subscriptionStateKey) || '') as Subscription[];
    } catch {
      return mockSubscriptions;
    }
  });
  const [zones, setZones] = useState<DeliveryZone[]>(mockZones);
  const [orders, setOrders] = useState<Order[]>(mockOrders);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [cookTransfers, setCookTransfers] = useState<TransferRecord[]>([]);

  useEffect(() => {
    const loadCookTransfers = async () => {
      if (!supabase || !sessionReady || !authenticated || role !== 'cook') return;
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data: cookRow } = await supabase.from('cook_profiles').select('id').eq('user_id', userData.user.id).maybeSingle();
      if (!cookRow) return;
      const { data } = await supabase.from('transfers').select('*').eq('cook_id', cookRow.id).order('created_at', { ascending: false });
      if (data) setCookTransfers(data.map((row) => ({ id: row.id, paymentId: row.payment_id, cookId: row.cook_id, orderId: row.order_id ?? undefined, amount: Number(row.amount), status: row.status, holdUntil: row.hold_until ?? undefined, releasedAt: row.released_at ?? undefined, createdAt: row.created_at })));
    };
    void loadCookTransfers();
  }, [sessionReady, authenticated, role]);

  // Cook state
  const [cookPage, setCookPage] = useState<CookPage>('dashboard');
  const [cookProfile, setCookProfile] = useState<CookProfile | undefined>(
    undefined,
  );

  useEffect(() => {
    const loadCookOrders = async () => {
      if (!supabase || !sessionReady || !authenticated || role !== 'cook') return;
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data: cookRow, error: cookError } = await supabase.from('cook_profiles').select('id').eq('user_id', userData.user.id).maybeSingle();
      if (cookError || !cookRow) return;
      const matchedCook = cooks.find((cook) => cook.id === cookRow.id);
      if (matchedCook) setCookProfile(matchedCook);
      const { data: orderRows } = await supabase.from('orders')
        .select('*, customer:profiles!orders_customer_id_fkey(full_name, name, phone, pincode, locality)')
        .eq('cook_id', cookRow.id)
        .order('delivery_date', { ascending: false });
      if (orderRows) setOrders(orderRows.map((row) => mapOrderRow(row as Record<string, unknown>)));
    };
    void loadCookOrders();
  }, [sessionReady, authenticated, role, cooks]);

  useEffect(() => {
    localStorage.setItem(subscriptionStateKey, JSON.stringify(subscriptions));
  }, [subscriptions]);

  useEffect(() => {
    const loadCatalog = async () => {
      if (!supabase) {
        setDemoCatalog(true);
        return;
      }
      const [{ data: cookRows }, { data: zoneRows }] = await Promise.all([
        supabase.from('cook_profiles').select('*'),
        supabase.from('delivery_zones').select('*'),
      ]);
      if (!cookRows?.length) {
        setCooks(mockCooks);
        setZones(mockZones);
        setDemoCatalog(true);
        return;
      }
      const nextCooks = (cookRows ?? []).map((row) => mapCook(row as Record<string, unknown>));
      const demoCook = mockCooks.find((cook) => cook.pincodes.includes('201310'));
      const cooksWithDemoFallback = demoCook && !nextCooks.some((cook) => cook.pincodes.includes('201310'))
        ? [...nextCooks, demoCook]
        : nextCooks;
      const nextZones = (zoneRows ?? []).map((row) => mapZone(row as Record<string, unknown>));
      const demoZone = mockZones.find((zone) => zone.pincode === '201310');
      setCooks(cooksWithDemoFallback);
      setZones(demoZone && !nextZones.some((zone) => zone.pincode === '201310') ? [...nextZones, demoZone] : nextZones);
      setDemoCatalog(false);
      const current = nextCooks.find((cook) => cook.userId === CURRENT_COOK_ID);
      if (current) setCookProfile(current);
    };
    void loadCatalog();
  }, []);

  useEffect(() => {
    const loadCustomerRecords = async () => {
      if (!supabase || !sessionReady || !authenticated || role !== 'customer') return;
      setCustomerRecordsLoading(true);
      setCustomerRecordsError('');
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        setCustomerRecordsLoading(false);
        setCustomerRecordsError(userError?.message || 'Your session could not be restored.');
        return;
      }

      // Orders and subscriptions are durable account data. Fetch them fresh from Supabase on every authenticated load;
      // never rely on session-only state or let sign-out cleanup become the source of truth.
      const [{ data: subscriptionRows, error: subscriptionError }, { data: orderRows, error: orderError }] = await Promise.all([
        supabase.from('subscriptions').select('*').eq('customer_id', userData.user.id).order('created_at', { ascending: false }),
        supabase.from('orders').select('*').eq('customer_id', userData.user.id).order('delivery_date', { ascending: false }),
      ]);
      if (subscriptionError || orderError) {
        const error = subscriptionError || orderError;
        console.warn('Customer records lookup failed', error);
        setCustomerRecordsLoading(false);
        setCustomerRecordsError(error?.message || 'Your orders could not be loaded.');
        return;
      }
      setSubscriptions((subscriptionRows ?? []).map((row) => ({
        id: row.id, customerId: row.customer_id, cookId: row.cook_id, planType: row.plan_type, mealSlot: row.meal_type,
        deliveryMode: row.delivery_mode, startDate: row.start_date, endDate: row.end_date, daysTotal: row.total_days,
        daysRemaining: Math.max(0, row.total_days - 0), daysCompleted: 0, mealsPerDay: 1, pricePerMeal: row.price_per_meal,
        deliveryFee: 0, platformFee: 0, totalPaid: row.amount_paid, status: row.status, todayStatus: 'pending', todaySkipped: false,
      })));
      setOrders((orderRows ?? []).map((row) => mapOrderRow(row as Record<string, unknown>)));
      setCustomerRecordsLoading(false);
    };
    void loadCustomerRecords();
  }, [sessionReady, authenticated, role]);

  useEffect(() => {
    const client = supabase;
    if (!client || !sessionReady || !authenticated || role !== 'customer') return;
    const channel = client.channel('customer-ledger-orders').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, async () => {
      const { data: userData } = await client.auth.getUser();
      if (!userData.user) return;
      const { data } = await client.from('orders').select('*').eq('customer_id', userData.user.id);
      if (data) setOrders(data.map((row) => mapOrderRow(row as Record<string, unknown>)));
      void loadPayments();
    }).subscribe();
    return () => { void client.removeChannel(channel); };
  }, [sessionReady, authenticated, role]);

  const handleAuthenticated = async (nextRole: Exclude<Role, 'admin'>) => {
    setRole(nextRole);
    setAuthenticated(true);
    setRoleReady(false);
    setCustomerPage({ name: 'pincode' });
    const { data } = await supabase?.auth.getUser() ?? { data: { user: null } };
    if (data.user) {
      await syncProfileFromSession(data.user.id);
    }
    setRoleReady(true);
  };

  if (!sessionReady) return <div className="flex min-h-screen items-center justify-center text-ink-muted">Loading your account...</div>;
  if (passwordRecovery) return <PasswordResetScreen onComplete={() => setPasswordRecovery(false)} />;
  if (!authenticated) return <AuthScreen onAuthenticated={handleAuthenticated} />;
  if (!roleReady) return <div className="flex min-h-screen items-center justify-center text-ink-muted">Loading your account...</div>;

  const handleHome = () => {
    if (role === 'customer') {
      const pincode = resolvedLocation?.pincode || activePincode || initialPincode;
      setCustomerPage(pincode ? { name: 'discovery', pincode } : { name: 'pincode' });
    } else if (role === 'cook') {
      setCookPage(cookProfile ? 'dashboard' : 'onboarding');
    }
  };

  // Customer handlers
  const handlePincodeSubmit = async (pincode: string, location: ResolvedLocation | null = null) => {
    setResolvedLocation(location);
    setActivePincode(pincode);
    setDiscoveryLoading(true);
    setCustomerPage({ name: 'discovery', pincode });
    setTimeout(() => setDiscoveryLoading(false), 600);
  };

  const handleSignOut = async () => {
    clearAuthDependentState();
    setAuthenticated(false);
    setRole('customer');
    setRoleReady(true);
    if (supabase) await supabase.auth.signOut();
  };

  const handleSelectCook = (cook: CookProfile) => {
    setCustomerPage({ name: 'checkout', cookId: cook.id });
  };

  const handleBackToCooks = () => {
    const pincode = resolvedLocation?.pincode || activePincode;
    setCustomerPage(pincode ? { name: 'discovery', pincode } : { name: 'pincode' });
  };

  const handleSubscribe = async (data: { cook: CookProfile; planType: PlanType; deliveryMode: DeliveryMode }) => {
    const { cook, planType, deliveryMode } = data;
    if (!canAcceptSubscription(cook.activeSubscribers, 1, cook.capacity)) return;
    if (!SUPABASE_UUID_PATTERN.test(cook.id)) {
      setPaymentMessage('This demo kitchen is not connected to a live cook account yet. Choose a live kitchen to continue.');
      return;
    }
    const planDays = planType === 'single' ? 1 : planType === 'weekly' ? 7 : 30;
    const zone = zones.find((z) => z.pincode === cook.pincodes[0]);
    const deliveryFee = getDeliveryFee(deliveryMode, cook.selfDeliveryFee, zone);
    const totalDebit = (cook.pricePerMeal + PLATFORM_FEE_PER_MEAL + deliveryFee) * planDays;
    const { data: userData } = await supabase?.auth.getUser() ?? { data: { user: null } };
    const paymentDescription = JSON.stringify({ kind: planType === 'single' ? 'single_order' : 'subscription', cookId: cook.id, cookName: cook.name, planType, mealPrice: cook.pricePerMeal, planDays, platformFee: PLATFORM_FEE_PER_MEAL * planDays, deliveryFee: deliveryFee * planDays, total: totalDebit });

    if (!supabase || !userData.user) { setPaymentMessage('Payment service is unavailable.'); return; }
    let paymentId: string;
    try {
      paymentId = (await createPayment(userData.user.id, totalDebit, paymentDescription)).paymentId;
    } catch (error) { setPaymentMessage(error instanceof Error ? error.message : 'Payment could not be created.'); return; }

    if (planType === 'single' && supabase && userData.user) {
      const handoverCode = generateHandoverCode();
      const { data: createdOrder, error } = await supabase.rpc('create_single_order_for_payment', { customer: userData.user.id, payload: { payment_id: paymentId, cook_id: cook.id, meal_type: 'lunch', delivery_mode: deliveryMode, delivery_zone_id: zone?.id ?? null, delivery_date: new Date().toISOString().split('T')[0], meal_price: cook.pricePerMeal, handover_code: handoverCode } });
      if (error || !createdOrder) { setPaymentMessage(error?.message || 'Order could not be created.'); return; }
      await loadPayments();
      const order: Order = { id: createdOrder.id, orderType: 'single', customerId: userData.user.id, cookId: cook.id, date: new Date().toISOString().split('T')[0], deliveryDate: new Date().toISOString().split('T')[0], mealSlot: 'lunch', status: 'pending', deliveryMode, customerName: '', cookName: cook.name, pincode: cook.pincodes[0], address: '', handoverCode };
      setOrders((current) => [...current, order]);
      setPaymentSuccess(totalDebit);
      window.setTimeout(() => { setPaymentSuccess(null); setCustomerPage({ name: 'orders' }); }, 1100);
      return;
    }

    if (planType !== 'single') {
      const { data: createdSubscription, error } = await supabase.rpc('create_subscription_for_payment', { customer: userData.user.id, payload: { payment_id: paymentId, cook_id: cook.id, plan_type: planType, meal_type: 'lunch', start_date: new Date().toISOString().split('T')[0], delivery_mode: deliveryMode, delivery_zone_id: zone?.id ?? null, meal_price: cook.pricePerMeal } });
      if (error || !createdSubscription) { setPaymentMessage(error?.message || 'Subscription could not be created.'); return; }
      const { data: subscriptionOrders } = await supabase.from('orders').select('*').eq('subscription_id', createdSubscription.id).order('delivery_date');
      if (subscriptionOrders) setOrders((current) => [...current.filter((order) => order.subscriptionId !== createdSubscription.id), ...subscriptionOrders.map((row) => ({ id: row.id, subscriptionId: row.subscription_id, orderType: row.order_type, customerId: row.customer_id, cookId: row.cook_id, date: row.delivery_date, deliveryDate: row.delivery_date, mealSlot: row.meal_type, status: row.status, handoverCode: row.handover_code ?? undefined, handoverConfirmedAt: row.handover_confirmed_at, deliveryMode: row.delivery_mode, customerName: '', cookName: cook.name, pincode: cook.pincodes[0], address: '' }))]);
      await loadPayments();
      setSubscriptions([{ id: createdSubscription.id, customerId: createdSubscription.customer_id, cookId: createdSubscription.cook_id, planType: createdSubscription.plan_type, mealSlot: createdSubscription.meal_type, deliveryMode: createdSubscription.delivery_mode, startDate: createdSubscription.start_date, endDate: createdSubscription.end_date, daysTotal: createdSubscription.total_days, daysRemaining: createdSubscription.total_days, daysCompleted: 0, mealsPerDay: 1, pricePerMeal: createdSubscription.price_per_meal, deliveryFee, platformFee: PLATFORM_FEE_PER_MEAL, totalPaid: Number(createdSubscription.amount_paid), status: createdSubscription.status, todayCode: generateHandoverCode(), todayStatus: 'pending', todaySkipped: false }]);
      setPaymentSuccess(totalDebit);
      window.setTimeout(() => { setPaymentSuccess(null); setCustomerPage({ name: 'orders' }); }, 1100);
      return;
    }

    if (planType === 'single') {
      const order: Order = { id: `single-${Date.now()}`, orderType: 'single', customerId: CURRENT_USER_ID, cookId: cook.id, date: new Date().toISOString().split('T')[0], deliveryDate: new Date().toISOString().split('T')[0], mealSlot: 'lunch', status: 'pending', deliveryMode, customerName: '', cookName: cook.name, pincode: cook.pincodes[0], address: '', handoverCode: generateHandoverCode() };
      setOrders((current) => [...current, order]);
    } else {
      setSubscriptions([{ id: `sub-${Date.now()}`, customerId: CURRENT_USER_ID, cookId: cook.id, planType, mealSlot: 'lunch', deliveryMode, startDate: new Date().toISOString().split('T')[0], endDate: new Date(Date.now() + planDays * 86400000).toISOString().split('T')[0], daysTotal: planDays, daysRemaining: planDays, daysCompleted: 0, mealsPerDay: 1, pricePerMeal: cook.pricePerMeal, deliveryFee, platformFee: PLATFORM_FEE_PER_MEAL, totalPaid: totalDebit, status: 'active', todayCode: generateHandoverCode(), todayStatus: 'pending', todaySkipped: false }]);
    }
    setPaymentSuccess(totalDebit);
    await loadPayments();
    window.setTimeout(() => { setPaymentSuccess(null); setCustomerPage({ name: 'orders' }); }, 1100);
  };

  const currentSubscription = subscriptions.find((s) => s.status === 'active' && s.planType !== 'single');
  const currentCook = currentSubscription
    ? cooks.find((c) => c.id === currentSubscription.cookId)
    : null;

  const handleOpenWallet = () => setCustomerPage({ name: 'statement' });
  const handleOpenOrders = () => setCustomerPage({ name: 'orders' });
  const handleOpenProfile = () => setCustomerPage({ name: 'profile' });
  const handleCancelSubscription = async () => {
    if (!currentSubscription) return;
    const subscriptionOrderIds = new Set(orders.filter((order) => order.subscriptionId === currentSubscription.id).map((order) => order.id));
    const refundAmount = transfers.filter((transfer) => transfer.orderId && subscriptionOrderIds.has(transfer.orderId) && transfer.status === 'on_hold').reduce((sum, transfer) => sum + transfer.amount + currentSubscription.platformFee + currentSubscription.deliveryFee, 0);
    try { await cancelSubscription(currentSubscription.id, refundAmount); setSubscriptions((current) => current.map((subscription) => subscription.id === currentSubscription.id ? { ...subscription, status: 'cancelled' } : subscription)); await loadPayments(); } catch (error) { setPaymentMessage(error instanceof Error ? error.message : 'Cancellation failed.'); }
  };
  const handleViewCookProfile = () => {
    if (currentCook) setCustomerPage({ name: 'checkout', cookId: currentCook.id });
  };

  const handleUpdateSubscription = (updates: Partial<Subscription>) => {
    if (!currentSubscription) return;
    setSubscriptions((prev) =>
      prev.map((s) =>
        s.id === currentSubscription.id ? { ...s, ...updates } : s,
      ),
    );
  };

  const handleRate = (stars: number) => {
    if (!currentSubscription) return;
    handleUpdateSubscription({ ratingGiven: stars });
  };

  // Cook handlers
  const handleCookOnboard = async (profile: Partial<CookProfile> & { payout?: { upiId?: string; accountNumber?: string; ifsc?: string } }) => {
    const { data: userData } = await supabase?.auth.getUser() ?? { data: { user: null } };
    if (supabase && userData.user) {
      const { data: saved, error } = await supabase.from('cook_profiles').upsert({
        user_id: userData.user.id,
        display_name: profile.name,
        tagline: profile.tagline,
        bio: profile.bio,
        kitchen_photo_url: profile.kitchenPhoto,
        pincodes: profile.pincodes,
        veg_type: profile.vegType,
        price_per_meal: profile.pricePerMeal,
        weekly_price: profile.weeklyPrice,
        monthly_price: profile.monthlyPrice,
        daily_capacity: profile.capacity,
        self_delivery_enabled: profile.selfDelivery,
        self_delivery_fee: profile.selfDeliveryFee,
        fssai_tier: profile.fssaiTier,
        fssai_number: profile.fssaiNumber,
        weekly_menu: profile.weeklyMenu,
        status: 'pending',
      }, { onConflict: 'user_id' }).select().single();
      if (error || !saved) return;
      const persisted = mapCook(saved as Record<string, unknown>);
      if (profile.payout && supabase) {
        try { await registerCookPayoutAccount(persisted.id, profile.payout); } catch { /* onboarding can be completed before payout details are final */ }
      }
      setCookProfile(persisted);
      setCooks((prev) => [...prev.filter((cook) => cook.id !== persisted.id), persisted]);
      setCookPage('dashboard');
      return;
    }
    const updated: CookProfile = {
      ...(cookProfile as CookProfile),
      ...profile,
    } as CookProfile;
    setCookProfile(updated);
    setCooks((prev) =>
      prev.map((c) => (c.id === CURRENT_COOK_ID ? updated : c)),
    );
    setCookPage('dashboard');
  };

  const handleUpdateCook = (updates: Partial<CookProfile>) => {
    if (!cookProfile) return;
    const updated = { ...cookProfile, ...updates };
    void supabase?.from('cook_profiles').update({
      display_name: updates.name,
      tagline: updates.tagline,
      bio: updates.bio,
      daily_capacity: updates.capacity,
      weekly_menu: updates.weeklyMenu,
      price_per_meal: updates.pricePerMeal,
      weekly_price: updates.weeklyPrice,
      monthly_price: updates.monthlyPrice,
      self_delivery_enabled: updates.selfDelivery,
      self_delivery_fee: updates.selfDeliveryFee,
    }).eq('id', cookProfile.id);
    setCookProfile(updated);
    setCooks((prev) =>
      prev.map((c) => (c.id === cookProfile.id ? updated : c)),
    );
  };

  const handleUpdateOrder = (orderId: string, updates: Partial<Order>, submittedCode?: string) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, ...updates } : o)),
    );
    if (updates.status === 'confirmed' && supabase) {
      void supabase.rpc('confirm_handover', { order_id: orderId, submitted_code: submittedCode ?? orders.find((order) => order.id === orderId)?.handoverCode ?? '' }).then(({ error }) => {
        if (!error) void loadPayments();
      });
    }
  };

  const cookOrders = orders.filter((o) => o.cookId === (cookProfile?.id ?? CURRENT_COOK_ID));

  return (
    <div className="min-h-screen bg-paper">
      <TopNav role={role} onHome={handleHome} onWallet={handleOpenWallet} onOrders={role === 'customer' ? handleOpenOrders : undefined} hasActivePlan={Boolean(currentSubscription)} activePlanLabel={currentCook?.name} displayName={profile.fullName} onProfile={role === 'customer' ? handleOpenProfile : undefined} rightSlot={<button className="min-h-11 px-2 text-xs text-ink-muted" onClick={handleSignOut}>Sign out</button>} />

      {role === 'customer' && (
        <>
          {paymentSuccess !== null && (
            <main className="flex min-h-[calc(100vh-65px)] items-center justify-center px-4 py-10">
              <div className="animate-fade-in text-center">
                <div className="mx-auto flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-leaf-50 text-leaf">
                  <span className="text-3xl">✓</span>
                </div>
                <p className="mt-5 font-display text-2xl font-semibold text-ink">Payment successful! {formatINR(paymentSuccess)} deducted</p>
                <p className="mt-1 text-sm text-ink-muted">Your order is confirmed.</p>
              </div>
            </main>
          )}
          {paymentSuccess === null && customerPage.name === 'pincode' && (
            <PincodeEntry
              onSubmit={handlePincodeSubmit}
              initialPincode={initialPincode}
            />
          )}
          {paymentSuccess === null && customerPage.name === 'discovery' && (
            <CookDiscovery
              pincode={customerPage.pincode}
              cooks={cooks}
              loading={discoveryLoading}
              onBack={() => setCustomerPage({ name: 'pincode' })}
              onSelectCook={handleSelectCook}
              userLocation={resolvedLocation}
              activeSubscriptionCookId={currentSubscription?.cookId}
            />
          )}
          {paymentSuccess === null && customerPage.name === 'checkout' && (() => {
            const cook = cooks.find((c) => c.id === customerPage.cookId);
            if (!cook) return null;
            const zone = zones.find((z) =>
              cook.pincodes.includes(z.pincode),
            );
            return (
              <CookProfileCheckout
                cook={cook}
                zone={zone}
                onBack={handleBackToCooks}
                onSubscribe={handleSubscribe}
              />
            );
          })()}
          {paymentSuccess === null && customerPage.name === 'dashboard' && (
            <CustomerDashboard
              subscription={currentSubscription || null}
              cook={currentCook ?? null}
              onSubscribe={() => setCustomerPage({ name: 'pincode' })}
              onUpdateSubscription={handleUpdateSubscription}
              onRate={handleRate}
              orders={orders}
            />
          )}
          {paymentSuccess === null && customerPage.name === 'statement' && <PaymentStatement payments={payments} transfers={transfers} refunds={refunds} onBack={handleBackToCooks} activeSubscription={currentSubscription} activeCook={currentCook} cooks={cooks} />}
          {paymentSuccess === null && customerPage.name === 'profile' && <ProfilePage profile={profile} onBack={handleBackToCooks} onSaved={setProfile} />}
          {paymentMessage && <p className="mx-auto max-w-5xl px-4 pb-4 text-sm text-rust-dark">{paymentMessage}</p>}
          {paymentSuccess === null && customerPage.name === 'singleTracking' && (() => { const order = orders.find((item) => item.id === customerPage.orderId); return order ? <OrderTracking order={order} cook={cooks.find((item) => item.id === order.cookId) ?? null} onBack={handleBackToCooks} /> : null; })()}
          {paymentSuccess === null && customerPage.name === 'orders' && <MyOrders subscription={currentSubscription ?? null} subscriptionCook={currentCook ?? null} cooks={cooks} orders={orders} onUpdateSubscription={handleUpdateSubscription} onRate={handleRate} onCancelSubscription={handleCancelSubscription} loading={customerRecordsLoading} error={customerRecordsError} onBack={handleBackToCooks} />}
        </>
      )}

      {role === 'cook' && (
        <>
          {cookPage === 'onboarding' || !cookProfile ? (
            <CookOnboarding
              onComplete={handleCookOnboard}
              existingProfile={cookProfile}
            />
          ) : (
            <CookDashboard
              cook={cookProfile}
              orders={cookOrders}
              payments={mockCookPayments}
              onUpdateCook={handleUpdateCook}
              onUpdateOrder={handleUpdateOrder}
              onEditProfile={() => setCookPage('onboarding')}
            />
          )}
          {cookProfile && <CookEarnings transfers={cookTransfers} />}
        </>
      )}

    </div>
  );
}
