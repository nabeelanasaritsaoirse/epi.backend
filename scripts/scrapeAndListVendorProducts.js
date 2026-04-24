/**
 * Vendor Product Scraper & Auto-Lister
 * ─────────────────────────────────────
 * Scrapes products from varmoraplastech.com (WooCommerce) and lists them
 * on this platform using the admin API.
 *
 * Pipeline:
 *   1. Crawl /shop/ pages → collect all product URLs
 *   2. Per product: scrape HTML + JSON-LD → AI-normalize → upload images to S3
 *   3. POST to /api/products via admin API
 *
 * Usage:
 *   node scripts/scrapeAndListVendorProducts.js
 *   node scripts/scrapeAndListVendorProducts.js --dry-run       (no API calls)
 *   node scripts/scrapeAndListVendorProducts.js --url <URL>     (single product)
 *   node scripts/scrapeAndListVendorProducts.js --limit 5       (first N products)
 *
 * Required env vars (.env):
 *   ANTHROPIC_API_KEY=sk-ant-...
 *   ADMIN_EMAIL=...
 *   ADMIN_PASSWORD=...
 *   API_BASE_URL=http://localhost:3000/api   (or production URL)
 *   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_S3_BUCKET_NAME
 */

require('dotenv').config();

const axios   = require('axios');
const cheerio = require('cheerio');
const path    = require('path');
const Anthropic = require('@anthropic-ai/sdk');

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const VENDOR_SHOP_URL = 'https://varmoraplastech.com/shop/';
const VENDOR_NAME     = 'Varmora';
const VENDOR_BRAND    = 'Varmora';

const API_BASE_URL    = process.env.API_BASE_URL   || 'http://13.127.15.87:8080/api';
const ADMIN_EMAIL     = process.env.ADMIN_EMAIL    || 'admin@epi.com';
const ADMIN_PASSWORD  = process.env.ADMIN_PASSWORD || '@Saoirse123';

const DRY_RUN   = process.argv.includes('--dry-run');
const LIMIT_IDX = process.argv.indexOf('--limit');
const LIMIT     = LIMIT_IDX !== -1 ? parseInt(process.argv[LIMIT_IDX + 1], 10) : null;
const URL_IDX   = process.argv.indexOf('--url');
const SINGLE_URL = URL_IDX !== -1 ? process.argv[URL_IDX + 1] : null;

const CRAWL_DELAY_MS    = 1500; // be polite to vendor server
const MIN_PRODUCT_PRICE = 250;  // minimum regularPrice on platform

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const log   = (msg) => console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
const warn  = (msg) => console.warn(`[${new Date().toLocaleTimeString()}] ⚠  ${msg}`);
const fail  = (step, e) => {
  const msg = e?.response?.data?.message || e?.message || String(e);
  console.error(`[${new Date().toLocaleTimeString()}] ✗ [${step}]: ${msg}`);
};

// axios instances
const vendor = axios.create({
  timeout: 30000,
  headers: { 'User-Agent': 'EPI-Platform-ProductSync/1.0 (automated catalog import)' },
});

const api = axios.create({ baseURL: API_BASE_URL, timeout: 30000 });
const setAuth = (token) => {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  api.defaults.headers.common['Content-Type']  = 'application/json';
};

