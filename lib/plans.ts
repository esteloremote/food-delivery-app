export type SubscriptionPlanId = "monthly" | "biannual" | "yearly";

export interface SubscriptionPlan {
  id: SubscriptionPlanId;
  label: string;
  durationMonths: number;
  price: number;
  monthlyEquivalent: number;
  badge?: string;
  description: string;
}

export const SUBSCRIPTION_PLANS: Record<SubscriptionPlanId, SubscriptionPlan> = {
  monthly: {
    id: "monthly",
    label: "Μηνιαίο",
    durationMonths: 1,
    price: 49,
    monthlyEquivalent: 49,
    description: "Ευελιξία χωρίς δέσμευση, ανά κατάστημα",
  },
  biannual: {
    id: "biannual",
    label: "Εξαμηνιαίο",
    durationMonths: 6,
    price: 249,
    monthlyEquivalent: 41.5,
    badge: "Εξοικονόμηση 15%",
    description: "6 μήνες πρόσβασης (σχεδόν 1 μήνας δώρο)",
  },
  yearly: {
    id: "yearly",
    label: "Ετήσιο",
    durationMonths: 12,
    price: 449,
    monthlyEquivalent: 37.4,
    badge: "Καλύτερη Επιλογή (-24%)",
    description: "12 μήνες πρόσβασης (~3 μήνες δώρο)",
  },
};

export const PLAN_LIST = Object.values(SUBSCRIPTION_PLANS);