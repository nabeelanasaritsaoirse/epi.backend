const User = require('../models/User');

/**
 * Map of country calling codes to country information
 * Reference: International Telecommunication Union (ITU)
 */
const COUNTRY_CODE_MAP = {
  // Asia-Pacific
  '91': { country: 'India', region: 'india', currency: 'INR' },
  '86': { country: 'China', region: 'china', currency: 'CNY' },
  '81': { country: 'Japan', region: 'japan', currency: 'JPY' },
  '82': { country: 'South Korea', region: 'south-korea', currency: 'KRW' },
  '65': { country: 'Singapore', region: 'singapore', currency: 'SGD' },
  '60': { country: 'Malaysia', region: 'malaysia', currency: 'MYR' },
  '62': { country: 'Indonesia', region: 'indonesia', currency: 'IDR' },
  '63': { country: 'Philippines', region: 'philippines', currency: 'PHP' },
  '66': { country: 'Thailand', region: 'thailand', currency: 'THB' },
  '84': { country: 'Vietnam', region: 'vietnam', currency: 'VND' },
  '92': { country: 'Pakistan', region: 'pakistan', currency: 'PKR' },
  '880': { country: 'Bangladesh', region: 'bangladesh', currency: 'BDT' },
  '94': { country: 'Sri Lanka', region: 'sri-lanka', currency: 'LKR' },
  '977': { country: 'Nepal', region: 'nepal', currency: 'NPR' },

  // Middle East
  '971': { country: 'UAE', region: 'uae', currency: 'AED' },
  '966': { country: 'Saudi Arabia', region: 'saudi-arabia', currency: 'SAR' },
  '974': { country: 'Qatar', region: 'qatar', currency: 'QAR' },
  '973': { country: 'Bahrain', region: 'bahrain', currency: 'BHD' },
  '968': { country: 'Oman', region: 'oman', currency: 'OMR' },
  '965': { country: 'Kuwait', region: 'kuwait', currency: 'KWD' },

  // Americas
  '1': { country: 'United States', region: 'usa', currency: 'USD' }, // US/Canada
  '52': { country: 'Mexico', region: 'mexico', currency: 'MXN' },
  '55': { country: 'Brazil', region: 'brazil', currency: 'BRL' },
  '54': { country: 'Argentina', region: 'argentina', currency: 'ARS' },
  '56': { country: 'Chile', region: 'chile', currency: 'CLP' },
  '57': { country: 'Colombia', region: 'colombia', currency: 'COP' },

  // Europe
  '44': { country: 'United Kingdom', region: 'uk', currency: 'GBP' },
  '49': { country: 'Germany', region: 'germany', currency: 'EUR' },
  '33': { country: 'France', region: 'france', currency: 'EUR' },
  '39': { country: 'Italy', region: 'italy', currency: 'EUR' },
  '34': { country: 'Spain', region: 'spain', currency: 'EUR' },
  '31': { country: 'Netherlands', region: 'netherlands', currency: 'EUR' },
  '46': { country: 'Sweden', region: 'sweden', currency: 'SEK' },
  '47': { country: 'Norway', region: 'norway', currency: 'NOK' },
  '41': { country: 'Switzerland', region: 'switzerland', currency: 'CHF' },
  '43': { country: 'Austria', region: 'austria', currency: 'EUR' },
  '32': { country: 'Belgium', region: 'belgium', currency: 'EUR' },
  '61': { country: 'Australia', region: 'australia', currency: 'AUD' },

  // Africa
  '27': { country: 'South Africa', region: 'south-africa', currency: 'ZAR' },
  '20': { country: 'Egypt', region: 'egypt', currency: 'EGP' },
  '234': { country: 'Nigeria', region: 'nigeria', currency: 'NGN' },
  '254': { country: 'Kenya', region: 'kenya', currency: 'KES' },

  // Oceania
  '64': { country: 'New Zealand', region: 'new-zealand', currency: 'NZD' },
};

