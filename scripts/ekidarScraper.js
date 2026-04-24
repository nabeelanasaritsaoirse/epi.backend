/**
 * scripts/ekidarScraper.js
 *
 * Scrapes products from ekidar.com (IndiaMART seller) and lists them
 * on our platform with installment plans, category matching, and S3 images.
 *
 * Usage:
 *   node scripts/ekidarScraper.js                    # scrape all categories
 *   node scripts/ekidarScraper.js --dry-run           # preview only
 *   node scripts/ekidarScraper.js --limit 10          # first 10 products
 *   node scripts/ekidarScraper.js --category humidifier  # single category
 */

require('dotenv').config();
const axios  = require('axios');
const https  = require('https');
const { uploadImageToS3 } = require('../services/awsUploadService');

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const VENDOR_NAME    = 'Ekidar';
const VENDOR_BASE    = 'https://www.ekidar.com';
const SITEMAP_URL    = `${VENDOR_BASE}/sitemap.xml`;
const API_BASE_URL   = process.env.API_BASE     || 'http://13.127.15.87:8080/api';
const ADMIN_EMAIL    = process.env.ADMIN_EMAIL   || 'admin@epi.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD|| '@Saoirse123';
const MIN_PRICE      = 250;
const CRAWL_DELAY    = 1500;

const DRY_RUN     = process.argv.includes('--dry-run');
const LIMIT       = (() => { const i = process.argv.indexOf('--limit');    return i >= 0 ? +process.argv[i+1] : Infinity; })();
const SINGLE_CAT  = (() => { const i = process.argv.indexOf('--category'); return i >= 0 ? process.argv[i+1] : null; })();

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const web = axios.create({ timeout: 20000, httpsAgent, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EkidarScraper/1.0)' } });
const api = axios.create({ baseURL: API_BASE_URL, timeout: 30000 });

function setAuth(t) { api.defaults.headers.common['Authorization'] = `Bearer ${t}`; }
function log(...a)  { console.log(`[${new Date().toLocaleTimeString()}]`, ...a); }
function warn(...a) { console.warn(`[${new Date().toLocaleTimeString()}]`, ...a); }
function sleep(ms)  { return new Promise(r => setTimeout(r, ms)); }

// ─── PRICE PARSER ─────────────────────────────────────────────────────────────
function parsePrice(str) {
  const m = (str || '').replace(/&nbsp;/g, ' ').match(/Rs\s*([\d,]+)/);
  if (!m) return MIN_PRICE;
  return Math.max(parseInt(m[1].replace(/,/g, ''), 10), MIN_PRICE);
}

// ─── EXTRACT PRODUCT OBJECTS FROM HTML ────────────────────────────────────────
// Products are embedded as JS objects: {"img_id":1,"img_path":"...","prd_name":"...","prd_price":"...","isq_det_form":[...]}
function extractProductsFromHtml(html) {
  const seen = new Set();
  const products = [];

  // Find every occurrence of "prd_name" and extract the surrounding {...} object
  let searchFrom = 0;
  while (true) {
    const nameIdx = html.indexOf('"prd_name"', searchFrom);
    if (nameIdx === -1) break;

    // Walk backward to the opening brace of this object
    let start = nameIdx - 1;
    while (start >= 0 && html[start] !== '{') start--;
    if (start < 0) { searchFrom = nameIdx + 1; continue; }

    // Walk forward counting braces, respecting strings
    let depth = 1, j = start + 1;
    while (j < html.length && depth > 0) {
      const ch = html[j];
      if (ch === '{') { depth++; j++; }
      else if (ch === '}') { depth--; j++; }
      else if (ch === '"' || ch === "'") {
        const q = ch; j++;
        while (j < html.length && html[j] !== q) {
          if (html[j] === '\\') j++; // skip escaped char
          j++;
        }
        j++; // closing quote
      } else { j++; }
    }

    const block = html.slice(start, j)
      .replace(/&nbsp;/g, ' ')
      .replace(/,\s*\]/g, ']')
      .replace(/,\s*\}/g, '}');

    if (block.includes('"prd_price"') && block.includes('"img_path"')) {
      try {
        const obj = JSON.parse(block);
        if (obj.prd_name && obj.prd_price && obj.img_path && !seen.has(obj.prd_id)) {
          seen.add(obj.prd_id);
          products.push(obj);
        }
      } catch (_) { /* malformed JSON — skip */ }
    }

    searchFrom = nameIdx + 10;
  }

  return products;
}

// ─── INSTALLMENT PLANS ────────────────────────────────────────────────────────
function buildPlans(price) {
  const p = Math.max(price, MIN_PRICE);
  return [
    { name: '5-Day Quick Plan',    days: 5,  perDayAmount: Math.ceil(p / 5),  isRecommended: false, description: `Pay ₹${Math.ceil(p/5)}/day for 5 days`  },
    { name: '10-Day Standard Plan',days: 10, perDayAmount: Math.ceil(p / 10), isRecommended: true,  description: `Pay ₹${Math.ceil(p/10)}/day for 10 days` },
    { name: '30-Day Monthly Plan', days: 30, perDayAmount: Math.ceil(p / 30), isRecommended: false, description: `Pay ₹${Math.ceil(p/30)}/day for 30 days` },
  ];
}

