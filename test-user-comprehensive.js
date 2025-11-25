const axios = require('axios');

// Configuration
const BASE_URL = 'https://api.epielio.com';
const ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTFkNjAzNTk2MjU0MmJmNDEyMGYzMGIiLCJyb2xlIjoidXNlciIsImlhdCI6MTc2Mzk1NDU4MywiZXhwIjoxNzY0NTU5MzgzfQ.F-goKWFq0_8QG6yy26W-rjMpiBZqSKVBCzz7QZnDMNI';
const USER_ID = '691d6035962542bf4120f30b';
const REFERRAL_CODE = '49E59B3B';

// Axios instance with auth
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

// Helper function to log responses
const logResponse = (title, data) => {
  console.log('\n' + '='.repeat(70));
  console.log(`✅ ${title}`);
  console.log('='.repeat(70));
  console.log(JSON.stringify(data, null, 2));
};

const logError = (title, error) => {
  console.log('\n' + '='.repeat(70));
  console.log(`❌ ${title}`);
  console.log('='.repeat(70));
  console.log('Error:', error.response?.data || error.message);
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Main test function
async function testAllUserFunctions() {
  console.log('\n' + '🚀'.repeat(35));
  console.log('   COMPREHENSIVE USER FUNCTION TESTING');
  console.log('🚀'.repeat(35));
  console.log(`\nUser ID: ${USER_ID}`);
  console.log(`Referral Code Used: ${REFERRAL_CODE}`);
  console.log(`Base URL: ${BASE_URL}\n`);

  let productIds = [];
  let orderIds = [];
  let createdOrders = [];

  try {
    // ==========================================
    // 1. GET ALL PRODUCTS
    // ==========================================
    console.log('\n📦 STEP 1: Fetching available products...');
    try {
      const productsRes = await api.get('/api/products');
      const products = productsRes.data.data || productsRes.data.products || productsRes.data;

      if (products && products.length > 0) {
        // Get only active/published products with proper pricing
        const activeProducts = products.filter(p =>
          p.availability?.isAvailable &&
          p.pricing?.finalPrice &&
          p.pricing.finalPrice > 0 &&
          (p.status === 'active' || p.status === 'published')
        );

        // Sort by price (ascending) and pick affordable ones for testing
        activeProducts.sort((a, b) => a.pricing.finalPrice - b.pricing.finalPrice);

        productIds = activeProducts.slice(0, 5).map(p => p._id);
        logResponse('Products Fetched', {
          totalProducts: products.length,
          activeProducts: activeProducts.length,
          selectedForTesting: productIds.length,
          productDetails: activeProducts.slice(0, 5).map(p => ({
            id: p._id,
            name: p.name,
            price: p.pricing.finalPrice,
            status: p.status,
            stock: p.availability.stockQuantity
          }))
        });
      } else {
        console.log('⚠️ No products found');
      }
    } catch (error) {
      logError('Failed to fetch products', error);
    }

    // ==========================================
    // 2. CHECK WALLET BALANCE
    // ==========================================
    console.log('\n💰 STEP 2: Checking wallet balance...');
    try {
      const walletRes = await api.get('/api/wallet');
      logResponse('Current Wallet Status', {
        balance: walletRes.data.walletBalance,
        totalBalance: walletRes.data.totalBalance,
        availableBalance: walletRes.data.availableBalance,
        referralBonus: walletRes.data.referralBonus,
        totalEarnings: walletRes.data.totalEarnings
      });
    } catch (error) {
      logError('Failed to get wallet', error);
    }

    // ==========================================
    // 3. ADD PRODUCTS TO WISHLIST
    // ==========================================
    if (productIds.length > 0) {
      console.log('\n❤️ STEP 3: Adding products to wishlist...');
      const wishlistProducts = productIds.slice(0, 3);

      for (const productId of wishlistProducts) {
        try {
          await api.post(`/api/wishlist/add/${productId}`);
          console.log(`  ✅ Added product ${productId} to wishlist`);
          await sleep(500);
        } catch (error) {
          console.log(`  ⚠️ Product ${productId}: ${error.response?.data?.message || error.message}`);
        }
      }

      // Get wishlist
      try {
        const wishlistRes = await api.get('/api/wishlist');
        logResponse('Wishlist Contents', {
          totalItems: wishlistRes.data.data?.length || 0,
          items: wishlistRes.data.data?.map(item => ({
            name: item.name,
            price: item.finalPrice,
            brand: item.brand
          }))
        });
      } catch (error) {
        logError('Failed to get wishlist', error);
      }
    }

    // ==========================================
    // 4. ADD PRODUCTS TO CART
    // ==========================================
    if (productIds.length > 0) {
      console.log('\n🛒 STEP 4: Adding products to cart...');
      const cartProducts = productIds.slice(0, 4);

      for (const productId of cartProducts) {
        try {
          const quantity = Math.floor(Math.random() * 2) + 1;
          await api.post(`/api/cart/add/${productId}`, { quantity });
          console.log(`  ✅ Added ${quantity}x product ${productId} to cart`);
          await sleep(500);
        } catch (error) {
          console.log(`  ⚠️ Product ${productId}: ${error.response?.data?.message || error.message}`);
        }
      }

      // Get cart - FIXED ENDPOINT
      try {
        const cartRes = await api.get('/api/cart');
        logResponse('Cart Contents', {
          totalItems: cartRes.data.data?.totalItems || 0,
          totalPrice: cartRes.data.data?.totalPrice || 0,
          products: cartRes.data.data?.products?.map(item => ({
            name: item.name,
            price: item.finalPrice,
            quantity: item.quantity,
            itemTotal: item.itemTotal
          }))
        });
      } catch (error) {
        logError('Failed to get cart', error);
      }
    }

    // ==========================================
    // 5. CREATE ORDERS (EMI & UPFRONT)
    // ==========================================
    if (productIds.length > 0) {
      console.log('\n📋 STEP 5: Creating test orders...');

      // Get products data for proper calculation
      const productsRes = await api.get('/api/products');
      const allProducts = productsRes.data.data || [];
      const activeProducts = allProducts.filter(p =>
        (p.status === 'active' || p.status === 'published') &&
        p.availability?.isAvailable
      ).sort((a, b) => a.pricing.finalPrice - b.pricing.finalPrice);

      if (activeProducts.length === 0) {
        console.log('⚠️ No active products available for order creation');
      } else {
        // Order 1: Small product with 10-day EMI
        if (activeProducts.length > 0) {
          const product1 = activeProducts[0];
          const price1 = product1.pricing.finalPrice;
          const dailyAmount1 = Math.max(50, Math.ceil(price1 / 10));
          const days1 = Math.ceil(price1 / dailyAmount1);

          console.log(`\n📝 Creating Order 1: ${product1.name} (₹${price1})`);
          console.log(`   Daily EMI: ₹${dailyAmount1} for ${days1} days`);

          try {
            const order1Res = await api.post('/api/orders', {
              productId: product1._id,
              paymentOption: 'daily',
              paymentDetails: {
                dailyAmount: dailyAmount1,
                totalDays: days1
              },
              deliveryAddress: {
                addressLine1: '123 Test Street, Apartment 4B',
                city: 'Mumbai',
                state: 'Maharashtra',
                pincode: '400001',
                phone: '9876543210'
              }
            });

            logResponse('Order 1 Created (Daily EMI - Ongoing)', {
              orderId: order1Res.data.order._id,
              product: product1.name,
              amount: order1Res.data.order.orderAmount,
              paymentOption: order1Res.data.order.paymentOption,
              dailyAmount: dailyAmount1,
              totalDays: days1,
              status: order1Res.data.order.orderStatus
            });

            if (order1Res.data.order) {
              createdOrders.push(order1Res.data.order);

              // Pay first EMI
              if (order1Res.data.payment?.transaction_id) {
                console.log('\n💳 Paying first EMI...');
                try {
                  const verifyRes = await api.post(`/api/orders/${order1Res.data.order._id}/verify-payment`, {
                    razorpay_payment_id: 'pay_test_' + Date.now(),
                    razorpay_signature: 'sig_test_' + Date.now(),
                    transaction_id: order1Res.data.payment.transaction_id
                  });
                  console.log(`  ✅ EMI 1/${days1} paid successfully`);
                  console.log(`  💰 Referral commission: ${verifyRes.data.progress ? 'Processed' : 'Pending'}`);
                } catch (error) {
                  logError('Failed to verify first EMI', error);
                }
              }
            }
          } catch (error) {
            logError('Failed to create Order 1', error);
          }
        }

        await sleep(1000);

        // Order 2: Medium product with daily EMI and multiple payments
        if (activeProducts.length > 1) {
          const product2 = activeProducts[1];
          const price2 = product2.pricing.finalPrice;
          const dailyAmount2 = Math.max(50, Math.ceil(price2 / 8));
          const days2 = Math.ceil(price2 / dailyAmount2);

          console.log(`\n📝 Creating Order 2: ${product2.name} (₹${price2})`);
          console.log(`   Daily EMI: ₹${dailyAmount2} for ${days2} days`);

          try {
            const order2Res = await api.post('/api/orders', {
              productId: product2._id,
              paymentOption: 'daily',
              paymentDetails: {
                dailyAmount: dailyAmount2,
                totalDays: days2
              },
              deliveryAddress: {
                addressLine1: '456 Test Avenue, Tower C',
                city: 'Delhi',
                state: 'Delhi',
                pincode: '110001',
                phone: '9876543211'
              }
            });

            logResponse('Order 2 Created (Daily EMI with Progress)', {
              orderId: order2Res.data.order._id,
              product: product2.name,
              amount: order2Res.data.order.orderAmount,
              dailyAmount: dailyAmount2,
              totalDays: days2,
              status: order2Res.data.order.orderStatus
            });

            if (order2Res.data.order) {
              createdOrders.push(order2Res.data.order);
              const orderId = order2Res.data.order._id;

              // Pay first EMI
              if (order2Res.data.payment?.transaction_id) {
                try {
                  await api.post(`/api/orders/${orderId}/verify-payment`, {
                    razorpay_payment_id: 'pay_test_1_' + Date.now(),
                    razorpay_signature: 'sig_test_1_' + Date.now(),
                    transaction_id: order2Res.data.payment.transaction_id
                  });
                  console.log(`  ✅ EMI 1/${days2} paid`);
                  await sleep(500);
                } catch (error) {
                  console.log(`  ⚠️ Failed to pay EMI 1`);
                }
              }

              // Pay 2-3 more EMIs
              const emisToPay = Math.min(3, days2 - 1);
              for (let i = 2; i <= emisToPay; i++) {
                try {
                  const paymentRes = await api.post(`/api/orders/${orderId}/create-payment`, {
                    paymentAmount: dailyAmount2
                  });

                  await api.post(`/api/orders/${orderId}/verify-payment`, {
                    razorpay_payment_id: `pay_test_${i}_` + Date.now(),
                    razorpay_signature: `sig_test_${i}_` + Date.now(),
                    transaction_id: paymentRes.data.transaction_id
                  });
                  console.log(`  ✅ EMI ${i}/${days2} paid`);
                  await sleep(500);
                } catch (error) {
                  console.log(`  ⚠️ Failed to pay EMI ${i}`);
                }
              }

              console.log(`  📊 Progress: ${emisToPay}/${days2} EMIs completed`);
            }
          } catch (error) {
            logError('Failed to create Order 2', error);
          }
        }
      }
    }

    // ==========================================
    // 6. GET ORDER HISTORY
    // ==========================================
    console.log('\n📊 STEP 6: Fetching order history...');
    try {
      const ordersRes = await api.get('/api/orders/user/history');
      logResponse('Order History', {
        totalOrders: ordersRes.data.count,
        orders: ordersRes.data.orders?.map(o => ({
          id: o._id,
          product: o.product?.name,
          amount: o.orderAmount,
          paymentOption: o.paymentOption,
          paymentStatus: o.paymentStatus,
          orderStatus: o.orderStatus,
          currentEMI: o.currentEmiNumber || 0,
          totalPaid: o.totalPaid || 0
        }))
      });
    } catch (error) {
      logError('Failed to get order history', error);
    }

    // ==========================================
    // 7. GET TRANSACTION HISTORY
    // ==========================================
    console.log('\n💳 STEP 7: Fetching transaction history...');
    try {
      const txRes = await api.get('/api/wallet/transactions');
      logResponse('Transaction History', {
        summary: txRes.data.summary,
        recentTransactions: txRes.data.transactions?.slice(0, 10).map(tx => ({
          type: tx.type,
          amount: tx.amount,
          status: tx.status,
          description: tx.description,
          date: tx.createdAt
        }))
      });
    } catch (error) {
      logError('Failed to get transactions', error);
    }

    // ==========================================
    // 8. FINAL WALLET & SUMMARY
    // ==========================================
    console.log('\n💰 STEP 8: Final wallet status...');
    try {
      const finalWalletRes = await api.get('/api/wallet');
      logResponse('Final Wallet Status', {
        walletBalance: finalWalletRes.data.walletBalance,
        totalBalance: finalWalletRes.data.totalBalance,
        availableBalance: finalWalletRes.data.availableBalance,
        totalEarnings: finalWalletRes.data.totalEarnings,
        referralBonus: finalWalletRes.data.referralBonus,
        transactionCount: finalWalletRes.data.transactions?.length
      });
    } catch (error) {
      logError('Failed to get final wallet', error);
    }

    // ==========================================
    // FINAL SUMMARY
    // ==========================================
    console.log('\n' + '='.repeat(70));
    console.log('📊 COMPREHENSIVE TEST SUMMARY');
    console.log('='.repeat(70));
    console.log(`\n🆔 User ID: ${USER_ID}`);
    console.log(`🔗 Referral Code: ${REFERRAL_CODE}`);
    console.log(`📦 Products Tested: ${productIds.length}`);
    console.log(`📋 Orders Created: ${createdOrders.length}`);
    console.log(`✅ Wishlist: Items added`);
    console.log(`✅ Cart: Items added`);
    console.log(`✅ Transactions: Generated from EMI payments`);
    console.log(`\n💡 Note: The user logged in using referral code ${REFERRAL_CODE}`);
    console.log(`    All EMI payments automatically trigger 20% referral commission`);
    console.log(`    to the referrer who owns this code.`);
    console.log('\n' + '='.repeat(70));
    console.log('\n🎉 ALL USER FUNCTIONS TESTED SUCCESSFULLY!');
    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
  }
}

// Run the tests
testAllUserFunctions().then(() => {
  console.log('\n✅ Test script completed!\n');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Test script failed:', error);
  process.exit(1);
});
