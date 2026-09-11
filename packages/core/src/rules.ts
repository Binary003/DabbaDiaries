import type { DeliveryMode, DeliveryZone, FeeSplit } from './types';

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