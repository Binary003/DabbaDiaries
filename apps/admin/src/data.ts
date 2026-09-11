import type { CookProfile, DeliveryZone, Order } from '@maas/core';

export const mockCooks: CookProfile[] = [
    {
        id: 'cook-1', userId: 'cook-user-1', name: 'Lakshmi Aunty', tagline: 'Andhra meals, the way amma makes them',
        bio: 'Home-cooked meals made fresh each morning.', kitchenPhoto: 'https://images.pexels.com/photos/37330104/pexels-photo-37330104.jpeg?auto=compress&cs=tinysrgb&h=400&w=400',
        pincodes: ['560001'], rating: 4.8, ratingCount: 127, weeklyMenu: [], vegType: 'mixed', pricePerMeal: 70,
        weeklyPrice: 700, monthlyPrice: 2700, capacity: 15, capacityCap: 20, selfDelivery: true, selfDeliveryFee: 20,
        fssaiTier: 'basic-registration', fssaiNumber: 'FSSAI-BLR-2024-0042', verificationStatus: 'approved', zoneId: 'zone-1', mealsPerDay: 2, activeSubscribers: 12,
    },
    {
        id: 'cook-2', userId: 'cook-user-2', name: 'Radha Kitchen', tagline: 'Pure vegetarian South Indian thali',
        bio: 'A pure vegetarian home kitchen.', kitchenPhoto: 'https://images.pexels.com/photos/11011089/pexels-photo-11011089.jpeg?auto=compress&cs=tinysrgb&h=400&w=400',
        pincodes: ['560001'], rating: 4.9, ratingCount: 89, weeklyMenu: [], vegType: 'veg', pricePerMeal: 65,
        weeklyPrice: 650, monthlyPrice: 2500, capacity: 18, capacityCap: 20, selfDelivery: false, selfDeliveryFee: 0,
        fssaiTier: 'basic-registration', fssaiNumber: 'FSSAI-BLR-2024-0071', verificationStatus: 'pending', zoneId: 'zone-1', mealsPerDay: 2, activeSubscribers: 15,
    },
];

export const mockZones: DeliveryZone[] = [
    { id: 'zone-1', name: 'Brigade Road - MG Road', locality: 'Brigade Road', pincode: '560001', hasPlatformDelivery: true, assignedPartnerId: 'partner-ravi', deliveryPartner: 'Ravi Delivery', deliveryFee: 30, deliveryWindow: '12:30 PM - 1:30 PM', activeOrders: 14 },
    { id: 'zone-2', name: 'Indiranagar - 100ft Road', locality: 'Indiranagar', pincode: '560038', hasPlatformDelivery: false, deliveryFee: 0, deliveryWindow: '', activeOrders: 0 },
];

export const mockOrders: Order[] = [
    { id: 'order-1', subscriptionId: 'sub-1', customerId: 'customer-1', cookId: 'cook-1', date: '2026-09-08', deliveryDate: '2026-09-08', mealSlot: 'lunch', status: 'pending', handoverCode: '4827', deliveryMode: 'platform-delivery', zoneId: 'zone-1', customerName: 'Arjun Mehta', cookName: 'Lakshmi Aunty', pincode: '560001', address: 'Brigade Road' },
];