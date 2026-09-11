export type Role = 'cook' | 'customer' | 'admin';
export type VegType = 'veg' | 'non-veg' | 'mixed';
export type DeliveryMode = 'self-pickup' | 'cook-delivery' | 'platform-delivery';
export type PlanType = 'single' | 'weekly' | 'monthly';
export type MealSlot = 'lunch' | 'dinner';
export type OrderStatus = 'pending' | 'confirmed' | 'skipped' | 'delivered' | 'cancelled';
export type FssaiTier = 'basic-registration' | 'state-license' | 'central-license';

export interface User { id: string; name: string; phone: string; role: Role; pincode: string; locality: string; email?: string; address?: string; }
export interface DayMenu { day: string; dish: string; description: string; vegType: VegType; }
export interface CookProfile {
  id: string; userId: string; name: string; tagline: string; bio: string; kitchenPhoto: string;
  kitchenPhotoUrl?: string; pincodes: string[]; locality?: string; rating: number; ratingCount: number;
  weeklyMenu: DayMenu[]; vegType: VegType; pricePerMeal: number; weeklyPrice: number; monthlyPrice: number;
  capacity: number; capacityCap: number; dailyCapacity?: number; selfDelivery: boolean; selfDeliveryFee: number;
  fssaiTier: FssaiTier; fssaiNumber: string; verificationStatus: 'pending' | 'approved' | 'rejected';
  status?: 'pending' | 'active' | 'paused'; rejectionReason?: string; zoneId?: string; latitude?: number; longitude?: number; mealsPerDay: number; activeSubscribers: number;
}
export interface Subscription {
  id: string; customerId: string; cookId: string; planType: PlanType; mealSlot: MealSlot; deliveryMode: DeliveryMode;
  startDate: string; endDate: string; daysTotal: number; daysRemaining: number; daysCompleted: number; mealsPerDay: number;
  pricePerMeal: number; deliveryFee: number; platformFee: number; totalPaid: number; status: 'active' | 'ended' | 'cancelled';
  todayCode?: string; todayStatus: OrderStatus; todaySkipped: boolean; ratingGiven?: number; pausedDays?: string[];
}
export interface Order {
  id: string; subscriptionId?: string; orderType?: 'subscription' | 'single'; customerId: string; cookId: string; date: string; deliveryDate?: string; mealSlot: MealSlot;
  status: OrderStatus; handoverCode?: string; handoverConfirmedAt?: string; deliveryMode: DeliveryMode; zoneId?: string;
  customerName: string; cookName: string; pincode: string; address?: string;
}
export interface DeliveryZone { id: string; name: string; locality?: string; pincode: string; hasPlatformDelivery: boolean; assignedPartnerId?: string; deliveryPartner?: string; deliveryFee: number; deliveryWindow: string; activeOrders: number; }
export interface Payment { id: string; subscriptionId: string; customerId: string; cookId: string; amount: number; platformFee: number; deliveryFee: number; cookEarning: number; cookPayout?: number; deliveryMode: DeliveryMode; date: string; status: 'pending' | 'released' | 'failed'; }
export interface Rating { id: string; orderId?: string; subscriptionId?: string; customerId: string; cookId: string; stars: number; comment?: string; date: string; }
export interface FeeSplit { mealTotal: number; platformFee: number; deliveryFee: number; customerTotal: number; cookPayout: number; platformDeliveryCollection: number; }
export type WalletTransactionType = 'topup' | 'subscription_debit' | 'single_order_debit' | 'meal_release';
export interface Wallet { id: string; userId: string; balance: number; }
export interface WalletTransaction { id: string; type: WalletTransactionType; amount: number; relatedSubscriptionId?: string; relatedOrderId?: string; description: string; createdAt: string; }
