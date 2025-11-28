const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://api.epielio.com';
const ADMIN_EMAIL = 'admin@epi.com';
const ADMIN_PASSWORD = 'Admin@123456';

let adminToken = '';

async function main() {
  console.log('\n🚀 Creating Product with Image Upload...\n');

  // Step 1: Admin Login
  console.log('🔐 Step 1: Admin Login...');
  try {
    const loginRes = await axios.post(`${BASE_URL}/api/auth/admin-login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });

    if (loginRes.data.success) {
      adminToken = loginRes.data.data.accessToken;
      console.log('✅ Admin logged in successfully!');
      console.log('   Admin:', loginRes.data.data.name, '(' + loginRes.data.data.role + ')');
    } else {
      console.log('❌ Login failed');
      process.exit(1);
    }
  } catch (error) {
    console.log('❌ Login error:', error.response?.data || error.message);
    process.exit(1);
  }

  // Step 2: Upload Image to S3
  console.log('\n📤 Step 2: Uploading image to S3...');
  let imageUrl = null;

  const imagePath = path.join(__dirname, 'image.png');
  if (fs.existsSync(imagePath)) {
    try {
      const formData = new FormData();
      formData.append('image', fs.createReadStream(imagePath));
      formData.append('type', 'product');
      formData.append('title', 'Premium Product Image');
      formData.append('altText', 'Premium Product');

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
        console.log('   URL:', imageUrl);
      }
    } catch (error) {
      console.log('⚠️ Image upload failed:', error.response?.data?.message || error.message);
      console.log('   Continuing without image...');
    }
  } else {
    console.log('⚠️ Image file not found, creating product without image');
  }

  // Step 3: Create Product
  console.log('\n🆕 Step 3: Creating product...');
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
      images: imageUrl ? [{
        url: imageUrl,
        isPrimary: true,
        altText: 'Premium Wireless Headphones'
      }] : [],
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

    console.log('✅ Product created successfully!');
    console.log('\n' + '='.repeat(70));
    console.log('📦 PRODUCT CREATED SUCCESSFULLY');
    console.log('='.repeat(70));

    const product = createRes.data.product || createRes.data.data || createRes.data;
    console.log('Product ID:', product._id || product.productId || 'N/A');
    console.log('Name:', product.name);
    console.log('Brand:', product.brand);
    console.log('SKU:', product.sku);
    console.log('Price: ₹' + product.pricing.finalPrice);
    console.log('Status:', product.status);
    console.log('Stock:', product.availability.stockQuantity);
    console.log('Popular:', product.isPopular ? 'Yes' : 'No');
    console.log('Best Seller:', product.isBestSeller ? 'Yes' : 'No');
    console.log('Trending:', product.isTrending ? 'Yes' : 'No');
    console.log('Images:', product.images?.length || 0);
    if (product.images?.length > 0) {
      console.log('Image URL:', product.images[0].url);
    }
    console.log('Payment Plans:', product.plans?.length || 0);
    console.log('='.repeat(70));

    console.log('\n🎉 SUCCESS! Product is now live and available for purchase!');
    console.log('✅ Users can now:');
    console.log('   - View this product in the catalog');
    console.log('   - Add it to cart');
    console.log('   - Add it to wishlist');
    console.log('   - Create orders with EMI plans');

  } catch (error) {
    console.log('❌ Product creation error:', error.response?.data || error.message);
    process.exit(1);
  }
}

main().then(() => {
  console.log('\n✅ Script completed!\n');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
