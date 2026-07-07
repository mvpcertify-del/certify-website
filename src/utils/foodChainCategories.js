// ISO 22000 (FSMS) food chain categories.
//
// The alphabetical food-chain categories (A–K) used to classify an
// organisation's place in the food supply chain when scoping an ISO 22000 /
// FSMS certification. Each entry is { code, name, description }.
//
// Source: ISO/TS 22003 food-chain category scheme (aligned with ISO 22000).
// Mirrors the shape of IAF_SECTOR_CODES in iafCodes.js so it can be rendered
// in the same dropdown/multiselect components.

export const ISO22000_FOOD_CHAIN_CATEGORIES = [
  {
    code: 'A',
    name: 'Farming of Animals',
    description: 'Rearing of animals for food, e.g. milk, meat, poultry, eggs.',
  },
  {
    code: 'B',
    name: 'Farming of Plants',
    description: 'Growing of crops, e.g. fruits, vegetables, grains.',
  },
  {
    code: 'C',
    name: 'Food Manufacturing',
    description: 'Processing of perishable and ambient-stable food, and pet food.',
  },
  {
    code: 'D',
    name: 'Animal Feed Production',
    description: 'Producing feed and pet-food ingredients.',
  },
  {
    code: 'E',
    name: 'Catering',
    description: 'Preparation and serving of food.',
  },
  {
    code: 'F',
    name: 'Distribution',
    description: 'Storage and transport without manufacturing.',
  },
  {
    code: 'G',
    name: 'Provision of Transport and Storage Services',
    description: 'Transport and storage services for perishable and frozen goods.',
  },
  {
    code: 'H',
    name: 'Services',
    description: 'Sanitation, pest control, water supply and auxiliary services.',
  },
  {
    code: 'I',
    name: 'Production of Food Packaging and Packaging Materials',
    description: 'Packaging materials directly impacting food-contact safety.',
  },
  {
    code: 'J',
    name: 'Equipment Manufacturing',
    description: 'Producing food-processing machinery.',
  },
  {
    code: 'K',
    name: 'Production of Bio chemicals',
    description: 'Additives, vitamins, cultures and bio-chemicals.',
  },
];

// Lookup helper: returns the category object for a letter code (case-insensitive).
export function getFoodChainCategory(code) {
  if (!code) return null;
  const upper = String(code).trim().toUpperCase();
  return ISO22000_FOOD_CHAIN_CATEGORIES.find((c) => c.code === upper) || null;
}

// "A — Farming of Animals" style label for dropdowns.
export function foodChainCategoryLabel(code) {
  const cat = getFoodChainCategory(code);
  return cat ? `${cat.code} — ${cat.name}` : '';
}
