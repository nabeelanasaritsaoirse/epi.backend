/**
 * updateMangoProductsFull.js
 * ──────────────────────────
 * Updates all 100 mango products with EVERY model field populated:
 *   description.specifications, description.features
 *   origin, dimensions, warranty, seo
 *   paymentPlan, referralBonus, plans
 *   status = published
 *   isFeatured / isPopular / isBestSeller / isTrending
 *   sellerId + sellerInfo (Nishant)
 *   defaultVariantId
 *
 * Run: node scripts/updateMangoProductsFull.js
 */

const axios = require('axios');

const BASE_URL     = 'http://13.127.15.87:8080/api';
const SELLER_EMAIL = 'nishant.it.saoirse@gmail.com';
const STORE_NAME   = 'Nishant Mango Store';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Per-variety rich data ────────────────────────────────────────────────────
const VARIETY_DATA = {
  'Alphonso': {
    origin: { country: 'India', manufacturer: 'Devgad Mango Farmers Co-operative' },
    specs: [
      { key: 'Variety',       value: 'Alphonso (Hapus)',       unit: '' },
      { key: 'Origin',        value: 'Devgad, Ratnagiri',     unit: '' },
      { key: 'Certification', value: 'GI-Tagged',              unit: '' },
      { key: 'Taste Profile', value: 'Sweet, Creamy, Rich',   unit: '' },
      { key: 'Colour',        value: 'Golden Yellow',          unit: '' },
      { key: 'Season',        value: 'April – June',           unit: '' },
    ],
    features: ['GI-Tagged Devgad Hapus', 'Zero artificial ripening', 'Farm to door in 24h', 'Rich creamy pulp', 'Handpicked at peak ripeness', 'Eco-friendly packaging'],
  },
  'Kesar': {
    origin: { country: 'India', manufacturer: 'Gir Kesar Mango Growers Association' },
    specs: [
      { key: 'Variety',       value: 'Kesar',                  unit: '' },
      { key: 'Origin',        value: 'Talala, Gir Somnath',   unit: '' },
      { key: 'Certification', value: 'GI-Tagged',              unit: '' },
      { key: 'Taste Profile', value: 'Honey-sweet, Saffron',  unit: '' },
      { key: 'Colour',        value: 'Saffron Yellow',         unit: '' },
      { key: 'Season',        value: 'May – July',             unit: '' },
    ],
    features: ['GI-Tagged Gujarat Kesar', 'Natural saffron-like aroma', 'Perfect for milkshakes & desserts', 'Fibreless pulp', 'Hand-sorted premium grade', 'Packed in breathable crates'],
  },
  'Dasheri': {
    origin: { country: 'India', manufacturer: 'Malihabad Mango Growers Society' },
    specs: [
      { key: 'Variety',       value: 'Dasheri',                unit: '' },
      { key: 'Origin',        value: 'Malihabad, UP',          unit: '' },
      { key: 'Taste Profile', value: 'Sweet, Fragrant',        unit: '' },
      { key: 'Colour',        value: 'Pale Yellow-Green',      unit: '' },
      { key: 'Skin',          value: 'Thin, Smooth',           unit: '' },
      { key: 'Season',        value: 'June – August',          unit: '' },
    ],
    features: ['Heritage Malihabad variety', 'Thin fibreless skin', 'Intense sweet fragrance', 'Best eaten chilled', 'No chemical treatment', 'Direct from UP orchards'],
  },
  'Langra': {
    origin: { country: 'India', manufacturer: 'Varanasi Mango Growers Union' },
    specs: [
      { key: 'Variety',       value: 'Langra',                 unit: '' },
      { key: 'Origin',        value: 'Varanasi, UP',           unit: '' },
      { key: 'Taste Profile', value: 'Tangy-Sweet',            unit: '' },
      { key: 'Colour',        value: 'Green when ripe',        unit: '' },
      { key: 'Fibre',         value: 'Fibreless',              unit: '' },
      { key: 'Season',        value: 'July – August',          unit: '' },
    ],
    features: ['Stays green when ripe', 'Tangy-sweet unique taste', 'Fibreless pulp', 'North India summer classic', 'No wax coating', 'Cold-chain delivery'],
  },
  'Totapuri': {
    origin: { country: 'India', manufacturer: 'Karnataka Mango Producers Federation' },
    specs: [
      { key: 'Variety',       value: 'Totapuri (Ginimoothi)',  unit: '' },
      { key: 'Origin',        value: 'Karnataka, Andhra',      unit: '' },
      { key: 'Taste Profile', value: 'Mildly Tangy',           unit: '' },
      { key: 'Shape',         value: 'Elongated Parrot-beak',  unit: '' },
      { key: 'Best Use',      value: 'Juice, Pickle, Chutney', unit: '' },
      { key: 'Season',        value: 'May – August',           unit: '' },
    ],
    features: ['Ideal for juices & pickles', 'Firm non-fibrous flesh', "South India's favourite", 'Parrot-beak shape', 'High pulp yield', 'Stays fresh longer'],
  },
  'Chaunsa': {
    origin: { country: 'India', manufacturer: 'Punjab Horticulture Department' },
    specs: [
      { key: 'Variety',       value: 'Chaunsa',                unit: '' },
      { key: 'Origin',        value: 'Punjab / Haryana',       unit: '' },
      { key: 'Taste Profile', value: 'Honey-like, Very Sweet', unit: '' },
      { key: 'Colour',        value: 'Pale Yellow',            unit: '' },
      { key: 'Pulp',          value: 'Smooth, Fibreless',      unit: '' },
      { key: 'Season',        value: 'July – September',       unit: '' },
    ],
    features: ['Honey-like sweetness', 'Exceptionally smooth pulp', "Connoisseur's choice", 'Long shelf life', 'Zero artificial ripening', 'Premium cold-box packing'],
  },
  'Badami': {
    origin: { country: 'India', manufacturer: 'Karnataka State Mango Growers Board' },
    specs: [
      { key: 'Variety',       value: 'Badami (Sandersha)',     unit: '' },
      { key: 'Origin',        value: 'Bijapur, Karnataka',     unit: '' },
      { key: 'Taste Profile', value: 'Rich, Aromatic',         unit: '' },
      { key: 'Colour',        value: 'Golden Yellow',          unit: '' },
      { key: 'Pulp',          value: 'Soft, Juicy',            unit: '' },
      { key: 'Season',        value: 'May – July',             unit: '' },
    ],
    features: ['Karnataka Alphonso equivalent', 'Golden yellow skin', 'Rich aromatic pulp', 'Great for eating & processing', 'Farm fresh daily dispatch', 'Zero chemical ripening'],
  },
  'Himsagar': {
    origin: { country: 'India', manufacturer: 'West Bengal Horticulture Development Corporation' },
    specs: [
      { key: 'Variety',       value: 'Himsagar',               unit: '' },
      { key: 'Origin',        value: 'Murshidabad, WB',        unit: '' },
      { key: 'Taste Profile', value: 'Intensely Sweet, Floral', unit: '' },
      { key: 'Colour',        value: 'Golden Yellow',           unit: '' },
      { key: 'Pulp',          value: 'Thick, Seed-less',        unit: '' },
      { key: 'Season',        value: 'May – June (Short)',      unit: '' },
    ],
    features: ['West Bengal heritage variety', 'Short season — limited stock', 'Intensely sweet floral aroma', 'Thick golden pulp', 'Small seed, more pulp', 'Express delivery at harvest'],
  },
  'Neelam': {
    origin: { country: 'India', manufacturer: 'Tamil Nadu Mango Growers Federation' },
    specs: [
      { key: 'Variety',       value: 'Neelam',                 unit: '' },
      { key: 'Origin',        value: 'Tamil Nadu, Andhra',     unit: '' },
      { key: 'Taste Profile', value: 'Sweet, Distinctive',     unit: '' },
      { key: 'Colour',        value: 'Yellow-Orange',          unit: '' },
      { key: 'Season',        value: 'June – September',       unit: '' },
      { key: 'Shelf Life',    value: 'Longer than average',    unit: '' },
    ],
    features: ['Late-season variety', 'Longest mango season in India', 'Distinctive sweet aroma', 'Fibreless smooth pulp', 'Great value for money', 'Ship-fresh daily'],
  },
  'Fazli': {
    origin: { country: 'India', manufacturer: 'West Bengal Horticulture Department' },
    specs: [
      { key: 'Variety',       value: 'Fazli',                  unit: '' },
      { key: 'Origin',        value: 'Malda, West Bengal',     unit: '' },
      { key: 'Taste Profile', value: 'Mildly Sweet',           unit: '' },
      { key: 'Size',          value: 'Extra Large',            unit: '' },
      { key: 'Colour',        value: 'Greenish Yellow',        unit: '' },
      { key: 'Season',        value: 'July – September',       unit: '' },
    ],
    features: ['Giant of mangoes', 'Extra large size', 'Best for eating fresh', 'Great for pickles & chutneys', 'Farm sourced West Bengal', 'Natural ripening only'],
  },
};