/**
 * Extract country code from international phone number
 * @param {String} phoneNumber - Phone number in format: +[countryCode][number]
 * @returns {String|null} - Country code (e.g., "91", "1", "44") or null
 *
 * Examples:
 * - "+919876543210" → "91" (India)
 * - "+14155552671" → "1" (USA/Canada)
 * - "+447911123456" → "44" (UK)
 * - "+8801234567890" → "880" (Bangladesh)
 */
const extractCountryCode = (phoneNumber) => {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return null;
  }

  const cleaned = phoneNumber.trim();

  // Phone number must start with +
  if (!cleaned.startsWith('+')) {
    return null;
  }

  // Extract digits after +
  const digits = cleaned.substring(1);

  // Try matching from longest to shortest (3 digits → 2 digits → 1 digit)
  // This handles cases like +880 (Bangladesh) vs +88 (non-existent)
  for (let length = 3; length >= 1; length--) {
    const code = digits.substring(0, length);
    if (COUNTRY_CODE_MAP[code]) {
      return code;
    }
  }

  return null;
};

/**
 * Get country information from phone number
 * @param {String} phoneNumber - Phone number in international format
 * @returns {Object|null} - { country, region, currency } or null
 *
 * Example:
 * Input: "+919876543210"
 * Output: { country: 'India', region: 'india', currency: 'INR' }
 */
const getCountryFromPhone = (phoneNumber) => {
  const countryCode = extractCountryCode(phoneNumber);

  if (!countryCode) {
    return null;
  }

  return COUNTRY_CODE_MAP[countryCode] || null;
};

/**
 * Get country from user's default address
 * @param {String} userId - MongoDB User ID
 * @returns {String|null} - Country name (e.g., 'India', 'USA') or null
 */
const getCountryFromUserAddress = async (userId) => {
  try {
    if (!userId) return null;

    const user = await User.findById(userId).select('addresses');
    if (!user || !user.addresses || user.addresses.length === 0) {
      return null;
    }

    // Find default address or use first address
    const defaultAddress = user.addresses.find(addr => addr.isDefault);
    const address = defaultAddress || user.addresses[0];

    return address.country || null;
  } catch (error) {
    console.error('[Country Detection] Error getting country from address:', error);
    return null;
  }
};

/**
 * Normalize country name to region identifier
 * Maps various country name formats to standardized region codes
 *
 * @param {String} country - Country name in any format
 * @returns {String} - Normalized region code (lowercase, hyphenated)
 *
 * Examples:
 * - "India" → "india"
 * - "United States" → "usa"
 * - "United Kingdom" → "uk"
 */
const normalizeCountryToRegion = (country) => {
  if (!country) return 'india';

  const countryLower = country.toLowerCase().trim();

  const countryMapping = {
    'india': 'india',
    'united states': 'usa',
    'united states of america': 'usa',
    'usa': 'usa',
    'us': 'usa',
    'america': 'usa',
    'united kingdom': 'uk',
    'uk': 'uk',
    'great britain': 'uk',
    'england': 'uk',
    'canada': 'canada',
    'australia': 'australia',
    'japan': 'japan',
    'china': 'china',
    'south korea': 'south-korea',
    'korea': 'south-korea',
    'singapore': 'singapore',
    'malaysia': 'malaysia',
    'indonesia': 'indonesia',
    'philippines': 'philippines',
    'thailand': 'thailand',
    'vietnam': 'vietnam',
    'pakistan': 'pakistan',
    'bangladesh': 'bangladesh',
    'sri lanka': 'sri-lanka',
    'nepal': 'nepal',
    'uae': 'uae',
    'united arab emirates': 'uae',
    'dubai': 'uae',
    'saudi arabia': 'saudi-arabia',
    'qatar': 'qatar',
    'bahrain': 'bahrain',
    'oman': 'oman',
    'kuwait': 'kuwait',
    'germany': 'germany',
    'france': 'france',
    'italy': 'italy',
    'spain': 'spain',
    'netherlands': 'netherlands',
    'sweden': 'sweden',
    'norway': 'norway',
    'switzerland': 'switzerland',
    'austria': 'austria',
    'belgium': 'belgium',
    'mexico': 'mexico',
    'brazil': 'brazil',
    'argentina': 'argentina',
    'chile': 'chile',
    'colombia': 'colombia',
    'south africa': 'south-africa',
    'egypt': 'egypt',
    'nigeria': 'nigeria',
    'kenya': 'kenya',
    'new zealand': 'new-zealand',
  };

  return countryMapping[countryLower] || countryLower.replace(/\s+/g, '-');
};

