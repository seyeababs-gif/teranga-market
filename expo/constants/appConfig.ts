/**
 * Centralized app constants for Teranga Market — Diaspora sénégalaise en France.
 * Colors inspired by the Senegalese flag: green, yellow, red.
 * Everything is FREE in this first version to attract users.
 * All prices displayed in EUR only (converted from FCFA stored in DB).
 */

// ─── FREE VERSION — zero commission, all features unlocked ───
export const IS_FREE_VERSION = true;
export const COMMISSION_RATE = 0; // 0% commission — everything free
export const MAX_FREE_LISTINGS = Infinity; // unlimited listings
export const MAX_FREE_IMAGES = 10; // generous image limit for everyone

// ─── Currency ───
// DB stores prices in FCFA; display is EUR only for the French diaspora.
const FCFA_TO_EUR_RATE = 0.00152; // 1 FCFA ≈ 0.00152 EUR (655.957 FCFA = 1 EUR)
const EUR_TO_FCFA_RATE = 655.957;

/**
 * Format a price stored as FCFA into EUR only.
 * Example: formatPrice(15000) → "23 €"
 */
export function formatPrice(fcfa: number): string {
  const eur = Math.round(fcfa * FCFA_TO_EUR_RATE);
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(eur);
}

/**
 * Convert an EUR amount (user input) to FCFA for DB storage.
 */
export function eurToFcfa(eur: number): number {
  return Math.round(eur * EUR_TO_FCFA_RATE);
}

/**
 * Convert a FCFA amount to EUR.
 */
export function fcfaToEur(fcfa: number): number {
  return Math.round(fcfa * FCFA_TO_EUR_RATE);
}

// ─── Avatars ───
export function getFallbackAvatar(name: string): string {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=00853F&color=fff&size=200`;
}

export const FALLBACK_AVATAR_SMALL = 'https://ui-avatars.com/api/?name=User&background=00853F&color=fff&size=50';
export const FALLBACK_AVATAR_MEDIUM = 'https://ui-avatars.com/api/?name=User&background=00853F&color=fff&size=100';

// ─── Colors (Senegalese flag inspired) ───
export const APP_COLORS = {
  primary: '#00853F',       // Senegalese green
  primaryLight: '#00A650',
  primaryDark: '#006B32',
  secondary: '#FF6B35',     // African orange (accent)
  error: '#E31B23',         // Senegalese red
  errorDark: '#E63946',
  success: '#00A651',
  warning: '#FDEF42',       // Senegalese yellow
  info: '#1E3A8A',
  background: '#FFFBF2',    // Warm cream
  card: '#FFFFFF',
  border: '#E8D5B7',
  cardBorder: '#F0E6D7',
  text: '#1a1a1a',
  textSecondary: '#666',
  textMuted: '#999',
  price: '#00853F',         // Prices in green (free vibes)
  priceOld: '#999',
  discount: '#E31B23',
  premium: '#FFD700',
  whatsapp: '#25D366',
  stockIn: '#00A651',
  stockOut: '#E31B23',
  condition: '#2A9D8F',
} as const;

// ─── Domain & Sharing ───
export const APP_DOMAIN = 'terangamarket.com';
export const APP_NAME = 'Teranga Market';
export const APP_TAGLINE = 'Sunu Marché 🇸🇳 — La diaspora sénégalaise connectée';
export const APP_TAGLINE_FR = 'Le marché de la diaspora sénégalaise en France';

// Deep link scheme for native sharing
export const APP_SCHEME = 'rork-ecnhfxt6hf947cprfe1cd';

/**
 * Get the base URL for sharing — works on web (window.location.origin) and native (deep link scheme).
 */
function getShareBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return window.location.origin;
  }
  return `${APP_SCHEME}://`;
}

/**
 * Build a shareable product URL.
 * On web: https://rork-preview-url/product/{id}
 * On native: rork-ecnhfxt6hf947cprfe1cd://product/{id}
 */
export function buildProductShareUrl(productId: string): string {
  return `${getShareBaseUrl()}/product/${productId}`;
}

/**
 * Build a shareable shop URL.
 * On web: https://rork-preview-url/shop/{sellerId}
 * On native: rork-ecnhfxt6hf947cprfe1cd://shop/{sellerId}
 */
export function buildShopShareUrl(sellerId: string): string {
  return `${getShareBaseUrl()}/shop/${sellerId}`;
}

// ─── Product expiration (30 days for free version) ───
export const PRODUCT_EXPIRY_DAYS = 30;

/**
 * Calculate days remaining before a product expires (30 days from creation).
 * Returns 0 if already expired.
 */
export function getDaysRemaining(createdAt: Date): number {
  const expiryMs = PRODUCT_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  const elapsedMs = Date.now() - createdAt.getTime();
  const remainingMs = expiryMs - elapsedMs;
  return Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
}

/**
 * Check if a product is expired (older than 30 days).
 */
export function isProductExpired(createdAt: Date): boolean {
  return getDaysRemaining(createdAt) <= 0;
}

// ─── Diaspora cities (France + Senegal) ───
export const FRENCH_CITIES = [
  'Paris', 'Marseille', 'Lyon', 'Toulouse', 'Bordeaux', 'Lille', 'Nantes',
  'Montpellier', 'Strasbourg', 'Nice', 'Rennes', 'Le Havre', 'Dijon',
  'Saint-Étienne', 'Toulon', 'Le Mans', 'Brest', 'Clermont-Ferrand',
];

export const SENEGALESE_CITIES = [
  'Dakar', 'Thiès', 'Saint-Louis', 'Touba', 'Kaolack', 'Ziguinchor',
  'Rufisque', 'Mbour', 'Diourbel', 'Louga', 'Tambacounda', 'Matam',
  'Kolda', 'Sédhiou', 'Kaffrine', 'Kédougou',
];

// ─── Wolof phrases for UI warmth ───
export const WOLOF_PHRASES = {
  welcome: 'Nanga def !',           // Hello / How are you
  welcomeHome: 'Bénkën ba ci Teranga Market',
  thankYou: 'Jërejëf !',            // Thank you
  seeYouSoon: 'Ba suba !',          // See you tomorrow
  letsGo: 'Nangu !',                // Let's go
  wellDone: 'Jëf jëf !',            // Well done
  myFriend: 'Sama xarit',           // My friend
  hello: 'Salaam aleekum !',        // Greeting
  buyWell: 'Jënd bu baax !',        // Buy well
  sellWell: 'Jaay bu baax !',       // Sell well
  freeOffer: 'Léegi ñu ñépp mooy ndimbal — gratis !',
};
