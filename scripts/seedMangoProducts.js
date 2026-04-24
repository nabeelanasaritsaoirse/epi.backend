/**
 * Mango Product Seeding Script
 * ─────────────────────────────
 * 1. Admin login
 * 2. Find nishant.it.saoirse@gmail.com → make them a seller
 * 3. Create parent category: "Mango"
 * 4. Create 10 sub-categories (mango varieties)
 * 5. Create 10 products per sub-category (100 total) with variants
 *
 * Run: node scripts/seedMangoProducts.js
 */

const axios = require('axios');

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const BASE_URL       = 'http://13.127.15.87:8080/api';
const ADMIN_EMAIL    = 'admin@epi.com';
const ADMIN_PASSWORD = '@Saoirse123';
const SELLER_EMAIL   = 'nishant.it.saoirse@gmail.com';

// ─── MANGO IMAGES (5 URLs, rotated across all products/categories) ─────────────
const MANGO_IMAGES = [
  'https://images.unsplash.com/photo-1601493700631-2b16ec4b4716?w=800&q=80',
  'https://images.unsplash.com/photo-1553279768-865429fa0078?w=800&q=80',
  'https://images.unsplash.com/photo-1519996529931-28324d5a630e?w=800&q=80',
  'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&q=80',
  'https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=800&q=80',
];

// Builds image object array (schema: { url, isPrimary, altText, order })
const makeImages = (altText, count = 3, offset = 0) =>
  Array.from({ length: count }, (_, i) => ({
    url: MANGO_IMAGES[(i + offset) % MANGO_IMAGES.length],
    isPrimary: i === 0,
    altText: `${altText} - view ${i + 1}`,
    order: i + 1,
  }));

// ─── 10 MANGO SUB-CATEGORIES ──────────────────────────────────────────────────
const MANGO_VARIETIES = [
  { name: 'Alphonso Mangoes',  origin: 'Maharashtra',    desc: 'The king of mangoes — Alphonso (Hapus) from Devgad & Ratnagiri. Rich, creamy texture with saffron-like sweetness. GI-tagged produce from Maharashtra.' },
  { name: 'Kesar Mangoes',     origin: 'Gujarat',        desc: "Gujarat's pride — Kesar mango with intense saffron colour and honey-like sweetness. GI-tagged from Gir-Somnath district. Perfect for juice, milkshakes & desserts." },
  { name: 'Dasheri Mangoes',   origin: 'Uttar Pradesh',  desc: "Uttarakhand's heritage mango — Dasheri from Malihabad. Thin skin, fibreless pulp with a distinct sweet fragrance. Best eaten fresh." },
  { name: 'Langra Mangoes',    origin: 'Varanasi',       desc: "Varanasi's famous Langra mango. Stays green even when ripe. Fibreless, tangy-sweet flavour with a unique aroma. A north India summer favourite." },
  { name: 'Totapuri Mangoes',  origin: 'Karnataka',      desc: "South India's elongated parrot-beak mango. Less sweet, mildly tangy — ideal for pickles, chutneys, mango pulp manufacturing and fresh juices." },
  { name: 'Chaunsa Mangoes',   origin: 'Punjab',         desc: "Punjab's premium mango. Chaunsa has exceptionally smooth, fibreless pulp with honey-like sweetness. A connoisseur's choice." },
  { name: 'Badami Mangoes',    origin: 'Karnataka',      desc: "Karnataka's Alphonso equivalent — Badami (Sandersha) with golden yellow skin and rich, aromatic pulp. Excellent for both eating and processing." },
  { name: 'Himsagar Mangoes',  origin: 'West Bengal',    desc: "West Bengal's prized Himsagar — small, oval with thick, golden pulp. Intensely sweet with a floral fragrance. Only available for a short season." },
  { name: 'Neelam Mangoes',    origin: 'Tamil Nadu',     desc: "South India's late-season mango. Neelam has a distinctive sweet aroma and smooth, fibreless pulp. One of the longest mango seasons across India." },
  { name: 'Fazli Mangoes',     origin: 'West Bengal',    desc: "The giant of mangoes — Fazli from West Bengal. Large, greenish-yellow skin with mildly sweet flavour. Best for eating fresh and making pickles." },
];

