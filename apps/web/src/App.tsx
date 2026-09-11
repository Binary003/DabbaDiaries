import { useEffect, useState } from 'react';
import { canAcceptSubscription, getDeliveryFee } from '@maas/core';
import { type Role, type CookProfile, type Subscription, type Order, type DeliveryZone, type DeliveryMode, type PlanType, type Wallet, type WalletTransaction } from '@/types';
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
import { SubscriptionWallet } from '@/components/customer/SubscriptionWallet';
import { CookOnboarding } from '@/components/cook/CookOnboarding';
import { CookDashboard } from '@/components/cook/CookDashboard';
import { AuthScreen } from './components/AuthScreen';
import { PasswordResetScreen } from './components/PasswordResetScreen';
import { WalletTopUpScreen } from './components/customer/WalletTopUpScreen';
import { ProfilePage } from './components/customer/ProfilePage';
import { OrderTracking } from './components/customer/OrderTracking';
import { supabase } from './lib/supabase';
import { mapCook, mapZone } from './lib/mappers';
import type { ResolvedLocation } from './lib/geolocation';

type CustomerPage =
  | { name: 'pincode' }
  | { name: 'discovery'; pincode: string }
  | { name: 'checkout'; cookId: string }
  | { name: 'dashboard' }
  | { name: 'wallet' }
  | { name: 'profile' }
  | { name: 'singleTracking'; orderId: string };

type CookPage = 'onboarding' | 'dashboard';

