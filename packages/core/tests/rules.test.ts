import { describe, expect, it } from 'vitest';
import {
    calculateFeeSplit,
    canAcceptSubscription,
    DAILY_CAPACITY_LIMIT,
    generateHandoverCode,
    getDistanceKm,
    validateCapacity,
    validateHandoverCode,
} from '../src';

describe('handover codes', () => {
    it('generates exactly four digits and rejects mismatches', () => {
        expect(generateHandoverCode(() => 0)).toBe('1000');
        expect(validateHandoverCode('4827', '4827')).toBe(true);
        expect(validateHandoverCode('4827', '4828')).toBe(false);
        expect(validateHandoverCode('4827', '482')).toBe(false);
    });
});

describe('capacity rules', () => {
    it('allows the boundary and rejects overflow', () => {
        expect(validateCapacity(DAILY_CAPACITY_LIMIT)).toEqual({ valid: true });
        expect(validateCapacity(DAILY_CAPACITY_LIMIT + 1).valid).toBe(false);
        expect(canAcceptSubscription(19, 1, 20)).toBe(true);
        expect(canAcceptSubscription(20, 1, 20)).toBe(false);
    });
});

describe('fee splits', () => {
    it.each([
        ['self-pickup', 0, 700, 150, 0],
        ['cook-delivery', 20, 700, 150, 200],
        ['platform-delivery', 30, 700, 150, 0],
    ] as const)('%s keeps the fee flows separate', (mode, delivery, mealTotal, platformFee, cookDelivery) => {
        const split = calculateFeeSplit(70, 10, 15, mode, delivery);
        expect(split.mealTotal).toBe(mealTotal);
        expect(split.platformFee).toBe(platformFee);
        expect(split.deliveryFee).toBe(delivery * 10);
        expect(split.customerTotal).toBe(mealTotal + platformFee + delivery * 10);
        expect(split.cookPayout).toBe(mealTotal + cookDelivery);
        expect(split.platformDeliveryCollection).toBe(mode === 'platform-delivery' ? 300 : 0);
    });
});

describe('distance calculation', () => {
    it('calculates the known distance between Bengaluru and Chennai', () => {
        expect(getDistanceKm(12.9716, 77.5946, 13.0827, 80.2707)).toBeCloseTo(290, 0);
    });

    it('returns zero for identical coordinates', () => {
        expect(getDistanceKm(12.9716, 77.5946, 12.9716, 77.5946)).toBe(0);
    });
});