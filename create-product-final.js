const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://api.epielio.com';
const ADMIN_EMAIL = 'admin@epi.com';
const ADMIN_PASSWORD = 'Admin@123456';

let adminToken = '';

async function main() {
  console.log('\n' + '🚀'.repeat(35));
  console.log('   ADMIN: CREATING NEW PRODUCT WITH IMAGE');
  console.log('🚀'.repeat(35) + '\n');

  // ===========================================
  // STEP 1: ADMIN LOGIN
  // ===========================================
  console.log('🔐 STEP 1: Admin Login...');
  try {
    const loginRes = await axios.post(`${BASE_URL}/api/auth/admin-login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });

    if (loginRes.data.success) {
      adminToken = loginRes.data.data.accessToken;
      console.log('✅ Admin logged in successfully!');
      console.log('   Name:', loginRes.data.data.name);
      console.log('   Email:', loginRes.data.data.email);
      console.log('   Role:', loginRes.data.data.role);
    } else {
      console.log('❌ Login failed');
      process.exit(1);
    }
  } catch (error) {
    console.log('❌ Login error:', error.response?.data || error.message);
    process.exit(1);
  }

  // ===========================================
  // STEP 2: CREATE PRODUCT (image bina)
  // ===========================================
  console.log('\n🆕 STEP 2: Creating new product...');
  let productId = null;

  try {
    const productData = {
      name: 'Premium Wireless Headphones',
      description: {
        short: 'Premium quality wireless headphones with noise cancellation',
        long: 'Experience superior sound quality with our premium wireless headphones. Features active noise cancellation, 40-hour battery life, premium comfort cushions, and Bluetooth 5.0 connectivity.',
        features: [
          'Active Noise Cancellation',
          '40-hour battery life',
          'Premium comfort cushions',
          'Bluetooth 5.0',
          'Hi-Fi stereo sound'
        ]
      },
      brand: 'AudioPro',
      sku: 'APH-' + Date.now(),
      category: {
        mainCategoryId: '691dc9626143f328eba3160d',
        mainCategoryName: 'Electronics'
      },
      pricing: {
        regularPrice: 5000,
        salePrice: 4000,
        currency: 'INR',
        finalPrice: 4000
      },
      availability: {
        isAvailable: true,
        stockQuantity: 100,
        lowStockLevel: 10,
        stockStatus: 'in_stock'
      },
      images: [], // Will add image later
      status: 'published',
      isPopular: true,
      isBestSeller: true,
      isTrending: true,
      plans: [
        {
          name: 'Quick Plan - 10 Days',
          days: 10,
          perDayAmount: 400,
          totalAmount: 4000,
          isRecommended: true,
          description: 'Pay ₹400 daily for 10 days'
        },
        {
          name: 'Standard Plan - 20 Days',
          days: 20,
          perDayAmount: 200,
          totalAmount: 4000,
          isRecommended: false,
          description: 'Pay ₹200 daily for 20 days'
        },
        {
          name: 'Flexible Plan - 40 Days',
          days: 40,
          perDayAmount: 100,
          totalAmount: 4000,
          isRecommended: false,
          description: 'Pay ₹100 daily for 40 days'
        },
        {
          name: 'Extended Plan - 80 Days',
          days: 80,
          perDayAmount: 50,
          totalAmount: 4000,
          isRecommended: false,
          description: 'Pay ₹50 daily for 80 days'
        }
      ]
    };

    const createRes = await axios.post(`${BASE_URL}/api/products`, productData, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (createRes.data.success) {
      productId = createRes.data.data.productId;
      console.log('✅ Product created successfully!');
      console.log('   Product ID:', productId);
      console.log('   Name:', createRes.data.data.name);
      console.log('   SKU:', createRes.data.data.sku);
    }
  } catch (error) {
    console.log('❌ Product creation error:', error.response?.data || error.message);
    process.exit(1);
  }

  // ===========================================
  // STEP 3: GET FULL PRODUCT DETAILS
  // ===========================================
  console.log('\n📋 STEP 3: Fetching full product details...');
  let fullProduct = null;

  try {
    const productRes = await axios.get(`${BASE_URL}/api/products/${productId}`);
    fullProduct = productRes.data.data || productRes.data.product || productRes.data;

    console.log('✅ Product details fetched!');
    console.log('\n' + '='.repeat(70));
    console.log('📦 PRODUCT CREATED SUCCESSFULLY');
    console.log('='.repeat(70));
    console.log('Product ID:', fullProduct._id || fullProduct.productId);
    console.log('Name:', fullProduct.name);
    console.log('Brand:', fullProduct.brand || 'N/A');
    console.log('SKU:', fullProduct.sku);
    console.log('Price: ₹' + fullProduct.pricing?.finalPrice);
    console.log('Regular Price: ₹' + fullProduct.pricing?.regularPrice);
    console.log('Sale Price: ₹' + fullProduct.pricing?.salePrice);
    console.log('Status:', fullProduct.status);
    console.log('Stock:', fullProduct.availability?.stockQuantity);
    console.log('Popular:', fullProduct.isPopular ? '✅' : '❌');
    console.log('Best Seller:', fullProduct.isBestSeller ? '✅' : '❌');
    console.log('Trending:', fullProduct.isTrending ? '✅' : '❌');
    console.log('Images:', fullProduct.images?.length || 0);
    console.log('Payment Plans:', fullProduct.plans?.length || 0);
    console.log('='.repeat(70));
  } catch (error) {
    console.log('⚠️ Could not fetch full details:', error.response?.data?.message || error.message);
  }

  // ===========================================
  // STEP 4: UPLOAD IMAGE TO S3 (if available)
  // ===========================================
  console.log('\n📤 STEP 4: Uploading image to S3...');
  const imagePath = path.join(__dirname, 'image.png');
  let imageUrl = null;

  if (fs.existsSync(imagePath)) {
    try {
      const formData = new FormData();
      formData.append('image', fs.createReadStream(imagePath));
      formData.append('type', 'product');
      formData.append('title', 'Premium Wireless Headphones');
      formData.append('altText', 'Premium Headphones');

      const uploadRes = await axios.post(`${BASE_URL}/api/images`, formData, {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          ...formData.getHeaders()
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });

      if (uploadRes.data.success && uploadRes.data.image) {
        imageUrl = uploadRes.data.image.url;
        console.log('✅ Image uploaded to S3!');
        console.log('   Image ID:', uploadRes.data.image._id);
        console.log('   Image URL:', imageUrl);

        // Update product with image
        console.log('\n🔄 Updating product with image...');
        try {
          await axios.put(`${BASE_URL}/api/products/${productId}`, {
            images: [{
              url: imageUrl,
              isPrimary: true,
              altText: 'Premium Wireless Headphones'
            }]
          }, {
            headers: {
              'Authorization': `Bearer ${adminToken}`,
              'Content-Type': 'application/json'
            }
          });
          console.log('✅ Product updated with image!');
        } catch (updateError) {
          console.log('⚠️ Could not update product:', updateError.response?.data?.message || updateError.message);
        }
      }
    } catch (error) {
      console.log('⚠️ Image upload failed:', error.response?.data?.message || error.message);
    }
  } else {
    console.log('⚠️ Image file not found at:', imagePath);
  }

  // ===========================================
  // FINAL SUMMARY
  // ===========================================
  console.log('\n' + '='.repeat(70));
  console.log('🎉 SUCCESS! PRODUCT IS NOW LIVE!');
  console.log('='.repeat(70));
  console.log('\n✅ Product Features:');
  console.log('   📦 Product Name: Premium Wireless Headphones');
  console.log('   💰 Price: ₹4,000 (Sale) / ₹5,000 (Regular)');
  console.log('   📊 Status: Published & Live');
  console.log('   🔥 Tagged as: Popular, Best Seller, Trending');
  console.log('   📦 Stock: 100 units available');
  console.log('   💳 Payment Plans: 4 flexible plans (₹50-₹400/day)');
  if (imageUrl) {
    console.log('   🖼️  Image: Uploaded to S3');
  }

  console.log('\n✅ Users can now:');
  console.log('   • View this product in catalog');
  console.log('   • Add to cart');
  console.log('   • Add to wishlist');
  console.log('   • Create orders with EMI plans');
  console.log('   • Make daily payments');
  console.log('   • Earn referral commissions (20%)');

  console.log('\n' + '='.repeat(70));
  console.log('✨ Product creation completed successfully!');
  console.log('='.repeat(70) + '\n');
}

main().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
