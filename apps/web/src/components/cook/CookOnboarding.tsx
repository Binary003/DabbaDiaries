import { useState } from 'react';
import {
  Camera,
  ShieldCheck,
  AlertCircle,
  Check,
  Leaf,
  Drumstick,
} from 'lucide-react';
import { type CookProfile, type DayMenu, type VegType, type FssaiTier } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Panel } from '@/components/ui/Panel';
import { DAYS, CAPACITY_CAP, PLATFORM_FEE_PER_MEAL } from '@/data';
import { formatINR } from '@/utils';

interface CookOnboardingProps {
  onComplete: (profile: Partial<CookProfile> & { payout?: { upiId?: string; accountNumber?: string; ifsc?: string } }) => void;
  existingProfile?: CookProfile;
}

export function CookOnboarding({ onComplete, existingProfile }: CookOnboardingProps) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState(existingProfile?.name || '');
  const [tagline, setTagline] = useState(existingProfile?.tagline || '');
  const [bio, setBio] = useState(existingProfile?.bio || '');
  const [pincodes, setPincodes] = useState(existingProfile?.pincodes.join(', ') || '');
  const [kitchenPhoto, setKitchenPhoto] = useState(
    existingProfile?.kitchenPhoto ||
    'https://images.pexels.com/photos/37330104/pexels-photo-37330104.jpeg?auto=compress&cs=tinysrgb&h=400&w=400',
  );
  const [fssaiTier, setFssaiTier] = useState<FssaiTier>(
    existingProfile?.fssaiTier || 'basic-registration',
  );
  const [fssaiNumber, setFssaiNumber] = useState(
    existingProfile?.fssaiNumber || '',
  );
  const [weeklyMenu, setWeeklyMenu] = useState<DayMenu[]>(
    existingProfile?.weeklyMenu || DAYS.map((day) => ({
      day,
      dish: '',
      description: '',
      vegType: 'veg' as VegType,
    })),
  );
  const [pricePerMeal, setPricePerMeal] = useState(
    existingProfile?.pricePerMeal || 70,
  );
  const [weeklyPrice, setWeeklyPrice] = useState(
    existingProfile?.weeklyPrice || 700,
  );
  const [monthlyPrice, setMonthlyPrice] = useState(
    existingProfile?.monthlyPrice || 2700,
  );
  const [capacity, setCapacity] = useState(existingProfile?.capacity || 15);
  const [capacityError, setCapacityError] = useState('');
  const [selfDelivery, setSelfDelivery] = useState(
    existingProfile?.selfDelivery || false,
  );
  const [selfDeliveryFee, setSelfDeliveryFee] = useState(
    existingProfile?.selfDeliveryFee || 0,
  );
  const [upiId, setUpiId] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');

  const handleCapacityChange = (val: number) => {
    if (val > CAPACITY_CAP) {
      setCapacity(CAPACITY_CAP);
      setCapacityError(
        `Home kitchens can't serve more than ${CAPACITY_CAP} meals a day. This is a safety limit, not a suggestion.`,
      );
    } else if (val < 1) {
      setCapacity(1);
      setCapacityError('');
    } else {
      setCapacity(val);
      setCapacityError('');
    }
  };

  const updateMenuItem = (idx: number, field: keyof DayMenu, value: string) => {
    setWeeklyMenu((prev) =>
      prev.map((m, i) =>
        i === idx ? { ...m, [field]: value } : m,
      ),
    );
  };

  const canProceedStep1 = name.trim() && tagline.trim() && pincodes.trim();
  const canProceedStep2 = fssaiNumber.trim() && kitchenPhoto;
  const canProceedStep3 = weeklyMenu.every((m) => m.dish.trim());

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 animate-fade-in">
      <h1 className="mb-2 font-display text-2xl font-semibold text-ink">
        {existingProfile ? 'Edit your kitchen profile' : 'Set up your kitchen'}
      </h1>
      <p className="mb-6 text-sm text-ink-muted">
        Tell customers about your cooking. This takes about 3 minutes.
      </p>

      {/* Step indicator */}
      <div className="mb-8 flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex flex-1 items-center gap-2">
            <div
              className={[
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium transition-colors',
                s < step
                  ? 'bg-leaf text-white'
                  : s === step
                    ? 'bg-marigold text-white'
                    : 'bg-paper-200 text-ink-muted',
              ].join(' ')}
            >
              {s < step ? <Check size={16} /> : s}
            </div>
            {s < 3 && (
              <div
                className={[
                  'h-0.5 flex-1 rounded-full transition-colors',
                  s < step ? 'bg-leaf' : 'bg-paper-200',
                ].join(' ')}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Basic profile */}
      {step === 1 && (
        <div className="space-y-5 animate-fade-in">
          <Panel>
            <h2 className="mb-4 font-display text-lg font-semibold text-ink">
              About your kitchen
            </h2>
            <div className="space-y-4">
              <Input
                label="Your name (as customers will see it)"
                name="name"
                placeholder="e.g. Lakshmi Aunty"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Input
                label="Tagline"
                name="tagline"
                placeholder="e.g. Andhra meals, the way amma makes them"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
              />
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink">
                  About your cooking
                </label>
                <textarea
                  className="w-full rounded-md border border-steel/25 bg-white/60 px-3 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-marigold focus:bg-white focus:outline-none transition-colors"
                  rows={3}
                  placeholder="Tell customers about your style, ingredients, and what makes your meals special."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                />
              </div>
              <Input
                label="Pincodes you serve (comma-separated)"
                name="pincodes"
                placeholder="e.g. 560001, 560002"
                value={pincodes}
                onChange={(e) => setPincodes(e.target.value)}
                hint="Customers in these pincodes will see your kitchen."
              />
            </div>
          </Panel>

          <Panel>
            <h2 className="mb-2 font-display text-lg font-semibold text-ink">Cook payout account</h2>
            <p className="mb-4 text-sm text-ink-muted">Mock setup for held cook transfers. You can use UPI or bank details.</p>
            <div className="space-y-3">
              <Input label="UPI ID (optional)" name="upiId" placeholder="name@upi" value={upiId} onChange={(e) => setUpiId(e.target.value)} />
              <div className="grid gap-3 sm:grid-cols-2"><Input label="Bank account (optional)" name="accountNumber" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} /><Input label="IFSC" name="ifsc" value={ifsc} onChange={(e) => setIfsc(e.target.value)} /></div>
            </div>
          </Panel>

          <div className="flex justify-end">
            <Button
              onClick={() => setStep(2)}
              disabled={!canProceedStep1}
              size="lg"
            >
              Continue to verification
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: FSSAI + kitchen photo */}
      {step === 2 && (
        <div className="space-y-5 animate-fade-in">
          <Panel>
            <h2 className="mb-4 font-display text-lg font-semibold text-ink">
              FSSAI registration
            </h2>
            <div className="mb-4 rounded-lg border border-leaf/20 bg-leaf-50 p-3">
              <p className="flex items-start gap-2 text-sm text-leaf-dark">
                <ShieldCheck size={16} className="mt-0.5 shrink-0" />
                <span>
                  We only accept <strong>Basic Registration</strong> (for small
                  home kitchens). State and Central Licenses are for commercial
                  food businesses — this platform is for home cooks, not
                  restaurants.
                </span>
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink">
                  FSSAI tier
                </label>
                <div className="space-y-2">
                  {(
                    [
                      ['basic-registration', 'Basic Registration', 'For small home kitchens — eligible'],
                      ['state-license', 'State License', 'For mid-size commercial — not eligible'],
                      ['central-license', 'Central License', 'For large commercial — not eligible'],
                    ] as [FssaiTier, string, string][]
                  ).map(([tier, label, desc]) => (
                    <button
                      key={tier}
                      onClick={() => setFssaiTier(tier)}
                      disabled={tier !== 'basic-registration'}
                      className={[
                        'flex w-full items-center justify-between rounded-md border-2 p-3 text-left transition-all',
                        tier === 'basic-registration'
                          ? fssaiTier === tier
                            ? 'border-marigold bg-marigold-50/50'
                            : 'border-steel/15 bg-paper-50 hover:border-steel/30'
                          : 'border-steel/10 bg-paper-200/30 opacity-50 cursor-not-allowed',
                      ].join(' ')}
                    >
                      <div>
                        <p className="text-sm font-medium text-ink">{label}</p>
                        <p className="text-xs text-ink-muted">{desc}</p>
                      </div>
                      {fssaiTier === tier && (
                        <Check size={16} className="text-marigold" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
              <Input
                label="FSSAI registration number"
                name="fssai"
                placeholder="e.g. FSSAI-BLR-2024-0042"
                value={fssaiNumber}
                onChange={(e) => setFssaiNumber(e.target.value)}
              />
            </div>
          </Panel>

          <Panel>
            <h2 className="mb-4 font-display text-lg font-semibold text-ink">
              Kitchen photo
            </h2>
            <div className="flex items-center gap-4">
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-steel/15">
                <img
                  src={kitchenPhoto}
                  alt="Kitchen"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex-1">
                <p className="mb-2 text-sm text-ink-muted">
                  A photo of your kitchen helps customers trust you. We'll use
                  a placeholder for now.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setKitchenPhoto(
                      'https://images.pexels.com/photos/11011089/pexels-photo-11011089.jpeg?auto=compress&cs=tinysrgb&h=400&w=400',
                    )
                  }
                >
                  <Camera size={14} />
                  Use sample photo
                </Button>
              </div>
            </div>
          </Panel>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button
              onClick={() => setStep(3)}
              disabled={!canProceedStep2}
              size="lg"
            >
              Continue to menu &amp; pricing
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Menu, pricing, capacity */}
      {step === 3 && (
        <div className="space-y-5 animate-fade-in">
          <Panel>
            <h2 className="mb-4 font-display text-lg font-semibold text-ink">
              Weekly menu
            </h2>
            <div className="space-y-3">
              {weeklyMenu.map((menu, i) => (
                <div
                  key={menu.day}
                  className="flex flex-col gap-2 rounded-md border border-steel/15 p-3 sm:flex-row sm:items-center"
                >
                  <span className="w-10 shrink-0 font-display text-sm font-semibold text-spice">
                    {menu.day}
                  </span>
                  <input
                    type="text"
                    placeholder="Dish name"
                    value={menu.dish}
                    onChange={(e) => updateMenuItem(i, 'dish', e.target.value)}
                    className="flex-1 rounded-md border border-steel/25 bg-white/60 px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-marigold focus:bg-white focus:outline-none transition-colors"
                  />
                  <div className="flex gap-1">
                    <button
                      onClick={() => updateMenuItem(i, 'vegType', 'veg')}
                      className={[
                        'flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors',
                        menu.vegType === 'veg'
                          ? 'border-leaf bg-leaf-50 text-leaf-dark'
                          : 'border-steel/15 text-ink-muted hover:border-steel/30',
                      ].join(' ')}
                    >
                      <Leaf size={12} /> Veg
                    </button>
                    <button
                      onClick={() => updateMenuItem(i, 'vegType', 'non-veg')}
                      className={[
                        'flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors',
                        menu.vegType === 'non-veg'
                          ? 'border-rust bg-rust-50 text-rust-dark'
                          : 'border-steel/15 text-ink-muted hover:border-steel/30',
                      ].join(' ')}
                    >
                      <Drumstick size={12} /> Non-veg
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <h2 className="mb-4 font-display text-lg font-semibold text-ink">
              Pricing
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Input
                label="Price per meal"
                name="pricePerMeal"
                type="number"
                prefix="₹"
                value={pricePerMeal}
                onChange={(e) => setPricePerMeal(Number(e.target.value))}
              />
              <Input
                label="Weekly plan price"
                name="weeklyPrice"
                type="number"
                prefix="₹"
                value={weeklyPrice}
                onChange={(e) => setWeeklyPrice(Number(e.target.value))}
              />
              <Input
                label="Monthly plan price"
                name="monthlyPrice"
                type="number"
                prefix="₹"
                value={monthlyPrice}
                onChange={(e) => setMonthlyPrice(Number(e.target.value))}
              />
            </div>
            <p className="mt-3 text-xs text-ink-muted">
              Platform fee of {formatINR(PLATFORM_FEE_PER_MEAL)}/meal is charged
              separately to the customer and goes to the platform — it doesn't
              come out of your meal price.
            </p>
          </Panel>

          <Panel>
            <h2 className="mb-4 font-display text-lg font-semibold text-ink">
              Daily capacity &amp; delivery
            </h2>
            <Input
              label="Daily meal capacity"
              name="capacity"
              type="number"
              value={capacity}
              onChange={(e) => handleCapacityChange(Number(e.target.value))}
              suffix={`/ ${CAPACITY_CAP} max`}
              error={capacityError}
              hint={!capacityError ? `Home kitchens are capped at ${CAPACITY_CAP} meals/day for food safety.` : undefined}
            />
            {capacityError && (
              <div className="mt-2 flex items-start gap-2 rounded-md border border-rust/20 bg-rust-50 p-2.5">
                <AlertCircle size={16} className="mt-0.5 shrink-0 text-rust" />
                <p className="text-xs text-rust-dark">{capacityError}</p>
              </div>
            )}

            <div className="mt-4 border-t border-steel/15 pt-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selfDelivery}
                  onChange={(e) => setSelfDelivery(e.target.checked)}
                  className="h-4 w-4 rounded border-steel/30 text-marigold focus:ring-marigold"
                />
                <span className="text-sm font-medium text-ink">
                  I can deliver meals myself
                </span>
              </label>
              {selfDelivery && (
                <div className="mt-3 animate-slide-up">
                  <Input
                    label="Your delivery fee per meal"
                    name="selfDeliveryFee"
                    type="number"
                    prefix="₹"
                    value={selfDeliveryFee}
                    onChange={(e) => setSelfDeliveryFee(Number(e.target.value))}
                    hint="This fee goes entirely to you — the platform never takes a cut."
                  />
                </div>
              )}
            </div>
          </Panel>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button
              onClick={() =>
                onComplete({
                  name,
                  tagline,
                  bio,
                  pincodes: pincodes.split(',').map((p) => p.trim()),
                  kitchenPhoto,
                  fssaiTier,
                  fssaiNumber,
                  weeklyMenu,
                  pricePerMeal,
                  weeklyPrice,
                  monthlyPrice,
                  capacity,
                  capacityCap: CAPACITY_CAP,
                  selfDelivery,
                  selfDeliveryFee,
                  payout: { upiId: upiId || undefined, accountNumber: accountNumber || undefined, ifsc: ifsc || undefined },
                })
              }
              disabled={!canProceedStep3}
              size="lg"
            >
              <Check size={18} />
              Save kitchen profile
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