// Anthropic client (lazy — only initialized if API key present)
let anthropic = null;
const getAI = () => {
  if (!anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set in .env');
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropic;
};

// ─── AWS S3 upload (reuses existing service logic inline to avoid express context) ──
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const sharp = require('sharp');

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
const BUCKET = process.env.AWS_S3_BUCKET_NAME || 'company-video-storage-prod';

async function uploadImageToS3(imageUrl, index) {
  try {
    const resp = await vendor.get(imageUrl, { responseType: 'arraybuffer' });
    let buffer = Buffer.from(resp.data);

    // resize to 800px wide for consistency
    buffer = await sharp(buffer).resize({ width: 800, withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();

    const fileName = `vendor-${VENDOR_NAME.toLowerCase()}-${Date.now()}-${index}.jpg`;
    const key      = `vendor-products/${fileName}`;
    await s3.send(new PutObjectCommand({
      Bucket:      BUCKET,
      Key:         key,
      Body:        buffer,
      ContentType: 'image/jpeg',
    }));

    const region = process.env.AWS_REGION || 'ap-south-1';
    return `https://${BUCKET}.s3.${region}.amazonaws.com/${key}`;
  } catch (e) {
    warn(`Image upload failed for ${imageUrl}: ${e.message}`);
    return imageUrl; // fallback to original URL if S3 fails
  }
}

// ─── STAGE 1: COLLECT PRODUCT URLs VIA SITEMAP ───────────────────────────────
async function crawlShopPages() {
  log('Stage 1: Fetching product URLs from sitemap...');
  const urls = [];

  // Vendor uses JS-rendered shop page (WP Rocket) — sitemap is more reliable
  const sitemapUrls = [
    'https://varmoraplastech.com/product-sitemap1.xml',
    'https://varmoraplastech.com/product-sitemap2.xml',
  ];

  for (const sitemapUrl of sitemapUrls) {
    try {
      const { data } = await vendor.get(sitemapUrl);
      const matches = [...data.matchAll(/<loc>(https[^<]+)<\/loc>/g)];
      matches.forEach(m => {
        const url = m[1].trim();
        // Only real product pages (skip /shop/ and category pages)
        if (url.includes('/product/') && !urls.includes(url)) {
          urls.push(url);
        }
      });
    } catch (e) {
      fail(`sitemap:${sitemapUrl}`, e);
    }
    await sleep(500);
  }

  const result = LIMIT ? urls.slice(0, LIMIT) : urls;
  log(`  Found ${result.length} product URLs (total in sitemap: ${urls.length})`);
  return result;
}

// ─── STAGE 2a: SCRAPE A SINGLE PRODUCT PAGE ──────────────────────────────────
async function scrapeProductPage(url) {
  const { data: html } = await vendor.get(url);
  const $ = cheerio.load(html);

  // ── JSON-LD structured data (most reliable) ──
  let jsonLd = {};
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).html());
      if (parsed['@type'] === 'Product') jsonLd = parsed;
    } catch (_e) { /* skip malformed */ }
  });

  // ── Product name ──
  // The page uses JS rendering (WP Rocket), so extract from raw HTML patterns
  const rawHtml = $.html();

  const name = jsonLd.name
    || $('h1.product_title').text().trim()
    || $('h1.entry-title').text().trim()
    || (rawHtml.match(/<h1[^>]*>([^<]+)<\/h1>/)?.[1] || '').replace(/&amp;/g, '&').trim();

  // ── Prices (extracted from inline JS — WP Rocket hides JSON-LD) ──
  // WooCommerce injects "price":"839" in inline scripts
  const allPrices = [...rawHtml.matchAll(/"price"\s*:\s*"([0-9.]+)"/g)].map(m => parseFloat(m[1]));
  const regularPriceInline = [...rawHtml.matchAll(/regular_price[":]+([0-9.]+)/g)].map(m => parseFloat(m[1]))[0] || 0;
  const salePriceInline    = [...rawHtml.matchAll(/sale_price[":]+([0-9.]+)/g)].map(m => parseFloat(m[1]))[0] || 0;

  const uniquePrices = [...new Set(allPrices)].sort((a, b) => a - b);
  const lowPrice  = parseFloat(jsonLd.offers?.lowPrice  || jsonLd.offers?.price || regularPriceInline || salePriceInline || uniquePrices[0] || 0);
  const highPrice = parseFloat(jsonLd.offers?.highPrice || jsonLd.offers?.price || regularPriceInline || uniquePrices[uniquePrices.length - 1] || lowPrice || 0);
  const currency  = jsonLd.offers?.priceCurrency || 'INR';

  // ── Images (from JSON-LD, gallery, and inline wp-content URLs) ──
  const imageUrls = [];
  if (jsonLd.image) {
    const imgs = Array.isArray(jsonLd.image) ? jsonLd.image : [jsonLd.image];
    imgs.forEach(img => {
      const src = typeof img === 'string' ? img : img.url || img.contentUrl;
      if (src && !imageUrls.includes(src)) imageUrls.push(src);
    });
  }
  // Gallery HTML
  $('.woocommerce-product-gallery__image img, .product-gallery img').each((_, el) => {
    const src = $(el).attr('data-large_image') || $(el).attr('src');
    if (src && !imageUrls.includes(src) && !src.includes('placeholder')) imageUrls.push(src);
  });
  // Fallback: extract unique wp-content image URLs from raw HTML (covers JS-injected galleries)
  if (imageUrls.length === 0) {
    const wpImgs = [...new Set(
      [...rawHtml.matchAll(/https:\/\/varmoraplastech\.com\/wp-content\/uploads\/[^\s"'<>]+\.(jpg|jpeg|png|webp)/gi)]
        .map(m => m[0])
        .filter(u => !u.includes('-150x') && !u.includes('-300x') && !u.includes('-100x'))
    )];
    wpImgs.slice(0, 5).forEach(src => imageUrls.push(src));
  }

  // ── Description ──
  const descLong = $('.woocommerce-product-details__short-description, .woocommerce-Tabs-panel--description').text().trim()
    || jsonLd.description
    || (rawHtml.match(/"description"\s*:\s*"([^"]{20,})"/)?.[1] || '').replace(/\\n/g, ' ').replace(/\\u[0-9a-f]{4}/gi, '');

  // ── SKU ──
  const sku = (rawHtml.match(/"sku"\s*:\s*"([^"]+)"/)?.[1]) || '';

  // ── Specifications (Additional information tab) ──
  const specs = [];
  $('.woocommerce-product-attributes tr, .shop_attributes tr').each((_, el) => {
    const key   = $(el).find('th').text().trim();
    const value = $(el).find('td').text().trim().replace(/\s+/g, ' ');
    if (key && value) specs.push({ key, value });
  });

  // ── Variants (dropdown select options) ──
  const variantAttributes = {};
  $('table.variations tr, .variations tr').each((_, el) => {
    const label = $(el).find('td.label label').text().trim()
      || $(el).find('label').text().trim();
    const options = [];
    $(el).find('select option').each((_2, opt) => {
      const val = $(opt).attr('value');
      if (val && val !== '') options.push(val);
    });
    if (label && options.length) variantAttributes[label] = options;
  });

  // ── Availability ──
  const isAvailable = jsonLd.offers?.availability !== 'https://schema.org/OutOfStock';

  // ── Category from breadcrumb or inline ──
  const breadcrumb = [];
  $('.woocommerce-breadcrumb a, nav.breadcrumb a, .breadcrumbs a').each((_, el) => {
    const text = $(el).text().trim();
    if (text && text !== 'Home') breadcrumb.push(text);
  });
  // Also grab category from inline Yoast data
  const inlineCat = rawHtml.match(/"category"\s*:\s*"([^"]+)"/)?.[1] || '';
  if (inlineCat && !breadcrumb.includes(inlineCat)) breadcrumb.push(inlineCat);

  // ── Tags ──
  const tags = [];
  $('.tagged_as a, .product_meta .tagged_as a').each((_, el) => tags.push($(el).text().trim()));

  return { url, name, lowPrice, highPrice, currency, imageUrls, descLong, specs, sku, variantAttributes, isAvailable, breadcrumb, tags };
}

// ─── STAGE 2b: AI NORMALIZE ───────────────────────────────────────────────────
async function aiNormalize(scraped, platformCategories) {
  const categoryNames = platformCategories.map(c => `${c.name} (id: ${c._id})`).join(', ');

  const prompt = `You are a product data specialist. Given scraped WooCommerce product data, return a JSON object that maps to the platform's Product schema.

SCRAPED DATA:
${JSON.stringify(scraped, null, 2)}

AVAILABLE PLATFORM CATEGORIES:
${categoryNames || 'None found — suggest "Kitchenware" or "Plastic Containers"'}

RULES:
1. description.short: 1 sentence, max 100 chars, highlight key benefit
2. description.features: extract 3-5 bullet points from descLong and specs
3. description.specifications: convert specs array to [{key, value, unit?}]
4. seo.metaTitle: "<ProductName> | Buy Online | Best Price" (max 60 chars)
5. seo.metaDescription: 1-2 sentences, include price if available (max 160 chars)
6. seo.keywords: 5-8 relevant search keywords as array
7. category: pick the best matching category from the list above; use its id for mainCategoryId
8. pricing: set regularPrice = highPrice, salePrice = lowPrice (if different), else regularPrice = lowPrice
9. variants: if variantAttributes has options, create a variant object per combination
   - Each variant needs: attributes:[{name, value}], price:number, salePrice:number|null, currency:"INR", stockQuantity:50, isAvailable:true
   - Distribute the price range evenly across variants (smallest option = lowest price)
10. hasVariants: true if there are variants, else false
11. brand: "${VENDOR_BRAND}"
12. condition: "new"
13. status: "published"
14. listingStatus: "published"

RETURN ONLY valid JSON with this exact structure (no explanation):
{
  "name": "string",
  "brand": "string",
  "condition": "new",
  "status": "published",
  "listingStatus": "published",
  "hasVariants": boolean,
  "description": {
    "short": "string",
    "long": "string",
    "features": ["string"],
    "specifications": [{"key": "string", "value": "string"}]
  },
  "category": {
    "mainCategoryId": "string or null",
    "mainCategoryName": "string",
    "subCategoryId": "string or null",
    "subCategoryName": "string or null"
  },
  "pricing": {
    "regularPrice": number,
    "salePrice": number or null,
    "currency": "INR"
  },
  "availability": {
    "isAvailable": boolean,
    "stockQuantity": 100
  },
  "seo": {
    "metaTitle": "string",
    "metaDescription": "string",
    "keywords": ["string"]
  },
  "variants": [
    {
      "attributes": [{"name": "string", "value": "string"}],
      "price": number,
      "salePrice": number or null,
      "currency": "INR",
      "stockQuantity": 50,
      "isAvailable": true
    }
  ]
}`;

  const ai = getAI();
  const msg = await ai.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = msg.content[0].text.trim();
  // Extract JSON even if there's surrounding text
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('AI did not return valid JSON');
  return JSON.parse(match[0]);
}

// ─── HELPER: Build installment plans (min 5-day, based on product price) ──────
function buildPlans(price) {
  // Minimum selling price is ₹250; calculate per-day amounts from that
  const p = Math.max(price, MIN_PRODUCT_PRICE);
  return [
    {
      name:          '5-Day Quick Plan',
      days:          5,
      perDayAmount:  Math.ceil(p / 5),
      isRecommended: false,
      description:   `Pay ₹${Math.ceil(p / 5)}/day for 5 days`,
    },
    {
      name:          '10-Day Standard Plan',
      days:          10,
      perDayAmount:  Math.ceil(p / 10),
      isRecommended: true,
      description:   `Pay ₹${Math.ceil(p / 10)}/day for 10 days`,
    },
    {
      name:          '30-Day Monthly Plan',
      days:          30,
      perDayAmount:  Math.ceil(p / 30),
      isRecommended: false,
      description:   `Pay ₹${Math.ceil(p / 30)}/day for 30 days`,
    },
  ];
}

// ─── STAGE 2b (FALLBACK): BASIC NORMALIZE (no AI) ────────────────────────────
function basicNormalize(scraped, platformCategories) {
  const { name, lowPrice, highPrice, descLong, specs, variantAttributes, isAvailable, breadcrumb } = scraped;

  // Enforce minimum price of ₹250
  const regularPrice = Math.max(highPrice || lowPrice || MIN_PRODUCT_PRICE, MIN_PRODUCT_PRICE);
  const rawSale      = lowPrice && lowPrice < (highPrice || lowPrice) ? lowPrice : null;
  const salePrice    = rawSale ? Math.max(rawSale, MIN_PRODUCT_PRICE) : null;

  // Build variants from scraped dropdown options
  const varKeys = Object.keys(variantAttributes);
  let variants = [];
  if (varKeys.length) {
    const combos = varKeys.length === 1
      ? variantAttributes[varKeys[0]].map(v => [{ name: varKeys[0], value: v }])
      : variantAttributes[varKeys[0]].flatMap(v1 =>
          variantAttributes[varKeys[1]].map(v2 => [
            { name: varKeys[0], value: v1 },
            { name: varKeys[1], value: v2 },
          ])
        );
    const priceStep = combos.length > 1 ? (regularPrice - (salePrice || regularPrice * 0.8)) / (combos.length - 1) : 0;
    variants = combos.map((attrs, i) => {
      const vPrice = Math.max(1, Math.round(regularPrice - priceStep * (combos.length - 1 - i)));
      const vSale  = salePrice ? Math.max(1, Math.round((salePrice || regularPrice * 0.8) + priceStep * i)) : null;
      return {
        attributes:   attrs,
        price:        vPrice,            // controller expects flat v.price
        salePrice:    vSale,             // controller expects flat v.salePrice
        currency:     'INR',
        stockQuantity: 50,
        isAvailable:  true,
      };
    });
  }

  // Pick best matching category — Varmora sells kitchen/storage products
  // Priority: Kitchen Storage > Home & Kitchen > Kitchen > Storage > first available
  const catKeywords = [
    ...breadcrumb,
    'kitchen storage', 'home & kitchen', 'home and kitchen', 'kitchen utensil',
    'kitchen tool', 'kitchen', 'storage', 'bottle', 'flask', 'cookware',
    VENDOR_BRAND.toLowerCase(),
  ];
  let cat = null;
  for (const kw of catKeywords) {
    cat = platformCategories.find(c => c.name.toLowerCase().includes(kw.toLowerCase()));
    if (cat) break;
  }
  if (!cat && platformCategories.length) cat = platformCategories[0];
  if (!cat) throw new Error('No platform categories found — cannot set mainCategoryId (required field)');

  const shortDesc = (descLong || name || '').replace(/\s+/g, ' ').slice(0, 100).trim();
  const features  = specs.slice(0, 5).map(s => `${s.key}: ${s.value}`);

  return {
    name,
    brand: VENDOR_BRAND,
    condition: 'new',
    status: 'published',
    listingStatus: 'published',
    hasVariants: variants.length > 0,
    description: {
      short: shortDesc || name.slice(0, 100),
      long:  descLong || '',
      features,
      specifications: specs.map(s => ({ key: s.key, value: s.value })),
    },
    category: {
      mainCategoryId:   cat._id,
      mainCategoryName: cat.name,
      subCategoryId:    null,
      subCategoryName:  null,
    },
    pricing: { regularPrice, salePrice, currency: 'INR' },
    availability: { isAvailable, stockQuantity: 100 },
    seo: {
      metaTitle:       `${name.slice(0, 50)} | Buy Online`,
      metaDescription: shortDesc || name.slice(0, 155),
      keywords:        [VENDOR_BRAND, 'food grade', 'BPA free', 'kitchenware', 'buy online'],
    },
    plans: buildPlans(regularPrice),
    variants,
  };
}

// ─── STAGE 2c: UPLOAD IMAGES ──────────────────────────────────────────────────
async function uploadImages(imageUrls) {
  log(`  Uploading ${imageUrls.length} image(s) to S3...`);
  const uploaded = [];
  for (let i = 0; i < imageUrls.length; i++) {
    if (DRY_RUN) {
      uploaded.push({ url: imageUrls[i], isPrimary: i === 0, altText: `Product image ${i + 1}`, order: i + 1 });
    } else {
      const s3Url = await uploadImageToS3(imageUrls[i], i);
      uploaded.push({ url: s3Url, isPrimary: i === 0, altText: `Product image ${i + 1}`, order: i + 1 });
    }
    await sleep(300);
  }
  return uploaded;
}

// ─── STAGE 3: ADMIN AUTH ─────────────────────────────────────────────────────
async function adminLogin() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env');
  }
  log('Logging in as admin...');
  const res = await api.post('/admin-auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  const data = res.data.data || res.data;
  const token = data.accessToken || data.token;
  setAuth(token);
  log(`Admin login ✓  (${data.email || ADMIN_EMAIL})`);
  return token;
}

// ─── STAGE 3: FETCH PLATFORM CATEGORIES ─────────────────────────────────────
async function fetchCategories() {
  try {
    const res = await api.get('/categories', { params: { limit: 100 } });
    return res.data.categories || res.data.data || [];
  } catch (_e) {
    warn('Could not fetch categories — AI will suggest one');
    return [];
  }
}

// ─── STAGE 3: FIND OR CREATE CATEGORY ────────────────────────────────────────
// Ensures a "Varmora Kitchen" category exists for all Varmora products
async function ensureVarmoraCategory(categories) {
  // First try to find a good existing match
  const keywords = ['kitchen storage', 'home & kitchen', 'kitchen', 'storage'];
  for (const kw of keywords) {
    const found = categories.find(c => c.name.toLowerCase().includes(kw));
    if (found) return found;
  }

  // Not found — create "Varmora Kitchen" category
  log('  Creating "Varmora Kitchen" category...');
  try {
    const res = await api.post('/categories', {
      name:         'Varmora Kitchen',
      description:  'Premium food-grade kitchen storage and lunch box products by Varmora. BPA-free, FDA approved, airtight containers and stainless steel products.',
      isFeatured:   false,
      showInMenu:   true,
      commissionRate: 10,
      displayOrder: 50,
    });
    const cat = res.data.category || res.data.data || res.data;
    log(`  Created category: ${cat.name} (${cat._id})`);
    categories.push(cat); // add to local cache
    return cat;
  } catch (e) {
    warn(`  Category creation failed: ${e.message}`);
    return categories[0]; // last resort fallback
  }
}

// ─── STAGE 3: DEDUP CHECK ────────────────────────────────────────────────────
async function productExists(name) {
  try {
    const res = await api.get('/products/admin/all', { params: { search: name, limit: 5 } });
    const products = res.data.products || res.data.data || [];
    return products.some(p => p.name.toLowerCase() === name.toLowerCase());
  } catch (_e) {
    return false; // if check fails, proceed anyway
  }
}

// ─── STAGE 3: CREATE PRODUCT ─────────────────────────────────────────────────
async function createProduct(payload) {
  try {
    const res = await api.post('/products', payload);
    return res.data.data || res.data;
  } catch (e) {
    const errDetail = JSON.stringify(e.response?.data);
    throw new Error(`${e.response?.status} ${errDetail}`);
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  log('='.repeat(60));
  log(`Vendor Product Scraper — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  log(`Vendor: ${VENDOR_SHOP_URL}`);
  log(`API:    ${API_BASE_URL}`);
  log('='.repeat(60));

  // ── Collect product URLs ──
  let productUrls;
  if (SINGLE_URL) {
    productUrls = [SINGLE_URL];
    log(`Single URL mode: ${SINGLE_URL}`);
  } else {
    productUrls = await crawlShopPages();
  }

  if (!productUrls.length) {
    log('No product URLs found. Exiting.');
    return;
  }

  // ── Admin auth & categories (skip in dry-run) ──
  let categories = [];
  if (!DRY_RUN) {
    await adminLogin();
    categories = await fetchCategories();
    log(`Loaded ${categories.length} platform categories`);
    // Ensure a suitable category exists for Varmora products
    await ensureVarmoraCategory(categories);
  }

  // ── Process each product ──
  const results = { created: 0, skipped: 0, failed: 0 };

  for (let i = 0; i < productUrls.length; i++) {
    const url = productUrls[i];
    log(`\n[${i + 1}/${productUrls.length}] ${url}`);

    try {
      // Scrape
      log('  Scraping...');
      const scraped = await scrapeProductPage(url);
      log(`  Name: ${scraped.name || '(not found)'}`);

      if (!scraped.name) {
        warn('  No product name found — skipping');
        results.failed++;
        continue;
      }

      // Dedup check
      if (!DRY_RUN) {
        const exists = await productExists(scraped.name);
        if (exists) {
          log(`  Already exists — skipping`);
          results.skipped++;
          continue;
        }
      }

      // AI normalize (with fallback)
      let normalized;
      try {
        log('  AI normalizing...');
        normalized = await aiNormalize(scraped, categories);
        log(`  AI ✓ — ${normalized.name} | price: ₹${normalized.pricing?.regularPrice}`);
      } catch (aiErr) {
        warn(`  AI failed (${aiErr.message}) — using basic normalize`);
        normalized = basicNormalize(scraped, categories);
        log(`  Basic ✓ — ${normalized.name} | price: ₹${normalized.pricing?.regularPrice}`);
      }

      // Upload images
      const images = scraped.imageUrls.length
        ? await uploadImages(scraped.imageUrls.slice(0, 5)) // max 5 images
        : [];

      // Build final payload
      const payload = {
        ...normalized,
        images,
        // Store source URL for reference (in seo keywords or meta)
        seo: {
          ...normalized.seo,
          keywords: [...(normalized.seo?.keywords || []), `varmora`, `vendor-import`],
        },
      };

      if (DRY_RUN) {
        log('  [DRY RUN] Would create product:');
        console.log(JSON.stringify(payload, null, 2));
        results.created++;
      } else {
        log('  Creating product...');
        const created = await createProduct(payload);
        log(`  ✓ Created: ${created.productId || created._id} — ${created.name}`);
        results.created++;
      }

    } catch (e) {
      fail(`product[${i + 1}]`, e);
      results.failed++;
    }

    // Polite delay between products
    if (i < productUrls.length - 1) await sleep(CRAWL_DELAY_MS);
  }

  // ── Summary ──
  log('\n' + '='.repeat(60));
  log(`Done! Results:`);
  log(`  ✓ Created : ${results.created}`);
  log(`  ⊘ Skipped : ${results.skipped}  (already existed)`);
  log(`  ✗ Failed  : ${results.failed}`);
  log('='.repeat(60));
}

main().catch(e => {
  console.error('Fatal error:', e.message || e);
  process.exit(1);
});
