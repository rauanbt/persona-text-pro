// Single source of truth for pricing across the application

export const PLAN_PRICES = {
  free: {
    monthly: { price: 0, display: "Free" },
    annual: { price: 0, display: "Free" }
  },
  pro: {
    monthly: { 
      price: 17.95, 
      display: "$17.95",
      priceId: "price_1SD818H8HT0u8xph48V9GxXG" // UPDATE WITH NEW STRIPE PRICE ID
    },
    annual: { 
      price: 8.95, 
      display: "$8.95",
      yearlyTotal: 107.40,
      priceId: "price_1SGMnjH8HT0u8xphJXTgm1Ii" // UPDATE WITH NEW STRIPE PRICE ID
    }
  },
  ultra: {
    monthly: { 
      price: 39.95, 
      display: "$39.95",
      priceId: "price_1SD81xH8HT0u8xphuqiq8xet" // UPDATE WITH NEW STRIPE PRICE ID
    },
    annual: { 
      price: 19.95, 
      display: "$19.95",
      yearlyTotal: 239.40,
      priceId: "price_1SGMo6H8HT0u8xphytzP4SFR" // UPDATE WITH NEW STRIPE PRICE ID
    }
  },
  extension_only: {
    monthly: { 
      price: 12.95, 
      display: "$12.95",
      priceId: "price_1SGNtsH8HT0u8xphEd7pG9Po" 
    },
    annual: { 
      price: 12.95, 
      display: "$12.95",
      priceId: "price_1SGNtsH8HT0u8xphEd7pG9Po" 
    }
  }
} as const;

export const PLAN_LIMITS = {
  free: 500,
  pro: 15000,
  ultra: 40000,
  extension_only: 5000
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