/**
 * MAIN FUNCTION: Detect user's country/region with priority order
 *
 * Priority Logic:
 * 1. Manual preference (if user explicitly selected country in profile)
 * 2. Phone number country code (MOST RELIABLE - from Firebase auth)
 * 3. Address country (fallback from shipping address)
 * 4. Default to India
 *
 * @param {Object} req - Express request object (must have req.user from auth middleware)
 * @returns {Promise<String>} - Region identifier (e.g., 'india', 'usa', 'uk')
 *
 * Usage:
 * const userCountry = await getUserCountry(req);
 * console.log(userCountry); // "india"
 */
const getUserCountry = async (req) => {
  try {
    // If user is not authenticated, return default
    if (!req.user || !req.user._id) {
      console.log('[Country Detection] User not authenticated, using default: india');
      return 'india';
    }

    // Priority 1: Check manual country preference
    // (This will be used when user manually selects country in app settings)
    if (req.user.locationPreferences?.preferredCountry) {
      const region = normalizeCountryToRegion(req.user.locationPreferences.preferredCountry);
      console.log(`[Country Detection] Using manual preference: ${region}`);
      return region;
    }

    // Priority 2: Extract country from phone number (MOST ACCURATE)
    if (req.user.phoneNumber) {
      const countryInfo = getCountryFromPhone(req.user.phoneNumber);
      if (countryInfo) {
        console.log(`[Country Detection] Detected from phone ${req.user.phoneNumber}: ${countryInfo.region} (${countryInfo.country})`);
        return countryInfo.region;
      } else {
        console.log(`[Country Detection] Could not extract country code from phone: ${req.user.phoneNumber}`);
      }
    }

    // Priority 3: Get country from user's address (fallback)
    // Only if user hasn't disabled this in preferences
    if (req.user.locationPreferences?.useAddressCountry !== false) {
      const addressCountry = await getCountryFromUserAddress(req.user._id);
      if (addressCountry) {
        const region = normalizeCountryToRegion(addressCountry);
        console.log(`[Country Detection] Using address country: ${region}`);
        return region;
      }
    }

    // Priority 4: Default fallback
    console.log('[Country Detection] No phone or address found, using default: india');
    return 'india';

  } catch (error) {
    console.error('[Country Detection] Error in getUserCountry:', error);
    return 'india'; // Safe fallback
  }
};

/**
 * Get currency code for a region
 * @param {String} region - Region code (e.g., 'india', 'usa')
 * @returns {String} - Currency code (e.g., 'INR', 'USD')
 */
const getCurrencyForRegion = (region) => {
  // Find currency from country code map
  for (const [code, info] of Object.entries(COUNTRY_CODE_MAP)) {
    if (info.region === region) {
      return info.currency;
    }
  }

  // Fallback currency map
  const currencyMap = {
    'india': 'INR',
    'usa': 'USD',
    'uk': 'GBP',
    'canada': 'CAD',
    'australia': 'AUD',
  };

  return currencyMap[region] || 'USD';
};

/**
 * Get list of all supported regions
 * @returns {Array} - Array of region objects
 */
const getSupportedRegions = () => {
  const regions = new Map();

  for (const [code, info] of Object.entries(COUNTRY_CODE_MAP)) {
    if (!regions.has(info.region)) {
      regions.set(info.region, {
        region: info.region,
        country: info.country,
        currency: info.currency,
        countryCode: code
      });
    }
  }

  return Array.from(regions.values()).sort((a, b) => a.country.localeCompare(b.country));
};

module.exports = {
  getUserCountry,
  getCountryFromPhone,
  getCountryFromUserAddress,
  normalizeCountryToRegion,
  extractCountryCode,
  getCurrencyForRegion,
  getSupportedRegions,
  COUNTRY_CODE_MAP
};