// ─── CATEGORY MATCHER ─────────────────────────────────────────────────────────
const CAT_MAP = {
  'humidifier':          ['home & kitchen', 'home and kitchen', 'smart home', 'household'],
  'kitchen':             ['kitchen storage', 'kitchen tools', 'kitchen utensils', 'kitchen', 'home & kitchen'],
  'accessories':         ['kitchen tools', 'kitchen utensils', 'kitchen storage', 'home & kitchen'],
  'personal':            ['body and skin care', 'beauty and grooming', 'mom care'],
  'care':                ['body and skin care', 'beauty and grooming'],
  'massager':            ['body and skin care', 'fitness and gym', 'gym accessories'],
  'body':                ['body and skin care', 'fitness and gym'],
  'fitness':             ['fitness and gym', 'gym accessories', 'sports equipment'],
  'gym':                 ['gym accessories', 'fitness and gym', 'sports equipment'],
  'sports':              ['sports equipment', 'fitness and gym', 'gym accessories'],
  'projector':           ['premium electronics', 'smart home', 'home & kitchen'],
  'electronics':         ['premium electronics', 'smart home'],
  'bottle':              ['bottles and flasks', 'bottles ,flasks', 'reusable water bottles'],
  'flask':               ['bottles and flasks', 'bottles ,flasks', 'reusable water bottles'],
  'household':           ['home & kitchen', 'home goods & kitchenware', 'kitchen storage'],
  'decorative':          ['smart home', 'home & kitchen'],
  'lights':              ['smart home', 'home & kitchen'],
  'laptop':              ['premium electronics', 'smart home'],
  'bag':                 ["women's bag", 'home & kitchen'],
  'toy':                 ['baby care', 'kids'],
  'baby':                ['baby care', 'baby caring', 'baby bath'],
  'pet':                 ['home & kitchen'],
};

function matchCategory(catSlug, platformCategories) {
  const words = catSlug.replace(/-/g, ' ').split(' ');

  for (const word of words) {
    const mapped = CAT_MAP[word];
    if (mapped) {
      for (const mk of mapped) {
        const found = platformCategories.find(c => c.name.toLowerCase().includes(mk.toLowerCase()));
        if (found) return found;
      }
    }
  }

  // Fuzzy fallback
  for (const word of words) {
    const found = platformCategories.find(c => c.name.toLowerCase().includes(word.toLowerCase()));
    if (found) return found;
  }

  // Last resort
  return platformCategories.find(c => c.name.toLowerCase().includes('home')) || platformCategories[0];
}

