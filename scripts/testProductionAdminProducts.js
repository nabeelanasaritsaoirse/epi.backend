require('dotenv').config();
const axios = require('axios');

const BASE_URL = 'https://api.epielio.com/api';

// Sub-admin credentials
const ADMIN_EMAIL = 'somu123@gmail.com';
const ADMIN_PASSWORD = 'Somu@123';

async function testProductionAdminProducts() {
  console.log('🔍 Testing Production Admin Products API...\n');
  console.log('Base URL:', BASE_URL);
  console.log('Admin Email:', ADMIN_EMAIL);
  console.log('─'.repeat(60));

  try {
    // Step 1: Login
    console.log('\n📝 Step 1: Logging in as sub-admin...');
    const loginResponse = await axios.post(`${BASE_URL}/admin-auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });

    if (!loginResponse.data.success) {
      console.error('❌ Login failed:', loginResponse.data.message);
      return;
    }

    console.log('✅ Login successful!');
    console.log('User ID:', loginResponse.data.data.userId);
    console.log('Role:', loginResponse.data.data.role);
    console.log('Is Super Admin:', loginResponse.data.data.isSuperAdmin);
    console.log('Modules:', loginResponse.data.data.modules);

    const accessToken = loginResponse.data.data.accessToken;
    console.log('Access Token:', accessToken.substring(0, 50) + '...');

    // Step 2: Fetch products using admin endpoint
    console.log('\n📦 Step 2: Fetching products from /api/products/admin/all...');
    try {
      const productsResponse = await axios.get(`${BASE_URL}/products/admin/all`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        params: {
          page: 1,
          limit: 10
        }
      });

      if (productsResponse.data.success) {
        console.log('✅ Products fetched successfully!');
        console.log('\n📊 Response:');
        console.log('Total Products:', productsResponse.data.pagination.total);
        console.log('Current Page:', productsResponse.data.pagination.current);
        console.log('Total Pages:', productsResponse.data.pagination.pages);
        console.log('Products in this page:', productsResponse.data.data.length);

        if (productsResponse.data.data.length > 0) {
          console.log('\n📝 First Product Sample:');
          const firstProduct = productsResponse.data.data[0];
          console.log('  - ID:', firstProduct._id);
          console.log('  - Product ID:', firstProduct.productId);
          console.log('  - Name:', firstProduct.name);
          console.log('  - Status:', firstProduct.status);
          console.log('  - Price:', firstProduct.pricing?.finalPrice, firstProduct.pricing?.currency);
          console.log('  - Has Variants:', firstProduct.hasVariants);
          console.log('  - Region:', firstProduct.regionalAvailability?.[0]?.region);
        } else {
          console.log('⚠️  No products found in database');
        }
      } else {
        console.error('❌ Products fetch failed:', productsResponse.data.message);
      }
    } catch (productError) {
      console.error('❌ Error fetching products:');
      if (productError.response) {
        console.error('Status:', productError.response.status);
        console.error('Message:', productError.response.data.message || productError.response.data);
        console.error('Code:', productError.response.data.code);
      } else {
        console.error('Error:', productError.message);
      }
    }

    // Step 3: Try regular products endpoint (public)
    console.log('\n🌍 Step 3: Testing public products endpoint /api/products...');
    try {
      const publicProductsResponse = await axios.get(`${BASE_URL}/products`, {
        params: {
          page: 1,
          limit: 5
        }
      });

      if (publicProductsResponse.data.success) {
        console.log('✅ Public products endpoint working!');
        console.log('Total Products:', publicProductsResponse.data.pagination?.total || 'N/A');
        console.log('Products Count:', publicProductsResponse.data.data?.length || 0);
      }
    } catch (publicError) {
      console.error('❌ Public endpoint error:', publicError.message);
    }

    // Step 4: Fetch categories using admin endpoint
    console.log('\n📂 Step 4: Fetching categories from /api/categories/admin/all...');
    try {
      const categoriesResponse = await axios.get(`${BASE_URL}/categories/admin/all`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (categoriesResponse.data.success) {
        console.log('✅ Categories fetched successfully!');
        console.log('\n📊 Response:');
        console.log('Total Categories:', categoriesResponse.data.count);
        console.log('Categories in response:', categoriesResponse.data.data.length);
        console.log('Applied Filters:', JSON.stringify(categoriesResponse.data.appliedFilters));

        if (categoriesResponse.data.data.length > 0) {
          console.log('\n📝 First Category Sample:');
          const firstCategory = categoriesResponse.data.data[0];
          console.log('  - ID:', firstCategory._id);
          console.log('  - Category ID:', firstCategory.categoryId);
          console.log('  - Name:', firstCategory.name);
          console.log('  - Is Active:', firstCategory.isActive);
          console.log('  - Available In Regions:', firstCategory.availableInRegions?.length > 0 ? firstCategory.availableInRegions : 'All (Global)');
          console.log('  - Subcategories:', firstCategory.subCategories?.length || 0);
        } else {
          console.log('⚠️  No categories found in database');
        }
      } else {
        console.error('❌ Categories fetch failed:', categoriesResponse.data.message);
      }
    } catch (categoryError) {
      console.error('❌ Error fetching categories:');
      if (categoryError.response) {
        console.error('Status:', categoryError.response.status);
        console.error('Message:', categoryError.response.data.message || categoryError.response.data);
        console.error('Code:', categoryError.response.data.code);
      } else {
        console.error('Error:', categoryError.message);
      }
    }

    console.log('\n' + '─'.repeat(60));
    console.log('✅ Test completed!');

  } catch (error) {
    console.error('\n❌ Test failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Message:', error.response.data.message || error.response.data);
      console.error('Full Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
  }
}

testProductionAdminProducts();
