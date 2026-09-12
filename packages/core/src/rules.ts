import type { DeliveryMode, DeliveryZone, FeeSplit } from './types';

export interface PaymentBreakdownItem { label: string; amount: number; }
export interface PaymentBreakdown {
    kind?: 'single_order' | 'subscription' | 'payment';
    cookName?: string;
    planDays?: number;
    items: PaymentBreakdownItem[];
    total: number;
}

export const DAILY_CAPACITY_LIMIT = 20;

export function getDistanceKm(latitude1: number, longitude1: number, latitude2: number, longitude2: number): number {
    const earthRadiusKm = 6371;
    const latitudeDelta = (latitude2 - latitude1) * Math.PI / 180;
    const longitudeDelta = (longitude2 - longitude1) * Math.PI / 180;
    const a = Math.sin(latitudeDelta / 2) ** 2
        + Math.cos(latitude1 * Math.PI / 180) * Math.cos(latitude2 * Math.PI / 180) * Math.sin(longitudeDelta / 2) ** 2;
    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function generateHandoverCode(random = Math.random): string {
    return String(Math.floor(1000 + random() * 9000));
}

export function validateHandoverCode(expected: string, submitted: string): boolean {
    return /^\d{4}$/.test(submitted) && submitted === expected;
}

export function canAcceptSubscription(activeMeals: number, requestedMeals: number, capacity: number): boolean {
    return Number.isInteger(activeMeals) && Number.isInteger(requestedMeals) &&
        Number.isInteger(capacity) && requestedMeals > 0 && activeMeals + requestedMeals <= capacity && capacity <= DAILY_CAPACITY_LIMIT;
}

export function validateCapacity(capacity: number): { valid: true } | { valid: false; reason: string } {
    if (!Number.isInteger(capacity) || capacity < 1) return { valid: false, reason: 'Capacity must be at least 1.' };
    if (capacity > DAILY_CAPACITY_LIMIT) return { valid: false, reason: `Capacity cannot exceed ${DAILY_CAPACITY_LIMIT} meals per day.` };
    return { valid: true };
}

export function getDeliveryFee(mode: DeliveryMode, cookFee: number, zone?: DeliveryZone): number {
    if (mode === 'self-pickup') return 0;
    if (mode === 'cook-delivery') return cookFee;
    if (!zone?.hasPlatformDelivery || !zone.assignedPartnerId) return 0;
    return zone.deliveryFee;
}

export function isDeliveryModeAvailable(mode: DeliveryMode, cookOffersDelivery: boolean, zone?: DeliveryZone): boolean {
    if (mode === 'self-pickup') return true;
    if (mode === 'cook-delivery') return cookOffersDelivery;
    return Boolean(zone?.hasPlatformDelivery && zone.assignedPartnerId);
}

export function calculateFeeSplit(mealPrice: number, meals: number, platformFeePerMeal: number, mode: DeliveryMode, deliveryFee: number): FeeSplit {
    const mealTotal = mealPrice * meals;
    const platformFee = platformFeePerMeal * meals;
    const deliveryTotal = deliveryFee * meals;
    return {
        mealTotal,
        platformFee,
        deliveryFee: deliveryTotal,
        customerTotal: mealTotal + platformFee + deliveryTotal,
        cookPayout: mealTotal + (mode === 'cook-delivery' ? deliveryTotal : 0),
        platformDeliveryCollection: mode === 'platform-delivery' ? deliveryTotal : 0,
    };
}

export function parsePaymentBreakdown(rawDescription: string | null | undefined): PaymentBreakdown {
    if (!rawDescription) return { items: [], total: 0 };

    try {
        const parsed = JSON.parse(rawDescription) as Record<string, unknown>;
        const kind = typeof parsed.kind === 'string' && (parsed.kind === 'single_order' || parsed.kind === 'subscription')
            ? parsed.kind
            : 'payment';
        const cookName = typeof parsed.cookName === 'string' ? parsed.cookName : undefined;
        const planDays = typeof parsed.planDays === 'number' ? parsed.planDays : undefined;
        const items: PaymentBreakdownItem[] = [];

        const toNumber = (value: unknown): number | null => {
            const numeric = Number(value);
            return Number.isFinite(numeric) ? numeric : null;
        };

        const mealValue = toNumber(parsed.mealPrice ?? parsed.meal_price);
        const platformValue = toNumber(parsed.platformFee ?? parsed.platform_fee);
        const deliveryValue = toNumber(parsed.deliveryFee ?? parsed.delivery_fee);
        const totalValue = toNumber(parsed.total ?? parsed.amount) ?? 0;

        if (Array.isArray(parsed.items)) {
            for (const entry of parsed.items) {
                if (entry && typeof entry === 'object') {
                    const item = entry as Record<string, unknown>;
                    const label = typeof item.label === 'string' ? item.label : 'Charge';
                    const amount = toNumber(item.amount);
                    if (amount !== null) items.push({ label, amount });
                }
            }
        }

        if (items.length === 0) {
            if (mealValue !== null && mealValue > 0) items.push({ label: 'Meal price', amount: mealValue });
            if (platformValue !== null && platformValue > 0) items.push({ label: 'Platform fee', amount: platformValue });
            if (deliveryValue !== null && deliveryValue > 0) items.push({ label: 'Delivery fee', amount: deliveryValue });
        }

        if (typeof parsed.total === 'number' || typeof parsed.amount === 'number') {
            return {
                kind,
                cookName,
                planDays,
                items: items.length > 0 ? items : [{ label: 'Payment', amount: totalValue }],
                total: totalValue,
            };
        }

        const computedTotal = items.reduce((sum, item) => sum + item.amount, 0);
        return {
            kind,
            cookName,
            planDays,
            items: items.length > 0 ? items : [{ label: 'Payment', amount: computedTotal }],
            total: computedTotal,
        };
    } catch {
        return { kind: 'payment', items: [{ label: 'Payment', amount: 0 }], total: 0 };
    }
}