// ─── ADMIN AUTH ───────────────────────────────────────────────────────────────
async function adminLogin() {
  const res = await api.post('/admin-auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  const data = res.data.data || res.data;
  setAuth(data.accessToken || data.token);
  log(`Admin login ✓ (${ADMIN_EMAIL})`);
}

async function fetchCategories() {
  const res = await api.get('/categories', { params: { limit: 100 } });
  return res.data.categories || res.data.data || [];
}

async function productExists(name) {
  try {
    const res = await api.get('/products/admin/all', { params: { search: name, limit: 3 } });
    const list = res.data.products || res.data.data || [];
    return list.some(p => p.name.toLowerCase() === name.toLowerCase());
  } catch { return false; }
}

// ─── IMAGE UPLOAD ─────────────────────────────────────────────────────────────
async function uploadImage(url, idx) {
  if (DRY_RUN) return url;
  try {
    // Prefer 500x500 over 250x250 or 125x125
    const hiRes = url.replace(/-(?:125x125|250x250|500x500)\./g, '-500x500.');
    return await uploadImageToS3(hiRes, idx);
  } catch {
    return url; // fallback: use vendor CDN URL
  }
}

// ─── SITEMAP CATEGORIES ───────────────────────────────────────────────────────
async function fetchSitemapCategories() {
  const res = await web.get(SITEMAP_URL);
  const html = res.data;
  const skip = new Set(['/', '/profile.html', '/products.html', '/testimonial.html']);
  const urls = [...html.matchAll(/<loc>(https?:\/\/www\.ekidar\.com([^<]+\.html))<\/loc>/g)]
    .map(m => ({ full: m[1], path: m[2] }))
    .filter(u => !skip.has(u.path));
  return [...new Set(urls.map(u => u.full))];
}

// ─── CREATE PRODUCT ───────────────────────────────────────────────────────────
async function createProduct(payload) {
  try {
    const res = await api.post('/products', payload);
    return res.data.data || res.data;
  } catch (e) {
    throw new Error(`${e.response?.status} ${JSON.stringify(e.response?.data || e.message).slice(0, 200)}`);
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  log('='.repeat(60));
  log(`Ekidar Scraper — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  log(`Vendor: ${VENDOR_BASE}`);
  log(`API:    ${API_BASE_URL}`);
  log('='.repeat(60));

  // Resolve category URLs
  let catUrls;
  if (SINGLE_CAT) {
    const slug = SINGLE_CAT.replace(/\.html$/, '');
    catUrls = [`${VENDOR_BASE}/${slug}.html`];
    log(`Single category mode: ${catUrls[0]}`);
  } else {
    catUrls = await fetchSitemapCategories();
    log(`Found ${catUrls.length} category pages in sitemap`);
  }

  // Admin login & platform categories
  let platformCategories = [];
  if (!DRY_RUN) {
    await adminLogin();
    platformCategories = await fetchCategories();
    log(`Loaded ${platformCategories.length} platform categories`);
  }

  const results  = { created: 0, skipped: 0, failed: 0 };
  let   processed = 0;
  const seenPrdIds = new Set(); // global dedup across categories

  for (const catUrl of catUrls) {
    if (processed >= LIMIT) break;

    const catSlug = catUrl.split('/').pop().replace('.html', '');
    log(`\n📂 Category: ${catSlug} — ${catUrl}`);

    // Fetch category page
    let html;
    try {
      const r = await web.get(catUrl);
      html = r.data;
    } catch (e) {
      warn(`  ✗ Fetch failed: ${e.message}`);
      continue;
    }

    const rawProducts = extractProductsFromHtml(html);
    // Deduplicate by prd_id across all categories
    const products = rawProducts.filter(p => !seenPrdIds.has(p.prd_id));
    products.forEach(p => seenPrdIds.add(p.prd_id));
    log(`  Found ${rawProducts.length} products (${products.length} new after dedup)`);

    const cat = DRY_RUN ? null : matchCategory(catSlug, platformCategories);
    if (!DRY_RUN && cat) log(`  → Platform category: ${cat.name}`);

    for (const p of products) {
      if (processed >= LIMIT) break;

      const name  = p.prd_name.trim();
      const price = parsePrice(p.prd_price);
      processed++;

      log(`\n  [${processed}] ${name.slice(0, 65)}`);
      log(`        Price: ₹${price}`);

      if (DRY_RUN) {
        log(`        [DRY RUN] Plans: ₹${Math.ceil(price/5)}/d×5 | ₹${Math.ceil(price/10)}/d×10 | ₹${Math.ceil(price/30)}/d×30`);
        results.created++;
        continue;
      }

      // Dedup check against live platform
      if (await productExists(name)) {
        log(`        ⊘ Already exists — skipping`);
        results.skipped++;
        await sleep(300);
        continue;
      }

      try {
        // Upload images (primary 500x500 + secondary if available)
        const imgUrls = [p.img_path, p.img_path1].filter(Boolean);
        const images  = [];
        for (let i = 0; i < imgUrls.length; i++) {
          const s3url = await uploadImage(imgUrls[i], i);
          images.push({ url: s3url, isPrimary: i === 0, altText: `${name} image ${i + 1}`, order: i + 1 });
          await sleep(300);
        }

        // Specs from isq_det_form
        const specs = (p.isq_det_form || [])
          .filter(s => s.FK_IM_SPEC_MASTER_DESC && s.SUPPLIER_RESPONSE_DETAIL)
          .map(s => ({ key: s.FK_IM_SPEC_MASTER_DESC, value: s.SUPPLIER_RESPONSE_DETAIL }));

        const longDesc = specs.length
          ? specs.map(s => `${s.key}: ${s.value}`).join('. ')
          : name;

        const payload = {
          name,
          brand:        VENDOR_NAME,
          condition:    'new',
          status:       'published',
          listingStatus:'published',
          hasVariants:  false,
          description: {
            short:          name.slice(0, 150),
            long:           longDesc,
            features:       specs.slice(0, 5).map(s => `${s.key}: ${s.value}`),
            specifications: specs,
          },
          category: {
            mainCategoryId:   cat._id,
            mainCategoryName: cat.name,
            subCategoryId:    null,
            subCategoryName:  null,
          },
          pricing:      { regularPrice: price, salePrice: null, currency: 'INR' },
          availability: { isAvailable: true, stockQuantity: 100 },
          images,
          plans:        buildPlans(price),
          seo: {
            metaTitle:       `${name.slice(0, 50)} | Buy Online`,
            metaDescription: name.slice(0, 155),
            keywords:        [VENDOR_NAME, catSlug.replace(/-/g, ' '), 'buy online', 'india'],
          },
        };

        const created = await createProduct(payload);
        log(`        ✓ Created: ${created.productId || created._id}`);
        results.created++;
      } catch (e) {
        warn(`        ✗ Failed: ${e.message}`);
        results.failed++;
      }

      await sleep(CRAWL_DELAY);
    }

    await sleep(CRAWL_DELAY);
  }

  log('\n' + '='.repeat(60));
  log('Done! Results:');
  log(`  ✓ Created : ${results.created}`);
  log(`  ⊘ Skipped : ${results.skipped}  (already existed)`);
  log(`  ✗ Failed  : ${results.failed}`);
  log('='.repeat(60));
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
