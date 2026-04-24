/**
 * updateMangoVariantsFull.js
 * ───────────────────────────────────────────────────────────────────────────
 * Replaces every mango product's variants with a comprehensive set that
 * demonstrates ALL major e-commerce variant attribute dimensions:
 *
 *  Dimension   Ecomm equivalent      Mango values
 *  ─────────   ──────────────────    ──────────────────────────────────────
 *  Grade       Quality / Tier        Standard | Premium A | Organic | Export A+
 *  Ripeness    Color / State         Raw (Green) | Semi-Ripe | Fully Ripe
 *  Packaging   Material / Type       Regular Box | Gift Box | Eco Jute Bag |
 *                                    Wooden Crate | Zip Pouch | Tetra Pack
 *  Form        Style / Cut           Whole Fruit | Ready-to-Eat Slices | Pulp Pack
 *  Storage     Condition / Delivery  Fresh Delivery | Cold Storage
 *
 * 8 variants × 100 products = 800 variants total
 *
 * Run: node scripts/updateMangoVariantsFull.js
 */

const axios = require('axios');

const BASE_URL = 'http://13.127.15.87:8080/api';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Mango images (rotated per variant) ───────────────────────────────────────
const MANGO_IMAGES = [
  'https://images.unsplash.com/photo-1601493700631-2b16ec4b4716?w=800&q=80',
  'https://images.unsplash.com/photo-1553279768-865429fa0078?w=800&q=80',
  'https://images.unsplash.com/photo-1519996529931-28324d5a630e?w=800&q=80',
  'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&q=80',
  'https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=800&q=80',
];

// ── 8 variant combinations — one for each ecomm variant dimension combination ─
// priceMultiplier: applied to the product's regularPrice
// stockMultiplier: applied to the product's stockQuantity
const VARIANT_COMBOS = [
  {
    label: 'Standard · Fully Ripe · Regular Box · Whole Fruit · Fresh Delivery',
    attributes: [
      { name: 'Grade',    value: 'Standard'       },
      { name: 'Ripeness', value: 'Fully Ripe'     },
      { name: 'Packaging',value: 'Regular Box'    },
      { name: 'Form',     value: 'Whole Fruit'    },
      { name: 'Storage',  value: 'Fresh Delivery' },
    ],
    priceMultiplier: 1.00,
    stockMultiplier: 1.00,
  },
  {
    label: 'Premium A · Fully Ripe · Gift Box · Whole Fruit · Fresh Delivery',
    attributes: [
      { name: 'Grade',    value: 'Premium A'      },
      { name: 'Ripeness', value: 'Fully Ripe'     },
      { name: 'Packaging',value: 'Gift Box'       },
      { name: 'Form',     value: 'Whole Fruit'    },
      { name: 'Storage',  value: 'Fresh Delivery' },
    ],
    priceMultiplier: 1.28,
    stockMultiplier: 0.60,
  },
  {
    label: 'Organic · Fully Ripe · Eco Jute Bag · Whole Fruit · Fresh Delivery',
    attributes: [
      { name: 'Grade',    value: 'Organic'        },
      { name: 'Ripeness', value: 'Fully Ripe'     },
      { name: 'Packaging',value: 'Eco Jute Bag'  },
      { name: 'Form',     value: 'Whole Fruit'    },
      { name: 'Storage',  value: 'Fresh Delivery' },
    ],
    priceMultiplier: 1.32,
    stockMultiplier: 0.50,
  },
  {
    label: 'Export A+ · Fully Ripe · Wooden Crate · Whole Fruit · Cold Storage',
    attributes: [
      { name: 'Grade',    value: 'Export A+'      },
      { name: 'Ripeness', value: 'Fully Ripe'     },
      { name: 'Packaging',value: 'Wooden Crate'  },
      { name: 'Form',     value: 'Whole Fruit'    },
      { name: 'Storage',  value: 'Cold Storage'   },
    ],
    priceMultiplier: 1.45,
    stockMultiplier: 0.30,
  },
  {
    label: 'Standard · Semi-Ripe · Regular Box · Whole Fruit · Fresh Delivery',
    attributes: [
      { name: 'Grade',    value: 'Standard'       },
      { name: 'Ripeness', value: 'Semi-Ripe'      },
      { name: 'Packaging',value: 'Regular Box'    },
      { name: 'Form',     value: 'Whole Fruit'    },
      { name: 'Storage',  value: 'Fresh Delivery' },
    ],
    priceMultiplier: 0.92,
    stockMultiplier: 0.80,
  },
  {
    label: 'Standard · Raw (Green) · Regular Box · Whole Fruit · Fresh Delivery',
    attributes: [
      { name: 'Grade',    value: 'Standard'       },
      { name: 'Ripeness', value: 'Raw (Green)'    },
      { name: 'Packaging',value: 'Regular Box'    },
      { name: 'Form',     value: 'Whole Fruit'    },
      { name: 'Storage',  value: 'Fresh Delivery' },
    ],
    priceMultiplier: 0.85,
    stockMultiplier: 0.70,
  },
  {
    label: 'Premium A · Fully Ripe · Zip Pouch · Ready-to-Eat Slices · Cold Storage',
    attributes: [
      { name: 'Grade',    value: 'Premium A'             },
      { name: 'Ripeness', value: 'Fully Ripe'            },
      { name: 'Packaging',value: 'Zip Pouch'             },
      { name: 'Form',     value: 'Ready-to-Eat Slices'   },
      { name: 'Storage',  value: 'Cold Storage'          },
    ],
    priceMultiplier: 1.38,
    stockMultiplier: 0.45,
  },
  {
    label: 'Premium A · Fully Ripe · Tetra Pack · Pulp Pack · Fresh Delivery',
    attributes: [
      { name: 'Grade',    value: 'Premium A'      },
      { name: 'Ripeness', value: 'Fully Ripe'     },
      { name: 'Packaging',value: 'Tetra Pack'     },
      { name: 'Form',     value: 'Pulp Pack'      },
      { name: 'Storage',  value: 'Fresh Delivery' },
    ],
    priceMultiplier: 1.18,
    stockMultiplier: 0.55,
  },
];

