/**
 * Script: makeNishantSeller.js
 * 1. Find nishant.it.saoirse@gmail.com via admin API
 * 2. Add sellerProfile to user via admin update
 * 3. Fetch all 100 mango products
 * 4. Update each product → sellerId = nishant._id, sellerInfo, listingStatus=published
 *
 * Run: node scripts/makeNishantSeller.js
 */

const axios = require('axios');

const BASE_URL     = 'http://13.127.15.87:8080/api';
const SELLER_EMAIL = 'nishant.it.saoirse@gmail.com';
const STORE_NAME   = 'Nishant Mango Store';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function run() {
  console.log('\n══════════════════════════════════════════════════');
  console.log('  Make Nishant a Seller + Assign Mango Products');
  console.log('══════════════════════════════════════════════════\n');

  // ── Login ───────────────────────────────────────────────────────────────────
  const login = await axios.post(`${BASE_URL}/admin-auth/login`, {
    email: 'admin@epi.com',
    password: '@Saoirse123',
  });
  const token = login.data.data.accessToken;
  const api   = axios.create({
    baseURL: BASE_URL,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    timeout: 15000,
  });
  console.log('Admin login ✓');

  // ── Find nishant ────────────────────────────────────────────────────────────
  const usersRes = await api.get('/users/admin', { params: { search: SELLER_EMAIL, limit: 20 } });
  const users    = usersRes.data.users || usersRes.data.data || [];
  const nishant  = users.find(u => u.email === SELLER_EMAIL);

  if (!nishant) {
    console.error(`✗ User "${SELLER_EMAIL}" not found`);
    return;
  }
  console.log(`Found: ${nishant.name} | _id: ${nishant._id} | role: ${nishant.role}`);

  const sellerId  = nishant._id;

  // ── Add sellerProfile via user update ───────────────────────────────────────
  // The admin PUT endpoint accepts arbitrary fields — we send sellerProfile nested
  try {
    await api.put(`/users/admin/${sellerId}`, {
      role: 'super_admin',  // keep admin access
      sellerProfile: {
        storeName:        STORE_NAME,
        storeDescription: 'Premium quality mangoes sourced directly from farms across India.',
        isVerified:       true,
        commissionRate:   10,
      },
    });
    console.log('sellerProfile added ✓');
  } catch (e) {
    console.log('⚠ sellerProfile update skipped:', e?.response?.data?.message || e.message);
  }

  // ── Fetch all mango products (paginate) ─────────────────────────────────────
  // Admin endpoint returns all products regardless of listingStatus
  let allMangoProducts = [];
  let page = 1;
  const limit = 50;

  while (true) {
    const res = await api.get('/products/admin/all', {
      params: { page, limit, search: 'Mango', category: 'Mango' }
    }).catch(() => null);

    // Fallback: try public endpoint with larger limit
    const res2 = res || await api.get('/products', { params: { page, limit } }).catch(() => null);

    const items = res2?.data?.products || res2?.data?.data || [];
    if (items.length === 0) break;

    // Filter only mango products
    const mangoItems = items.filter(p =>
      p.category?.mainCategoryName === 'Mango' ||
      p.name?.toLowerCase().includes('mango')
    );
    allMangoProducts.push(...mangoItems);

    if (items.length < limit) break;
    page++;
  }

  console.log(`\nFound ${allMangoProducts.length} mango products to assign`);

  if (allMangoProducts.length === 0) {
    // Try broader search
    const res = await api.get('/products', { params: { limit: 200, page: 1 } });
    const all  = res.data.products || res.data.data || [];
    allMangoProducts = all.filter(p =>
      p.category?.mainCategoryName === 'Mango' ||
      p.name?.toLowerCase().includes('mango')
    );
    console.log(`Broader search found: ${allMangoProducts.length}`);
  }

  // ── Update each product with sellerId ───────────────────────────────────────
  let updated = 0, failed = 0;

  for (const product of allMangoProducts) {
    const pid = product.productId || product._id;
    try {
      await api.put(`/products/${pid}`, {
        sellerId,
        sellerInfo: {
          storeName:  STORE_NAME,
          rating:     5.0,
          isVerified: true,
        },
        listingStatus: 'published',
      });
      updated++;
      process.stdout.write(`\r  Updating products: ${updated}/${allMangoProducts.length}`);
      await sleep(80);
    } catch (e) {
      failed++;
      console.log(`\n  ✗ Failed [${product.name}]: ${e?.response?.data?.message || e.message}`);
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log('\n\n══════════════════════════════════════════════════');
  console.log('  COMPLETE');
  console.log('══════════════════════════════════════════════════');
  console.log(`  Seller       : ${nishant.name}`);
  console.log(`  Email        : ${SELLER_EMAIL}`);
  console.log(`  Seller ID    : ${sellerId}`);
  console.log(`  Products OK  : ${updated}`);
  console.log(`  Products ERR : ${failed}`);
  console.log(`\n  Order Flow Now:`);
  console.log(`  User orders any mango product`);
  console.log(`    → order.sellerId       = ${sellerId}`);
  console.log(`    → sellerFulfillStatus  = "pending"`);
  console.log(`    → Nishant sees it in seller dashboard`);
  console.log(`\n  Seller Dashboard: GET ${BASE_URL}/seller/dashboard`);
  console.log(`  Seller Orders   : GET ${BASE_URL}/seller/orders`);
  console.log('══════════════════════════════════════════════════\n');
}

run().catch(e => {
  console.error('\nFatal:', e?.response?.data || e.message);
  process.exit(1);
});