export default function App() {
  const subscriptionStateKey = 'dabbadiaries-customer-subscription';
  const [sessionReady, setSessionReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [roleReady, setRoleReady] = useState(false);
  const [demoCatalog, setDemoCatalog] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [firstRunTopUp, setFirstRunTopUp] = useState(false);
  const [role, setRole] = useState<Role>('customer');
  const [initialPincode, setInitialPincode] = useState('');
  const [resolvedLocation, setResolvedLocation] = useState<ResolvedLocation | null>(null);
  const [activePincode, setActivePincode] = useState('');
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);
  const [walletMessage, setWalletMessage] = useState('');
  const [walletFallbackCook, setWalletFallbackCook] = useState<CookProfile | null>(null);
  const [profile, setProfile] = useState({ fullName: '', phone: '', pincode: '', locality: '' });

  useEffect(() => {
    const client = supabase;
    if (!client) {
      setRoleReady(true);
      return setSessionReady(true);
    }
    client.auth.getSession().then(async ({ data }) => {
      setAuthenticated(Boolean(data.session));
      if (data.session) {
        if (localStorage.getItem('dabbadiaries-pending-first-topup') === 'true') setFirstRunTopUp(true);
        const { data: profileRow } = await client.from('profiles').select('role, pincode, locality, phone, name, full_name').eq('id', data.session.user.id).maybeSingle();
        if (profileRow?.role === 'cook' || profileRow?.role === 'customer') {
          setRole(profileRow.role);
          setProfile({ fullName: profileRow.full_name || profileRow.name || '', phone: profileRow.phone || '', pincode: profileRow.pincode || '', locality: profileRow.locality || '' });
          if (profileRow.role === 'customer' && /^\d{6}$/.test(profileRow.pincode ?? '')) setInitialPincode(profileRow.pincode);
        }
      }
      setRoleReady(true);
      setSessionReady(true);
    });
    const { data: listener } = client.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      setAuthenticated(Boolean(session));
      if (!session) return setRoleReady(true);
      const { data: profileRow } = await client.from('profiles').select('role, pincode, locality, phone, name, full_name').eq('id', session.user.id).maybeSingle();
      if (profileRow?.role === 'cook' || profileRow?.role === 'customer') {
        setRole(profileRow.role);
        setProfile({ fullName: profileRow.full_name || profileRow.name || '', phone: profileRow.phone || '', pincode: profileRow.pincode || '', locality: profileRow.locality || '' });
        if (profileRow.role === 'customer' && /^\d{6}$/.test(profileRow.pincode ?? '')) setInitialPincode(profileRow.pincode);
      }
      setRoleReady(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const loadWallet = async () => {
    if (!supabase) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data: walletRow } = await supabase.rpc('ensure_wallet', { customer: userData.user.id });
    if (walletRow) setWallet({ id: walletRow.id, userId: walletRow.user_id, balance: Number(walletRow.balance) });
    const { data: transactionRows } = await supabase.from('wallet_transactions').select('*').order('created_at', { ascending: false }).limit(15);
    if (transactionRows) setWalletTransactions(transactionRows.map((row) => ({ id: row.id, type: row.type, amount: Number(row.amount), relatedSubscriptionId: row.related_subscription_id ?? undefined, relatedOrderId: row.related_order_id ?? undefined, description: row.description, createdAt: row.created_at })));
  };

  useEffect(() => { if (authenticated && role === 'customer') void loadWallet(); }, [authenticated, role]);

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

  // Cook state
  const [cookPage, setCookPage] = useState<CookPage>('dashboard');
  const [cookProfile, setCookProfile] = useState<CookProfile | undefined>(
    undefined,
  );

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
      if (!supabase) return;
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const [{ data: subscriptionRows }, { data: orderRows }] = await Promise.all([
        supabase.from('subscriptions').select('*').eq('customer_id', userData.user.id).eq('status', 'active'),
        supabase.from('orders').select('*').eq('customer_id', userData.user.id),
      ]);
      if (subscriptionRows) setSubscriptions(subscriptionRows.map((row) => ({
        id: row.id, customerId: row.customer_id, cookId: row.cook_id, planType: row.plan_type, mealSlot: row.meal_type,
        deliveryMode: row.delivery_mode, startDate: row.start_date, endDate: row.end_date, daysTotal: row.total_days,
        daysRemaining: row.total_days, daysCompleted: 0, mealsPerDay: 1, pricePerMeal: row.price_per_meal,
        deliveryFee: 0, platformFee: 0, totalPaid: row.amount_paid, status: row.status, todayStatus: 'pending', todaySkipped: false,
      })));
      if (orderRows) setOrders(orderRows.map((row) => ({
        id: row.id, subscriptionId: row.subscription_id ?? undefined, orderType: row.order_type, customerId: row.customer_id,
        cookId: row.cook_id, date: row.delivery_date, deliveryDate: row.delivery_date, mealSlot: row.meal_type,
        status: row.status, handoverConfirmedAt: row.handover_confirmed_at, deliveryMode: row.delivery_mode,
        zoneId: row.delivery_zone_id ?? undefined, customerName: '', cookName: '', pincode: '', address: '',
      })));
    };
    void loadCustomerRecords();
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    const channel = client.channel('customer-ledger-orders').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, async () => {
      const { data: userData } = await client.auth.getUser();
      if (!userData.user) return;
      const { data } = await client.from('orders').select('*').eq('customer_id', userData.user.id);
      if (data) setOrders(data.map((row) => ({ id: row.id, subscriptionId: row.subscription_id ?? undefined, orderType: row.order_type, customerId: row.customer_id, cookId: row.cook_id, date: row.delivery_date, deliveryDate: row.delivery_date, mealSlot: row.meal_type, status: row.status, handoverConfirmedAt: row.handover_confirmed_at, deliveryMode: row.delivery_mode, zoneId: row.delivery_zone_id ?? undefined, customerName: '', cookName: '', pincode: '', address: '' })));
      void loadWallet();
    }).subscribe();
    return () => { void client.removeChannel(channel); };
  }, []);

  if (!sessionReady) return <div className="flex min-h-screen items-center justify-center text-ink-muted">Loading your account...</div>;
  if (passwordRecovery) return <PasswordResetScreen onComplete={() => setPasswordRecovery(false)} />;
  if (!authenticated) return <AuthScreen onAuthenticated={(nextRole, isNewSignup) => { setRole(nextRole); setAuthenticated(true); setRoleReady(true); setFirstRunTopUp(isNewSignup); setCustomerPage({ name: 'pincode' }); }} />;
  if (!roleReady) return <div className="flex min-h-screen items-center justify-center text-ink-muted">Loading your account...</div>;
  if (firstRunTopUp && role === 'customer') return <WalletTopUpScreen onComplete={() => { localStorage.removeItem('dabbadiaries-pending-first-topup'); setFirstRunTopUp(false); void loadWallet(); setCustomerPage({ name: 'pincode' }); }} />;

  const handleHome = () => {
    if (role === 'customer') {
      setCustomerPage({ name: 'pincode' });
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
    setResolvedLocation(null);
    setInitialPincode('');
    setActivePincode('');
    setWallet(null);
    setWalletTransactions([]);
    setCustomerPage({ name: 'pincode' });
    if (supabase) await supabase.auth.signOut();
  };

  const handleSelectCook = (cook: CookProfile) => {
    setCustomerPage({ name: 'checkout', cookId: cook.id });
  };

  const handleBackToCooks = () => {
    const pincode = resolvedLocation?.pincode || activePincode;
    setCustomerPage(pincode ? { name: 'discovery', pincode } : { name: 'pincode' });
  };

  const handleSubscribe = async (data: {
    cook: CookProfile;
    planType: PlanType;
    deliveryMode: DeliveryMode;
  }) => {
    const { cook, planType, deliveryMode } = data;
    if (!canAcceptSubscription(cook.activeSubscribers, 1, cook.capacity)) return;
    const planDays = planType === 'single' ? 1 : planType === 'weekly' ? 7 : 30;
    const planPrice = planType === 'single' ? cook.pricePerMeal : planType === 'weekly' ? cook.weeklyPrice : cook.monthlyPrice;

    const zone = zones.find((z) => z.pincode === cook.pincodes[0]);
    const deliveryFee = getDeliveryFee(deliveryMode, cook.selfDeliveryFee, zone);

    const { data: userData } = await supabase?.auth.getUser() ?? { data: { user: null } };
    const isDemoCook = cook.userId === cook.id;
    // TODO(Razorpay): replace simulated success with payment-order creation and verified webhook confirmation.
    if (isDemoCook) {
      const debitAmount = planPrice;
      if ((wallet?.balance ?? 0) < debitAmount) {
        setWalletFallbackCook(cook);
        setWalletMessage(`Not enough balance for the ${planType} plan. Add ${formatINR(debitAmount - (wallet?.balance ?? 0))} more to continue, or try today's tiffin instead.`);
        setCustomerPage({ name: 'wallet' });
        return;
      }
      if (supabase && userData.user) {
        const { error } = await supabase.rpc('debit_wallet', { customer: userData.user.id, debit_amount: debitAmount, debit_type: planType === 'single' ? 'single_order_debit' : 'subscription_debit', debit_description: planType === 'single' ? 'Single-day tiffin debit' : 'Subscription plan debit' });
        if (error) { setWalletMessage(error.message); setCustomerPage({ name: 'wallet' }); return; }
        await loadWallet();
      }
    }
    if (planType === 'single' && supabase && userData.user && !demoCatalog && !isDemoCook) {
      const handoverCode = generateHandoverCode();
      const { data: createdOrder, error } = await supabase.rpc('create_single_order_with_wallet', { customer: userData.user.id, payload: { cook_id: cook.id, meal_type: 'lunch', delivery_mode: deliveryMode, delivery_date: new Date().toISOString().split('T')[0], meal_price: cook.pricePerMeal, handover_code: handoverCode } });
      if (error) { setWalletFallbackCook(cook); setWalletMessage(error.message.includes('INSUFFICIENT_WALLET_BALANCE') ? `Not enough wallet balance. Add money to order today's tiffin for ${formatINR(cook.pricePerMeal)}.` : error.message); setCustomerPage({ name: 'wallet' }); return; }
      await loadWallet();
      const order: Order = { id: createdOrder.id, orderType: 'single', customerId: userData.user.id, cookId: cook.id, date: new Date().toISOString().split('T')[0], deliveryDate: new Date().toISOString().split('T')[0], mealSlot: 'lunch', status: 'pending', deliveryMode, customerName: '', cookName: cook.name, pincode: cook.pincodes[0], address: '', handoverCode };
      setOrders((current) => [...current, order]);
      setCustomerPage({ name: 'singleTracking', orderId: order.id });
      return;
    }
    if (planType !== 'single' && supabase && userData.user && !demoCatalog && !isDemoCook) {
      const { error } = await supabase.rpc('create_subscription_with_wallet', {
        customer: userData.user.id,
        payload: { cook_id: cook.id, plan_type: planType, meal_type: 'lunch', start_date: new Date().toISOString().split('T')[0], end_date: new Date(Date.now() + planDays * 86400000).toISOString().split('T')[0], delivery_mode: deliveryMode, price_per_meal: cook.pricePerMeal, plan_amount: planPrice, delivery_fee: deliveryFee, platform_fee_per_meal: PLATFORM_FEE_PER_MEAL },
      });
      if (error) { setWalletMessage(error.message.includes('INSUFFICIENT_WALLET_BALANCE') ? `Not enough balance for the ${planType} plan. Add money to continue.` : error.message); setCustomerPage({ name: 'wallet' }); return; }
      await loadWallet();
    }

    if (planType === 'single') {
      const order: Order = { id: `single-${Date.now()}`, orderType: 'single', customerId: CURRENT_USER_ID, cookId: cook.id, date: new Date().toISOString().split('T')[0], deliveryDate: new Date().toISOString().split('T')[0], mealSlot: 'lunch', status: 'pending', deliveryMode, customerName: '', cookName: cook.name, pincode: cook.pincodes[0], address: '', handoverCode: generateHandoverCode() };
      setOrders((current) => [...current, order]);
      setCustomerPage({ name: 'singleTracking', orderId: order.id });
      return;
    }
    const newSub: Subscription = {
      id: 'sub-' + Date.now(),
      customerId: CURRENT_USER_ID,
      cookId: cook.id,
      planType,
      mealSlot: 'lunch',
      deliveryMode,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + planDays * 86400000)
        .toISOString()
        .split('T')[0],
      daysTotal: planDays,
      daysRemaining: planDays,
      daysCompleted: 0,
      mealsPerDay: 1,
      pricePerMeal: cook.pricePerMeal,
      deliveryFee,
      platformFee: PLATFORM_FEE_PER_MEAL,
      totalPaid: planPrice,
      status: 'active',
      todayCode: generateHandoverCode(),
      todayStatus: 'pending',
      todaySkipped: false,
    };

    setSubscriptions([newSub]);
    setCustomerPage({ name: 'dashboard' });
  };

  const currentSubscription = subscriptions.find((s) => s.status === 'active' && s.planType !== 'single');
  const currentCook = currentSubscription
    ? cooks.find((c) => c.id === currentSubscription.cookId)
    : null;

  const handleOpenWallet = () => setCustomerPage({ name: 'wallet' });
  const handleOpenProfile = () => setCustomerPage({ name: 'profile' });
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
  const handleCookOnboard = async (profile: Partial<CookProfile>) => {
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
        if (!error) void loadWallet();
      });
    }
  };

  const cookOrders = orders.filter((o) => o.cookId === CURRENT_COOK_ID);

  return (
    <div className="min-h-screen bg-paper">
      <TopNav role={role} onHome={handleHome} onWallet={handleOpenWallet} hasActivePlan={Boolean(currentSubscription)} displayName={profile.fullName} onProfile={role === 'customer' ? handleOpenProfile : undefined} rightSlot={<button className="min-h-11 px-2 text-xs text-ink-muted" onClick={handleSignOut}>Sign out</button>} />

      {role === 'customer' && (
        <>
          {customerPage.name === 'pincode' && (
            <PincodeEntry
              onSubmit={handlePincodeSubmit}
              initialPincode={initialPincode}
            />
          )}
          {customerPage.name === 'discovery' && (
            <CookDiscovery
              pincode={customerPage.pincode}
              cooks={cooks}
              loading={discoveryLoading}
              onBack={() => setCustomerPage({ name: 'pincode' })}
              onSelectCook={handleSelectCook}
              userLocation={resolvedLocation}
            />
          )}
          {customerPage.name === 'checkout' && (() => {
            const cook = cooks.find((c) => c.id === customerPage.cookId);
            if (!cook) return null;
            const zone = zones.find((z) =>
              cook.pincodes.includes(z.pincode),
            );
            return (
              <CookProfileCheckout
                cook={cook}
                zone={zone}
                onBack={() =>
                  setCustomerPage({
                    name: 'discovery',
                    pincode: cook.pincodes[0],
                  })
                }
                onSubscribe={handleSubscribe}
              />
            );
          })()}
          {customerPage.name === 'dashboard' && (
            <CustomerDashboard
              subscription={currentSubscription || null}
              cook={currentCook ?? null}
              onSubscribe={() => setCustomerPage({ name: 'pincode' })}
              onUpdateSubscription={handleUpdateSubscription}
              onRate={handleRate}
              orders={orders}
            />
          )}
          {customerPage.name === 'wallet' && (
            <SubscriptionWallet
              subscription={currentSubscription || null}
              cook={currentCook ?? null}
              onBackToCooks={handleBackToCooks}
              onViewCook={handleViewCookProfile}
              orders={orders.filter((order) => order.subscriptionId === currentSubscription?.id)}
              wallet={wallet}
              transactions={walletTransactions}
              onTopUp={() => setFirstRunTopUp(true)}
              message={walletMessage}
              onTrySingle={() => { if (walletFallbackCook) setCustomerPage({ name: 'checkout', cookId: walletFallbackCook.id }); }}
            />
          )}
          {customerPage.name === 'profile' && <ProfilePage profile={profile} wallet={wallet} onBack={handleBackToCooks} onSaved={setProfile} />}
          {customerPage.name === 'singleTracking' && (() => { const order = orders.find((item) => item.id === customerPage.orderId); return order ? <OrderTracking order={order} cook={cooks.find((item) => item.id === order.cookId) ?? null} onBack={handleBackToCooks} /> : null; })()}
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
        </>
      )}

    </div>
  );
}
