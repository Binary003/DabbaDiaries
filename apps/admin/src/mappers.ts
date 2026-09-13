import type { CookProfile, DeliveryZone, Order } from '@maas/core';

export function mapCook(row: Record<string, unknown>): CookProfile {
  return {
    id: String(row.id), userId: String(row.user_id), name: String(row.display_name ?? 'Home kitchen'), tagline: String(row.tagline ?? ''), bio: String(row.bio ?? ''),
    kitchenPhoto: String(row.kitchen_photo_url ?? ''), pincodes: (row.pincodes as string[] | null) ?? [], rating: Number(row.rating_avg ?? 0), ratingCount: Number(row.rating_count ?? 0), weeklyMenu: (row.weekly_menu as CookProfile['weeklyMenu']) ?? [], vegType: (row.veg_type as CookProfile['vegType']) ?? 'mixed',
    pricePerMeal: Number(row.price_per_meal ?? 0), weeklyPrice: Number(row.weekly_price ?? 0), monthlyPrice: Number(row.monthly_price ?? 0), capacity: Number(row.daily_capacity ?? 1), capacityCap: 20, selfDelivery: Boolean(row.self_delivery_enabled), selfDeliveryFee: Number(row.self_delivery_fee ?? 0), fssaiTier: 'basic-registration', fssaiNumber: String(row.fssai_number ?? ''), verificationStatus: row.status === 'active' ? 'approved' : row.status === 'rejected' ? 'rejected' : 'pending', status: row.status as CookProfile['status'], rejectionReason: row.rejection_reason ? String(row.rejection_reason) : undefined, zoneId: row.zone_id ? String(row.zone_id) : undefined, latitude: row.latitude == null ? undefined : Number(row.latitude), longitude: row.longitude == null ? undefined : Number(row.longitude), mealsPerDay: 1, activeSubscribers: Number(row.active_subscribers ?? 0),
  };
}

export function mapZone(row: Record<string, unknown>): DeliveryZone {
  return { id: String(row.id), name: String(row.locality ?? row.pincode), locality: String(row.locality ?? ''), pincode: String(row.pincode), hasPlatformDelivery: Boolean(row.has_platform_delivery), assignedPartnerId: row.assigned_partner_id ? String(row.assigned_partner_id) : undefined, deliveryFee: Number(row.delivery_fee ?? 0), deliveryWindow: '', activeOrders: 0 };
}

export function mapOrder(row: Record<string, unknown>): Order {
  const customer = (row.customer as Record<string, unknown> | null) ?? {};
  const locality = String(customer.locality ?? '');
  return { id: String(row.id), subscriptionId: row.subscription_id ? String(row.subscription_id) : undefined, customerId: String(row.customer_id), cookId: String(row.cook_id), date: String(row.delivery_date), deliveryDate: String(row.delivery_date), mealSlot: row.meal_type as Order['mealSlot'], status: row.status as Order['status'], handoverCode: undefined, deliveryMode: row.delivery_mode as Order['deliveryMode'], zoneId: row.delivery_zone_id ? String(row.delivery_zone_id) : undefined, customerName: String(customer.full_name ?? customer.name ?? ''), customerPhone: customer.phone ? String(customer.phone) : undefined, customerLocality: locality || undefined, cookName: '', pincode: customer.pincode ? String(customer.pincode) : '', address: locality || undefined };
}