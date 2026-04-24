/**
 * Restore Deleted Product
 *
 * Product: Mee Mee Premium Steel Feeding Bottle Silver
 * Product ID: 693babf155ab8ac6ec1cb7fb
 */

const https = require('https');

const BASE_URL = 'api.epielio.com';
const ADMIN_EMAIL = 'admin@epi.com';
const ADMIN_PASSWORD = '@Saoirse123';
const PRODUCT_ID = '693babf155ab8ac6ec1cb7fb'; // Mee Mee Premium Steel Feeding Bottle

let adminToken = null;

function makeRequest(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      port: 443,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      rejectUnauthorized: false
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = https.request(options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({
            statusCode: res.statusCode,
            data: parsed
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            data: body
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function main() {
  try {
    console.log('🔄 Restoring Deleted Product');
    console.log(`Base URL: https://${BASE_URL}`);
    console.log(`Product ID: ${PRODUCT_ID}`);
    console.log('='.repeat(70) + '\n');

    // Step 1: Admin Login
    console.log('🔐 Step 1: Admin Login...');
    const loginResult = await makeRequest('POST', '/api/admin-auth/login', {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });

    if (loginResult.statusCode !== 200) {
      console.log('❌ Admin login failed');
      console.log('Response:', JSON.stringify(loginResult.data, null, 2));
      return;
    }

    adminToken = loginResult.data.data.accessToken;
    console.log('✅ Admin logged in successfully\n');

    // Step 2: Check product current status
    console.log('🔍 Step 2: Checking product status...');
    const productResult = await makeRequest(
      'GET',
      `/api/products/${PRODUCT_ID}`,
      null,
      adminToken
    );

    if (productResult.statusCode === 200) {
      const product = productResult.data.data || productResult.data;
      console.log('✅ Product found:');
      console.log(`   Name: ${product.name}`);
      console.log(`   Price: ₹${product.pricing?.finalPrice || 0}`);
      console.log(`   Status: ${product.status}`);
      console.log(`   Is Deleted: ${product.isDeleted}`);
      console.log(`   Deleted At: ${product.deletedAt || 'N/A'}`);
      console.log(`   Deleted By: ${product.deletedByEmail || 'N/A'}`);

      if (!product.isDeleted) {
        console.log('\n⚠️  Product is already active (not deleted)');
        console.log('No action needed!');
        return;
      }
    } else {
      console.log('⚠️  Could not fetch product details');
      console.log('Response:', JSON.stringify(productResult.data, null, 2));
    }

    // Step 3: Restore the product
    console.log('\n🔄 Step 3: Restoring product...');
    const restoreResult = await makeRequest(
      'PUT',
      `/api/products/${PRODUCT_ID}/restore`,
      {},
      adminToken
    );

    console.log(`Response Status: ${restoreResult.statusCode}`);
    console.log('Response:', JSON.stringify(restoreResult.data, null, 2));

    if (restoreResult.statusCode === 200) {
      console.log('\n✅ SUCCESS! Product restored successfully!');

      const restoredProduct = restoreResult.data.data;
      console.log('\n📋 Restored Product Details:');
      console.log(`   Product ID: ${restoredProduct._id}`);
      console.log(`   Name: ${restoredProduct.name}`);
      console.log(`   Price: ₹${restoredProduct.pricing?.finalPrice || 0}`);
      console.log(`   Status: ${restoredProduct.status}`);
      console.log(`   Is Deleted: ${restoredProduct.isDeleted}`);
      console.log(`   Restored At: ${restoredProduct.restoredAt}`);
      console.log(`   Restored By: ${restoredProduct.restoredByEmail}`);

      console.log('\n✅ The product is now visible to users again!');
      console.log('   - Users can see it in category listings');
      console.log('   - Users can search for it');
      console.log('   - Users can place orders with it');

    } else {
      console.log('\n❌ Failed to restore product');
      console.log('Error:', restoreResult.data.message || 'Unknown error');
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ Script Complete!');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  }
}

main();