// ── Build variants array for a product ────────────────────────────────────────
function buildVariants(product) {
  const basePrice = product.pricing?.regularPrice || 200;
  const baseStock = product.availability?.stockQuantity || 50;
  const imgOffset = Math.floor(Math.random() * MANGO_IMAGES.length);

  return VARIANT_COMBOS.map((combo, idx) => {
    const price = Math.round(basePrice * combo.priceMultiplier);
    // salePrice must be strictly LESS than price (schema enforces this)
    const salePrice = Math.min(price - 1, Math.round(price * 0.88));
    const stock = Math.max(5, Math.round(baseStock * combo.stockMultiplier));
    const imgUrl = MANGO_IMAGES[(imgOffset + idx) % MANGO_IMAGES.length];

    return {
      attributes: combo.attributes,
      price,
      salePrice,
      stock,
      isActive: true,
      images: [
        {
          url:       imgUrl,
          isPrimary: true,
          altText:   `${product.name} — ${combo.label}`,
          order:     1,
        },
      ],
      description: {
        short: combo.label,
        long:  `${product.name} | ${combo.attributes.map((a) => `${a.name}: ${a.value}`).join(', ')}. Price: ₹${price} (sale ₹${salePrice}). Stock: ${stock} units.`,
      },
    };
  });
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log('  Update Mango Variants — Full E-Commerce Attribute Coverage');
  console.log('══════════════════════════════════════════════════════════════════\n');

  // Admin login
  const login = await axios.post(`${BASE_URL}/admin-auth/login`, {
    email: 'admin@epi.com',
    password: '@Saoirse123',
  });
  const token = login.data.data.accessToken;
  const api = axios.create({
    baseURL: BASE_URL,
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    timeout: 20000,
  });
  console.log('Admin login ✓\n');

  // Fetch all mango products (paginated, deduplicated)
  let mangoProducts = [];
  let page = 1;
  const seen = new Set();

  while (true) {
    const res   = await api.get('/products', { params: { limit: 100, page } });
    const items = res.data.data || res.data.products || [];

    const mango = items.filter((p) => {
      const id = p.productId || p._id;
      if (seen.has(id)) return false;
      if (
        p.category?.mainCategoryName === 'Mango' ||
        p.name?.toLowerCase().includes('mango')
      ) {
        seen.add(id);
        return true;
      }
      return false;
    });

    mangoProducts.push(...mango);
    if (items.length < 100) break;
    page++;
  }

  console.log(`Found ${mangoProducts.length} mango products`);
  console.log(`Applying ${VARIANT_COMBOS.length} variants per product\n`);

  console.log('Variant dimensions being added:');
  console.log('  Grade    : Standard | Premium A | Organic | Export A+');
  console.log('  Ripeness : Raw (Green) | Semi-Ripe | Fully Ripe');
  console.log('  Packaging: Regular Box | Gift Box | Eco Jute Bag | Wooden Crate | Zip Pouch | Tetra Pack');
  console.log('  Form     : Whole Fruit | Ready-to-Eat Slices | Pulp Pack');
  console.log('  Storage  : Fresh Delivery | Cold Storage\n');

  let updated = 0;
  let failed  = 0;

  for (const product of mangoProducts) {
    const pid      = product.productId || product._id;
    const variants = buildVariants(product);

    try {
      await api.put(`/products/${pid}`, {
        hasVariants: true,
        variants,
      });
      updated++;
      process.stdout.write(`\r  Progress: ${updated}/${mangoProducts.length} ✓`);
      await sleep(120);
    } catch (e) {
      failed++;
      const msg = e?.response?.data?.message || e.message;
      console.log(`\n  ✗ [${product.name}]: ${msg}`);
      if (failed === 1) {
        console.log('  Full error:', JSON.stringify(e?.response?.data, null, 2));
      }
    }
  }

  const totalVariants = VARIANT_COMBOS.length * updated;

  console.log(`\n\n══════════════════════════════════════════════════════════════════`);
  console.log(`  DONE`);
  console.log(`  Updated : ${updated} products`);
  console.log(`  Failed  : ${failed} products`);
  console.log(`  Variants: ${VARIANT_COMBOS.length} per product × ${updated} = ${totalVariants} total`);
  console.log(`\n  Every product now has variants covering:`);
  console.log(`  ✓ Grade     — Standard / Premium A / Organic / Export A+`);
  console.log(`  ✓ Ripeness  — Raw (Green) / Semi-Ripe / Fully Ripe`);
  console.log(`  ✓ Packaging — Regular Box / Gift Box / Eco Jute Bag / Wooden Crate / Zip Pouch / Tetra Pack`);
  console.log(`  ✓ Form      — Whole Fruit / Ready-to-Eat Slices / Pulp Pack`);
  console.log(`  ✓ Storage   — Fresh Delivery / Cold Storage`);
  console.log(`  ✓ Each variant has its own price, stock, image, and description`);
  console.log(`══════════════════════════════════════════════════════════════════\n`);
}

main().catch((e) => {
  console.error('\nFatal:', e?.response?.data || e.message);
  process.exit(1);
});