// ─── 10 PRODUCT TEMPLATES (per variety) ──────────────────────────────────────
const PRODUCT_TEMPLATES = [
  { label: '250g Pack',        weight: '250g',  grade: 'Standard',   priceBase: 1.00, qty: 200 },
  { label: '500g Pack',        weight: '500g',  grade: 'Standard',   priceBase: 1.85, qty: 150 },
  { label: '1 kg Pack',        weight: '1 kg',  grade: 'Standard',   priceBase: 3.40, qty: 120 },
  { label: '2 kg Box',         weight: '2 kg',  grade: 'Standard',   priceBase: 6.50, qty: 80  },
  { label: '3 kg Box',         weight: '3 kg',  grade: 'Premium',    priceBase: 9.20, qty: 60  },
  { label: '5 kg Premium Box', weight: '5 kg',  grade: 'Premium A+', priceBase: 14.5, qty: 40  },
  { label: 'Gift Box 6 pcs',   weight: '~1 kg', grade: 'Premium A+', priceBase: 5.00, qty: 50  },
  { label: 'Gift Box 12 pcs',  weight: '~2 kg', grade: 'Premium A+', priceBase: 9.50, qty: 30  },
  { label: 'Organic 1 kg',     weight: '1 kg',  grade: 'Organic',    priceBase: 4.80, qty: 70  },
  { label: 'Organic 3 kg',     weight: '3 kg',  grade: 'Organic A+', priceBase: 13.0, qty: 25  },
];

// Base prices per variety (INR for 250g equivalent)
const BASE_PRICES = [149, 89, 69, 65, 45, 129, 79, 139, 55, 59];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const api = axios.create({ baseURL: BASE_URL, timeout: 20000 });

const setAuth = (token) => {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  api.defaults.headers.common['Content-Type'] = 'application/json';
};

const log  = (msg, data = '') => console.log(`[${new Date().toLocaleTimeString()}] ${msg}${data ? ' → ' + JSON.stringify(data) : ''}`);
const fail = (step, e) => console.error(`  ✗ [${step}]: ${e?.response?.data?.message || e?.message || JSON.stringify(e?.response?.data)}`);

