// Single source of truth for pricing across the application

export const PLAN_PRICES = {
  free: {
    monthly: { price: 0, display: "Free" },
    annual: { price: 0, display: "Free" }
  },
  ultra: {
    monthly: { 
      price: 39.95, 
      display: "$39.95",
      priceId: "price_1SWYfhH8HT0u8xphzdZ9kO1A"
    },
    annual: { 
      price: 23.97, 
      display: "$23.97",
      yearlyTotal: 287.64,
      priceId: "price_1SWYfwH8HT0u8xphFTyNNhan"
    }
  },
} as const;

export const PLAN_LIMITS = {
  free: 1000,
  ultra: 15000,
} as const;

// Ultra and Pro plans share their word pool across web and extension (no separate bonus)

/**
 * Calculate annual savings percentage
 * Returns null if no savings (monthly === annual)
 */
export function calculateSavings(monthlyPrice: number, annualPrice: number): number | null {
  if (monthlyPrice === annualPrice) return null;
  const monthlyCost = monthlyPrice * 12;
  const annualCost = annualPrice * 12;
  const savings = Math.round(((monthlyCost - annualCost) / monthlyCost) * 100);
  return savings > 0 ? savings : null;
}

/**
 * Get savings text for display
 */
export function getSavingsText(monthlyPrice: number, annualPrice: number): string | null {
  const savings = calculateSavings(monthlyPrice, annualPrice);
  return savings ? `Save ${savings}%` : null;
}