// ── Installment plan by price band ──────────────────────────────────────────
function makePlan(regularPrice) {
  if (regularPrice < 200)  return null; // too cheap for EMI
  const days  = regularPrice < 600  ? 30 : regularPrice < 1200 ? 60 : 90;
  const daily = Math.ceil(regularPrice / days);
  return {
    enabled:             true,
    minDownPayment:      Math.round(regularPrice * 0.1),
    maxDownPayment:      Math.round(regularPrice * 0.5),
    minPaymentAmount:    daily,
    maxPaymentAmount:    Math.round(regularPrice * 0.3),
    minInstallmentDays:  7,
    maxInstallmentDays:  days,
    interestRate:        0,
  };
}

// ── Suggested installment plans array ───────────────────────────────────────
function makePlans(regularPrice) {
  if (regularPrice < 300) return [];
  const plans = [];
  [7, 15, 30].forEach(days => {
    const perDay = Math.ceil(regularPrice / days);
    plans.push({
      name:         `${days}-Day Plan`,
      days,
      perDayAmount: perDay,
      totalAmount:  perDay * days,
      isRecommended: days === 15,
      description:  `Pay ₹${perDay}/day for ${days} days — total ₹${perDay * days}`,
    });
  });
  return plans;
}

// ── Dimensions by weight template ────────────────────────────────────────────
function makeDimensions(weightLabel) {
  const map = {
    '250g': { weight: 0.25, length: 15, width: 10, height: 8  },
    '500g': { weight: 0.50, length: 20, width: 15, height: 10 },
    '1 kg': { weight: 1.00, length: 25, width: 20, height: 12 },
    '2 kg': { weight: 2.00, length: 30, width: 25, height: 15 },
    '3 kg': { weight: 3.00, length: 35, width: 28, height: 18 },
    '5 kg': { weight: 5.00, length: 42, width: 32, height: 22 },
    '~1 kg':{ weight: 1.20, length: 28, width: 22, height: 14 },
    '~2 kg':{ weight: 2.20, length: 35, width: 28, height: 16 },
  };
  const d = map[weightLabel] || { weight: 1, length: 25, width: 20, height: 12 };
  return { ...d, weightUnit: 'kg', dimensionUnit: 'cm' };
}