// ─── STEP 1: Admin login ──────────────────────────────────────────────────────
async function adminLogin() {
  log('Logging in as admin...');
  const res = await api.post('/admin-auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  const data = res.data.data || res.data;
  const token = data.accessToken || data.token;
  setAuth(token);
  log('Admin login ✓', { role: data.role, email: data.email });
  return token;
}

// ─── STEP 2: Find & promote seller ───────────────────────────────────────────
async function makeUserSeller() {
  log(`Looking up user: ${SELLER_EMAIL}`);
  try {
    const res = await api.get('/users/admin', { params: { search: SELLER_EMAIL, limit: 20 } });
    const users = res.data.users || res.data.data || [];
    const found = users.find(u => u.email === SELLER_EMAIL);

    if (!found) {
      log(`⚠  User "${SELLER_EMAIL}" not found on this server — seller step skipped`);
      log('   (You can promote manually: PUT /api/users/admin/:userId  body: { role: "seller" })');
      return null;
    }

    log(`Found user: ${found.name} | role: ${found.role} | id: ${found._id}`);

    const upd = await api.put(`/users/admin/${found._id}`, { role: 'seller' });
    const updated = upd.data.user || upd.data;
    log('Promoted to seller ✓', { role: updated.role || 'seller' });
    return found._id;
  } catch (e) {
    fail('makeUserSeller', e);
    return null;
  }
}

// ─── STEP 3: Create parent category ──────────────────────────────────────────
async function createParentCategory() {
  log('Creating parent category: Mango...');
  try {
    const res = await api.post('/categories', {
      name: 'Mango',
      description: 'Fresh, farm-to-door mangoes from across India. Explore premium varieties — Alphonso, Kesar, Dasheri, Langra and more. Seasonal freshness guaranteed.',
      image: MANGO_IMAGES[0],
      isFeatured: true,
      showInMenu: true,
      commissionRate: 10,
      displayOrder: 1,
    });
    const cat = res.data.category || res.data.data || res.data;
    log(`Parent category created ✓`, { _id: cat._id, name: cat.name });
    return cat;
  } catch (e) {
    if (e?.response?.data?.message?.includes('already exists')) {
      log('"Mango" already exists — fetching...');
      const r2 = await api.get('/categories', { params: { limit: 50 } });
      const cats = r2.data.categories || r2.data.data || [];
      const found = cats.find(c => c.name.toLowerCase() === 'mango');
      if (found) { log('Found existing ✓', { _id: found._id }); return found; }
    }
    fail('createParentCategory', e);
    throw e;
  }
}

// ─── STEP 4: Create sub-categories ───────────────────────────────────────────
async function createSubCategories(parentCategoryId) {
  log(`Creating 10 sub-categories under parent: ${parentCategoryId}`);
  const created = [];

  for (let i = 0; i < MANGO_VARIETIES.length; i++) {
    const v = MANGO_VARIETIES[i];
    try {
      const res = await api.post('/categories', {
        name: v.name,
        description: v.desc,
        parentCategoryId,
        image: MANGO_IMAGES[i % MANGO_IMAGES.length],
        isFeatured: i < 3,
        showInMenu: true,
        commissionRate: 10,
        displayOrder: i + 1,
      });
      const cat = res.data.category || res.data.data || res.data;
      log(`  [${i + 1}/10] ✓ ${v.name}  (${cat._id})`);
      created.push({ _id: cat._id, name: cat.name, varietyIndex: i });
      await sleep(150);
    } catch (e) {
      if (e?.response?.data?.message?.includes('already exists')) {
        log(`  [${i + 1}/10] ⚠ "${v.name}" already exists`);
        try {
          const r2 = await api.get('/categories', { params: { search: v.name, limit: 10 } });
          const cats = r2.data.categories || r2.data.data || [];
          const found = cats.find(c => c.name === v.name);
          if (found) created.push({ _id: found._id, name: found.name, varietyIndex: i });
        } catch (_) {}
      } else {
        fail(`subCat[${v.name}]`, e);
      }
    }
  }
  log(`Sub-categories ready: ${created.length}/10`);
  return created;
}

// ─── STEP 5: Build product payload (correct schema) ──────────────────────────
function buildProduct(varietyIdx, parentCat, subCat, templateIdx) {
  const variety  = MANGO_VARIETIES[varietyIdx];
  const tpl      = PRODUCT_TEMPLATES[templateIdx];
  const basePrice = BASE_PRICES[varietyIdx];

  const regularPrice = Math.round(basePrice * tpl.priceBase);
  // salePrice must be STRICTLY less than regularPrice
  const salePrice    = Math.round(regularPrice * 0.88);
  const imgOffset    = varietyIdx + templateIdx;

  const shortName = variety.name.replace(' Mangoes', '');

  return {
    // ── Identity ────────────────────────────────────────────────────────────
    name: `${shortName} Mango — ${tpl.label}`,

    // ── Description (required: short as string, optional: long) ────────────
    description: {
      short: `${tpl.grade} ${shortName} mango | ${tpl.weight} | Origin: ${variety.origin} | Farm fresh, handpicked.`,
      long: `${variety.desc}\n\nPack: ${tpl.label} (${tpl.weight})\nGrade: ${tpl.grade}\nOrigin: ${variety.origin}\n\nHandpicked at peak ripeness and packed in eco-friendly packaging. Delivered fresh within 24–48 hours of dispatch. No artificial ripening agents used.`,
      features: [
        `Grade: ${tpl.grade}`,
        `Weight: ${tpl.weight}`,
        `Origin: ${variety.origin}, India`,
        'No artificial ripening',
        'Farm to door delivery',
      ],
    },

    // ── Category (must be nested object with mainCategoryId + mainCategoryName) ──
    category: {
      mainCategoryId:   parentCat._id,
      mainCategoryName: parentCat.name,         // "Mango"
      subCategoryId:    subCat._id,
      subCategoryName:  subCat.name,            // e.g. "Alphonso Mangoes"
    },

    // ── Required fields ─────────────────────────────────────────────────────
    brand: 'Farm Fresh India',

    // ── Pricing (nested object, salePrice < regularPrice enforced) ──────────
    pricing: {
      regularPrice,
      salePrice,
      finalPrice: salePrice,
      currency: 'INR',
    },

    // ── Availability ─────────────────────────────────────────────────────────
    availability: {
      isAvailable:   true,
      stockQuantity: tpl.qty,
      lowStockLevel: 10,
      stockStatus:   'in_stock',
    },

    // ── Images (array of { url, isPrimary, altText, order }) ─────────────────
    images: makeImages(`${shortName} Mango ${tpl.label}`, 3, imgOffset),

    // ── Meta / SEO ────────────────────────────────────────────────────────────
    tags: ['mango', 'fresh fruit', shortName.toLowerCase(), tpl.grade.toLowerCase(), 'seasonal', variety.origin.toLowerCase()],
    isFeatured: templateIdx === 0 || templateIdx === 5,
    isActive:   true,
    condition:  'new',

    taxInfo: {
      hsnCode: '08045010',   // HSN for fresh mangoes
      gstRate:  5,
    },

    // ── Global product (visible everywhere) ──────────────────────────────────
    isGlobalProduct:       true,
    regionalAvailability:  [],
    regionalPricing:       [],

    // ── Variants ─────────────────────────────────────────────────────────────
    hasVariants: true,
    variants: [
      {
        // attributes must be array of { name, value } objects
        attributes: [
          { name: 'Weight', value: tpl.weight },
          { name: 'Grade',  value: tpl.grade  },
        ],
        price:     regularPrice,
        salePrice: salePrice,
        stock:     tpl.qty,
        isActive:  true,
        images: makeImages(`${shortName} Mango`, 1, imgOffset),
      },
    ],
  };
}

// ─── STEP 6: Create all products ─────────────────────────────────────────────
async function createProducts(parentCat, subCategories) {
  let created = 0, failed = 0;
  const total = subCategories.length * PRODUCT_TEMPLATES.length;

  log(`Creating ${total} products (${PRODUCT_TEMPLATES.length} per sub-category)...`);
  console.log('');

  for (const subCat of subCategories) {
    const vi = subCat.varietyIndex;
    log(`── ${MANGO_VARIETIES[vi].name}`);

    for (let ti = 0; ti < PRODUCT_TEMPLATES.length; ti++) {
      const payload = buildProduct(vi, parentCat, subCat, ti);
      try {
        await api.post('/products', payload);
        log(`   [${ti + 1}/10] ✓ ${payload.name}  ₹${payload.pricing.salePrice} (reg ₹${payload.pricing.regularPrice})`);
        created++;
        await sleep(120);
      } catch (e) {
        const msg = e?.response?.data?.message || e?.message || '';
        if (msg.includes('already exists') || msg.includes('duplicate') || msg.includes('sku')) {
          log(`   [${ti + 1}/10] ⚠ Already exists — skip`);
        } else {
          fail(`product[${payload.name}]`, e);
          // print full error for first failure
          if (failed === 0) console.error('  FULL ERR:', JSON.stringify(e?.response?.data, null, 2));
          failed++;
        }
      }
    }
    console.log('');
  }
  return { created, failed };
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('   Mango Product Seeder v2 — EPI Backend');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    await adminLogin();
    console.log('');

    const sellerId = await makeUserSeller();
    console.log('');

    const parentCat = await createParentCategory();
    console.log('');

    const subCats = await createSubCategories(parentCat._id);
    console.log('');

    const { created, failed } = await createProducts(parentCat, subCats);

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('   SEEDING COMPLETE');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`   Parent category   : ${parentCat.name} (${parentCat._id})`);
    console.log(`   Sub-categories    : ${subCats.length}/10`);
    console.log(`   Products created  : ${created}`);
    console.log(`   Products failed   : ${failed}`);
    console.log(`   Seller promoted   : ${SELLER_EMAIL} ${sellerId ? '✓ → role: seller' : '✗ not found'}`);
    console.log('\n   Test endpoints:');
    console.log(`   GET ${BASE_URL}/categories?limit=50        → find "Mango"`);
    console.log(`   GET ${BASE_URL}/products?limit=20&page=1   → all products`);
    console.log('═══════════════════════════════════════════════════════\n');
  } catch (e) {
    console.error('\n✗ Fatal:', e?.response?.data || e?.message);
    process.exit(1);
  }
}

main();
