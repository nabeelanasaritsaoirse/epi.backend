const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://api.epielio.com';
const ADMIN_EMAIL = 'admin@epi.com';
const ADMIN_PASSWORD = 'Admin@123456';

let adminToken = '';

// Step 1: Admin Login
async function loginAsAdmin() {
  console.log('\n🔐 Step 1: Logging in as admin...');
  try {
    const response = await axios.post(`${BASE_URL}/api/auth/admin-login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });

    if (response.data.success && response.data.data?.accessToken) {
      adminToken = response.data.data.accessToken;
      console.log('✅ Admin login successful!');
      console.log('Admin Name:', response.data.data.name);
      console.log('Admin Email:', response.data.data.email);
      console.log('Admin Role:', response.data.data.role);
      console.log('Token:', adminToken.substring(0, 50) + '...');
      return true;
    } else {
      console.log('❌ Login failed:', response.data);
      return false;
    }
  } catch (error) {
    console.log('❌ Login error:', error.response?.data || error.message);
    return false;
  }
}

// Step 2: Upload Image to S3
async function uploadImageToS3(imagePath) {
  console.log('\n📤 Step 2: Uploading image to S3...');
  try {
    const formData = new FormData();
    const imageStream = fs.createReadStream(imagePath);
    formData.append('image', imageStream, {
      filename: path.basename(imagePath),
      contentType: 'image/jpeg'
    });

    const response = await axios.post(`${BASE_URL}/api/images/upload`, formData, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        ...formData.getHeaders()
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    if (response.data.success && response.data.imageUrl) {
      console.log('✅ Image uploaded successfully!');
      console.log('Image URL:', response.data.imageUrl);
      return response.data.imageUrl;
    } else {
      console.log('❌ Upload failed:', response.data);
      return null;
    }
  } catch (error) {
    console.log('❌ Upload error:', error.response?.data || error.message);
    return null;
  }
}

// Step 3: Get Categories
async function getCategories() {
  console.log('\n📋 Step 3: Fetching categories...');
  try {
    const response = await axios.get(`${BASE_URL}/api/categories`);

    if (response.data.success && response.data.categories?.length > 0) {
      const category = response.data.categories[0];
      console.log('✅ Found category:', category.name);
      return category._id;
    } else {
      console.log('⚠️ No categories found, will use default');
      return null;
    }
  } catch (error) {
    console.log('⚠️ Category fetch error:', error.response?.data || error.message);
    return null;
  }
}

// Step 4: Create Product
async function createProduct(imageUrl, categoryId) {
  console.log('\n🆕 Step 4: Creating new product...');

  const productData = {
    name: 'Premium Product',
    description: {
      short: 'High-quality premium product',
      long: 'This is a premium quality product with excellent features and great value for money.',
      features: ['Premium Quality', 'Durable', 'Stylish Design']
    },
    brand: 'Premium Brand',
    sku: 'PROD-' + Date.now(),
    category: {
      mainCategoryId: categoryId || '691dc9626143f328eba3160d',
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
      altText: 'Premium Product Image'
    }] : [],
    status: 'published',
    isPopular: true,
    isBestSeller: true,
    isTrending: true,
    plans: [
      {
        name: 'Quick Plan',
        days: 10,
        perDayAmount: 400,
        totalAmount: 4000,
        isRecommended: true,
        description: 'Pay in 10 days'
      },
      {
        name: 'Standard Plan',
        days: 20,
        perDayAmount: 200,
        totalAmount: 4000,
        isRecommended: false,
        description: 'Pay in 20 days'
      },
      {
        name: 'Flexible Plan',
        days: 40,
        perDayAmount: 100,
        totalAmount: 4000,
        isRecommended: false,
        description: 'Pay in 40 days'
      }
    ]
  };

  try {
    const response = await axios.post(`${BASE_URL}/api/products`, productData, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.data.success || response.data.product || response.data.data) {
      const product = response.data.product || response.data.data || response.data;
      console.log('✅ Product created successfully!');
      console.log('\n' + '='.repeat(70));
      console.log('📦 PRODUCT DETAILS');
      console.log('='.repeat(70));
      console.log('Product ID:', product._id);
      console.log('Product Name:', product.name);
      console.log('Price: ₹' + product.pricing.finalPrice);
      console.log('Status:', product.status);
      console.log('Stock:', product.availability.stockQuantity);
      console.log('Images:', product.images?.length || 0);
      if (product.images?.length > 0) {
        console.log('Image URL:', product.images[0].url);
      }
      console.log('Plans:', product.plans?.length || 0);
      console.log('='.repeat(70));
      return product;
    } else {
      console.log('❌ Product creation failed:', response.data);
      return null;
    }
  } catch (error) {
    console.log('❌ Product creation error:', error.response?.data || error.message);
    return null;
  }
}

// Main function
async function main() {
  console.log('\n🚀 Starting Product Creation with Image Upload...\n');

  // Step 1: Login
  const loginSuccess = await loginAsAdmin();
  if (!loginSuccess) {
    console.log('\n❌ Failed to login. Exiting...');
    process.exit(1);
  }

  // Step 2: Upload Image
  // Try different possible image filenames
  const possibleImages = ['downloadimg3.jfif', 'image.png', 'downloadimg3.jpg', 'downloadimg3.jpeg'];
  let imagePath = null;

  for (const imgName of possibleImages) {
    const testPath = path.join(__dirname, imgName);
    if (fs.existsSync(testPath)) {
      imagePath = testPath;
      console.log('✅ Found image:', imgName);
      break;
    }
  }

  if (!imagePath) {
    console.log('⚠️ No image file found. Tried:', possibleImages.join(', '));
    console.log('Creating product without image...');
  }

  let imageUrl = null;
  if (imagePath && fs.existsSync(imagePath)) {
    imageUrl = await uploadImageToS3(imagePath);
  }

  // Step 3: Get Category
  const categoryId = await getCategories();

  // Step 4: Create Product
  const product = await createProduct(imageUrl, categoryId);

  if (product) {
    console.log('\n✅ SUCCESS! Product created with image uploaded to S3!');
    console.log('\n📋 Summary:');
    console.log('  - Admin Login: ✅');
    console.log('  - Image Upload: ' + (imageUrl ? '✅' : '⚠️'));
    console.log('  - Product Created: ✅');
    console.log('  - Product Status: Published');
    console.log('  - Product Available: Yes');
    console.log('\n🎉 Product is now live and ready for purchase!');
  } else {
    console.log('\n❌ Failed to create product');
  }
}

// Run
main().then(() => {
  console.log('\n✅ Script completed!\n');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Script failed:', error);
  process.exit(1);
});