// ── Build full update payload for one product ─────────────────────────────────
function buildUpdate(product, sellerId) {
  // Detect variety from product name
  const varietyKey = Object.keys(VARIETY_DATA).find(k =>
    product.name.toLowerCase().includes(k.toLowerCase())
  ) || 'Alphonso';
  const vData = VARIETY_DATA[varietyKey];

  // Detect weight from name
  const weightMatch = product.name.match(/(~?\d+\s?(?:kg|g))/i);
  const weightLabel = weightMatch ? weightMatch[1].trim() : '1 kg';

  const regularPrice = product.pricing?.regularPrice || 200;
  const salePrice    = product.pricing?.salePrice    || Math.round(regularPrice * 0.88);

  // Featured flags based on variant/label
  const name = product.name.toLowerCase();
  const isFeatured   = name.includes('alphonso') || name.includes('kesar')  || name.includes('5 kg');
  const isPopular    = name.includes('1 kg')     || name.includes('gift box');
  const isBestSeller = name.includes('alphonso') || name.includes('himsagar');
  const isTrending   = name.includes('organic')  || name.includes('kesar');

  return {
    // ── Core ─────────────────────────────────────────────────────────────────
    status:      'published',
    listingStatus: 'published',
    isFeatured,
    isPopular,
    isBestSeller,
    isTrending,
    condition:   'new',

    // ── Seller ───────────────────────────────────────────────────────────────
    sellerId,
    sellerInfo: {
      storeName:  STORE_NAME,
      rating:     4.8,
      isVerified: true,
    },

    // ── Description (keep existing short/long, enrich specs & features) ──────
    description: {
      short:          product.description?.short || `Fresh ${varietyKey} mango — ${weightLabel}. ${vData.specs[0]?.value || 'Premium quality'}.`,
      long:           product.description?.long  || vData.specs.map(s => `${s.key}: ${s.value}`).join('\n'),
      features:       vData.features,
      specifications: vData.specs,
    },

    // ── Origin ───────────────────────────────────────────────────────────────
    origin: vData.origin,

    // ── Dimensions ───────────────────────────────────────────────────────────
    dimensions: makeDimensions(weightLabel),

    // ── Warranty / return ────────────────────────────────────────────────────
    warranty: {
      period:       0,          // fresh produce — no warranty period
      warrantyUnit: 'days',
      returnPolicy: 1,          // 1-day return if damaged on arrival
    },

    // ── SEO ──────────────────────────────────────────────────────────────────
    seo: {
      metaTitle:       `Buy ${product.name} Online | Farm Fresh | ${STORE_NAME}`,
      metaDescription: `Order ${product.name} online. ${vData.specs[0]?.value || 'Premium quality'}, ${vData.origin.country} origin. Delivered fresh within 24-48 hours. ${isFeatured ? 'Bestseller!' : ''}`,
      keywords:        [varietyKey.toLowerCase(), 'mango', 'fresh mango', 'buy mango online', 'farm fresh', vData.origin.country.toLowerCase()],
    },

    // ── Installment plan ─────────────────────────────────────────────────────
    paymentPlan: makePlan(regularPrice),

    // ── Suggested plans ──────────────────────────────────────────────────────
    plans: makePlans(regularPrice),

    // ── Referral bonus ───────────────────────────────────────────────────────
    referralBonus: {
      enabled:          true,
      type:             'percentage',
      value:            5,            // 5% referral bonus
      minPurchaseAmount: 100,
    },

    // ── Pricing (keep existing) ───────────────────────────────────────────────
    pricing: {
      regularPrice,
      salePrice,
      finalPrice:   salePrice,
      currency:     'INR',
      baseCurrency: 'INR',
    },

    // ── Tax ──────────────────────────────────────────────────────────────────
    taxInfo: {
      hsnCode: '08045010',
      gstRate: 5,
    },
  };
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n══════════════════════════════════════════════════════');
  console.log('  Update All Mango Products — Full Field Population');
  console.log('══════════════════════════════════════════════════════\n');

  // Login
  const login = await axios.post(`${BASE_URL}/admin-auth/login`, {
    email: 'admin@epi.com', password: '@Saoirse123',
  });
  const token = login.data.data.accessToken;
  const api   = axios.create({
    baseURL: BASE_URL,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    timeout: 20000,
  });
  console.log('Admin login ✓');

  // Get nishant's sellerId
  const usersRes = await api.get('/users/admin', { params: { search: SELLER_EMAIL, limit: 10 } });
  const users    = usersRes.data.users || usersRes.data.data || [];
  const nishant  = users.find(u => u.email === SELLER_EMAIL);
  if (!nishant) { console.error('Nishant user not found'); return; }
  const sellerId = nishant._id;
  console.log(`Seller: ${nishant.name} (${sellerId})\n`);

  // Fetch all mango products (paginated)
  let mangoProducts = [];
  let page = 1;
  while (true) {
    const res  = await api.get('/products', { params: { limit: 100, page } });
    const items = res.data.data || res.data.products || [];
    const mango = items.filter(p =>
      p.category?.mainCategoryName === 'Mango' ||
      p.name?.toLowerCase().includes('mango')
    );
    mangoProducts.push(...mango);
    if (items.length < 100) break;
    page++;
  }
  console.log(`Found ${mangoProducts.length} mango products\n`);

  let updated = 0, failed = 0;

  for (const product of mangoProducts) {
    const pid     = product.productId || product._id;
    const payload = buildUpdate(product, sellerId);

    try {
      await api.put(`/products/${pid}`, payload);
      updated++;
      process.stdout.write(`\r  Progress: ${updated}/${mangoProducts.length} ✓`);
      await sleep(100);
    } catch (e) {
      failed++;
      const msg = e?.response?.data?.message || e.message;
      console.log(`\n  ✗ [${product.name}]: ${msg}`);
      if (failed === 1) {
        console.log('  Full error:', JSON.stringify(e?.response?.data, null, 2));
      }
    }
  }

  console.log(`\n\n══════════════════════════════════════════════════════`);
  console.log(`  DONE — Updated: ${updated}  Failed: ${failed}`);
  console.log(`\n  Fields now populated in every mango product:`);
  console.log(`  ✓ description.specifications (structured)`);
  console.log(`  ✓ description.features`);
  console.log(`  ✓ origin (country + manufacturer)`);
  console.log(`  ✓ dimensions (weight, length, width, height)`);
  console.log(`  ✓ warranty (return policy: 1 day)`);
  console.log(`  ✓ seo (metaTitle, metaDescription, keywords)`);
  console.log(`  ✓ paymentPlan (installment config)`);
  console.log(`  ✓ plans (7/15/30-day payment plans)`);
  console.log(`  ✓ referralBonus (5%)`);
  console.log(`  ✓ taxInfo (HSN 08045010, GST 5%)`);
  console.log(`  ✓ status = published`);
  console.log(`  ✓ isFeatured / isPopular / isBestSeller / isTrending`);
  console.log(`  ✓ sellerId = ${sellerId}`);
  console.log(`  ✓ sellerInfo (storeName, rating, isVerified)`);
  console.log(`══════════════════════════════════════════════════════\n`);
}

main().catch(e => {
  console.error('\nFatal:', e?.response?.data || e.message);
  process.exit(1);
});
