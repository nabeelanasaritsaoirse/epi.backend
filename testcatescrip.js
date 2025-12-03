const axios = require('axios');
const fs = require('fs');

const API_BASE = 'https://api.epielio.com/api';

async function fetchAllCategories() {
  const res = await axios.get(`${API_BASE}/categories`);
  return res.data.data || [];
}

async function fetchProductsByCategoryId(categoryId, options = {}) {
  const { page = 1, limit = 50 } = options;  // ✅ REMOVED region
  
  const res = await axios.get(`${API_BASE}/products/category/${categoryId}`, {
    params: { page, limit },  // ✅ NO region param
  });
  return res.data;
}

async function main() {
  console.log(`🚀 FULL SCRIPT STARTED - ${API_BASE}\n`);

  const categories = await fetchAllCategories();
  console.log(`✅ Found ${categories.length} categories\n`);

  const results = [];

  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i];
    const categoryId = cat._id;

    console.log(`[${i + 1}/${categories.length}] ${cat.name} (${categoryId.slice(-4)})`);

    try {
      const productsResponse = await fetchProductsByCategoryId(categoryId, {
        page: 1,
        limit: 50,
        // ✅ NO region: 'global' - removed completely
      });

      results.push({
        categoryId,
        categoryName: cat.name,
        categorySlug: cat.slug,
        products: productsResponse.data,
        pagination: productsResponse.pagination,
      });

      console.log(`   ✅ ${productsResponse.data.length} products (total: ${productsResponse.pagination?.total || 0})\n`);
    } catch (err) {
      console.log(`   ❌ Error: ${err.response?.data?.message || err.message}\n`);
      results.push({
        categoryId,
        categoryName: cat.name,
        error: err.response?.data?.message || err.message,
        products: [],
      });
    }
  }

  // Summary
  console.log('📊 FINAL SUMMARY:');
  let totalProducts = 0;
  results.forEach((r) => {
    const count = r.products?.length || 0;
    totalProducts += count;
    console.log(`  ${r.categoryName.padEnd(25)} → ${count} (total: ${r.pagination?.total || 0})`);
  });
  console.log(`\n🎉 TOTAL: ${totalProducts} products across ${categories.length} categories`);

  // Save JSON file
  fs.writeFileSync('all-category-products.json', JSON.stringify(results, null, 2));
  console.log('\n💾 SAVED: all-category-products.json');
}

main().catch(console.error);
