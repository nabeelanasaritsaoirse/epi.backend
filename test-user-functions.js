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
  console.log('\n' + '='.repeat(60));
  console.log(`✅ ${title}`);
  console.log('='.repeat(60));
  console.log(JSON.stringify(data, null, 2));
};

const logError = (title, error) => {
  console.log('\n' + '='.repeat(60));
  console.log(`❌ ${title}`);
  console.log('='.repeat(60));
  console.log('Error:', error.response?.data || error.message);
};

// Main test function
async function testAllUserFunctions() {
  console.log('\n🚀 Starting comprehensive user function tests...\n');
  console.log(`User ID: ${USER_ID}`);
  console.log(`Referral Code Used: ${REFERRAL_CODE}`);
  console.log(`Base URL: ${BASE_URL}\n`);

  let productIds = [];
  let orderIds = [];

  try {
    // ==========================================
    // 1. GET ALL PRODUCTS (to get product IDs)
    // ==========================================
    console.log('\n📦 Step 1: Fetching available products...');
    try {
      const productsRes = await api.get('/api/products');
      const products = productsRes.data.data || productsRes.data.products || productsRes.data;

      if (products && products.length > 0) {
        // Get only available products with proper pricing
        const availableProducts = products.filter(p =>
          p.availability?.isAvailable &&
          p.pricing?.finalPrice &&
          p.pricing.finalPrice > 0
        );

        productIds = availableProducts.slice(0, 5).map(p => p._id);
        logResponse('Products fetched', {
          totalProducts: products.length,
          availableProducts: availableProducts.length,
          selectedProducts: productIds,
          selectedProductNames: availableProducts.slice(0, 5).map(p => ({ id: p._id, name: p.name, price: p.pricing.finalPrice }))
        });
      } else {
        console.log('⚠️ No products found in database');
      }
    } catch (error) {
      logError('Failed to fetch products', error);
    }

    // ==========================================
    // 2. CHECK CURRENT WALLET BALANCE
    // ==========================================
    console.log('\n💰 Step 2: Checking current wallet balance...');
    try {
      const walletRes = await api.get('/api/wallet');
      logResponse('Current Wallet Status', walletRes.data);
    } catch (error) {
      logError('Failed to get wallet', error);
    }

    // ==========================================
    // 3. ADD MONEY TO WALLET
    // ==========================================
    console.log('\n💵 Step 3: Adding money to wallet...');
    try {
      const addMoneyRes = await api.post('/api/wallet/add-money', {
        amount: 50000
      });
      logResponse('Add Money Order Created', addMoneyRes.data);

      // Simulate payment verification
      if (addMoneyRes.data.transaction_id) {
        console.log('\n🔄 Verifying wallet payment...');
        try {
          const verifyRes = await api.post('/api/wallet/verify-payment', {
            razorpay_order_id: addMoneyRes.data.order_id,
            razorpay_payment_id: 'pay_test_' + Date.now(),
            razorpay_signature: 'test_signature_' + Date.now(),
            transaction_id: addMoneyRes.data.transaction_id
          });
          logResponse('Wallet Payment Verified', verifyRes.data);
        } catch (error) {
          logError('Payment verification failed', error);
        }
      }

      // Check updated balance
      const updatedWalletRes = await api.get('/api/wallet');
      logResponse('Updated Wallet Balance', {
        balance: updatedWalletRes.data.walletBalance,
        totalBalance: updatedWalletRes.data.totalBalance,
        availableBalance: updatedWalletRes.data.availableBalance
      });
    } catch (error) {
      logError('Failed to add money', error);
    }

    // ==========================================
    // 4. ADD PRODUCTS TO WISHLIST
    // ==========================================
    if (productIds.length > 0) {
      console.log('\n❤️ Step 4: Adding products to wishlist...');
      const wishlistProducts = productIds.slice(0, 3);

      for (const productId of wishlistProducts) {
        try {
          const wishlistRes = await api.post(`/api/wishlist/add/${productId}`);
          console.log(`✅ Added product ${productId} to wishlist`);
        } catch (error) {
          console.log(`⚠️ Failed to add product ${productId} to wishlist:`, error.response?.data?.message);
        }
      }

      // Get wishlist
      try {
        const wishlistRes = await api.get('/api/wishlist');
        logResponse('Wishlist', {
          totalItems: wishlistRes.data.data?.length || 0,
          items: wishlistRes.data.data
        });
      } catch (error) {
        logError('Failed to get wishlist', error);
      }
    }

    // ==========================================
    // 5. ADD PRODUCTS TO CART
    // ==========================================
    if (productIds.length > 0) {
      console.log('\n🛒 Step 5: Adding products to cart...');
      const cartProducts = productIds.slice(0, 4);

      for (const productId of cartProducts) {
        try {
          const cartRes = await api.post(`/api/cart/add/${productId}`, {
            quantity: Math.floor(Math.random() * 3) + 1
          });
          console.log(`✅ Added product ${productId} to cart`);
        } catch (error) {
          console.log(`⚠️ Failed to add product ${productId} to cart:`, error.response?.data?.message);
        }
      }

      // Get cart
      try {
        const cartRes = await api.get('/api/cart/cart');
        logResponse('Cart', {
          totalItems: cartRes.data.data?.length || 0,
          items: cartRes.data.data
        });
      } catch (error) {
        logError('Failed to get cart', error);
      }
    }

    // ==========================================
    // 6. CREATE ORDERS
    // ==========================================
    if (productIds.length > 0) {
      console.log('\n📋 Step 6: Creating orders...');

      // Order 1: Daily payment (ongoing)
      try {
        console.log('\n📝 Creating order 1: Daily EMI (30 days)...');
        const order1Res = await api.post('/api/orders', {
          productId: productIds[0],
          paymentOption: 'daily',
          paymentDetails: {
            dailyAmount: 100,
            totalDays: 30
          },
          deliveryAddress: {
            addressLine1: '123 Test Street',
            city: 'Mumbai',
            state: 'Maharashtra',
            pincode: '400001',
            phone: '9876543210'
          }
        });

        logResponse('Order 1 Created (Daily EMI - Ongoing)', order1Res.data);

        if (order1Res.data.order) {
          orderIds.push(order1Res.data.order._id);

          // Pay first EMI
          if (order1Res.data.payment?.transaction_id) {
            console.log('\n💳 Paying first EMI...');
            try {
              const verifyRes = await api.post(`/api/orders/${order1Res.data.order._id}/verify-payment`, {
                razorpay_payment_id: 'pay_test_' + Date.now(),
                razorpay_signature: 'sig_test_' + Date.now(),
                transaction_id: order1Res.data.payment.transaction_id
              });
              logResponse('First EMI Paid', verifyRes.data);
            } catch (error) {
              logError('Failed to verify first EMI', error);
            }
          }
        }
      } catch (error) {
        logError('Failed to create order 1', error);
      }

      // Order 2: Daily payment with more progress
      if (productIds.length > 1) {
        try {
          console.log('\n📝 Creating order 2: Daily EMI (10 days)...');
          const order2Res = await api.post('/api/orders', {
            productId: productIds[1],
            paymentOption: 'daily',
            paymentDetails: {
              dailyAmount: 150,
              totalDays: 10
            },
            deliveryAddress: {
              addressLine1: '456 Test Avenue',
              city: 'Delhi',
              state: 'Delhi',
              pincode: '110001',
              phone: '9876543211'
            }
          });

          logResponse('Order 2 Created (Daily EMI - 10 days)', order2Res.data);

          if (order2Res.data.order) {
            orderIds.push(order2Res.data.order._id);

            // Pay first 3 EMIs
            if (order2Res.data.payment?.transaction_id) {
              const orderId = order2Res.data.order._id;

              // First EMI
              try {
                await api.post(`/api/orders/${orderId}/verify-payment`, {
                  razorpay_payment_id: 'pay_test_1_' + Date.now(),
                  razorpay_signature: 'sig_test_1_' + Date.now(),
                  transaction_id: order2Res.data.payment.transaction_id
                });
                console.log('✅ EMI 1/10 paid');
              } catch (error) {
                console.log('⚠️ Failed to pay EMI 1');
              }

              // Pay 2 more EMIs
              for (let i = 2; i <= 3; i++) {
                try {
                  const paymentRes = await api.post(`/api/orders/${orderId}/create-payment`, {
                    paymentAmount: 150
                  });

                  await api.post(`/api/orders/${orderId}/verify-payment`, {
                    razorpay_payment_id: `pay_test_${i}_` + Date.now(),
                    razorpay_signature: `sig_test_${i}_` + Date.now(),
                    transaction_id: paymentRes.data.transaction_id
                  });
                  console.log(`✅ EMI ${i}/10 paid`);
                } catch (error) {
                  console.log(`⚠️ Failed to pay EMI ${i}`);
                }
              }
            }
          }
        } catch (error) {
          logError('Failed to create order 2', error);
        }
      }

      // Order 3: Upfront payment (completed)
      if (productIds.length > 2) {
        try {
          console.log('\n📝 Creating order 3: Upfront payment (completed)...');
          const order3Res = await api.post('/api/orders', {
            productId: productIds[2],
            paymentOption: 'upfront',
            deliveryAddress: {
              addressLine1: '789 Test Road',
              city: 'Bangalore',
              state: 'Karnataka',
              pincode: '560001',
              phone: '9876543212'
            }
          });

          logResponse('Order 3 Created (Upfront - Completed)', order3Res.data);

          if (order3Res.data.order) {
            orderIds.push(order3Res.data.order._id);
          }
        } catch (error) {
          logError('Failed to create order 3', error);
        }
      }
    }

    // ==========================================
    // 7. GET ORDER HISTORY
    // ==========================================
    console.log('\n📊 Step 7: Fetching order history...');
    try {
      const ordersRes = await api.get('/api/orders/user/history');
      logResponse('Order History', {
        totalOrders: ordersRes.data.count,
        orders: ordersRes.data.orders
      });
    } catch (error) {
      logError('Failed to get order history', error);
    }

    // ==========================================
    // 8. GET TRANSACTION HISTORY
    // ==========================================
    console.log('\n�� Step 8: Fetching transaction history...');
    try {
      const txRes = await api.get('/api/wallet/transactions');
      logResponse('Transaction History', {
        summary: txRes.data.summary,
        totalTransactions: txRes.data.transactions?.length,
        recentTransactions: txRes.data.transactions?.slice(0, 5)
      });
    } catch (error) {
      logError('Failed to get transactions', error);
    }

    // ==========================================
    // 9. VERIFY REFERRAL CODE USAGE
    // ==========================================
    console.log('\n🔗 Step 9: Verifying referral code usage...');
    try {
      // Get referral dashboard if available
      try {
        const referralRes = await axios.get(`${BASE_URL}/api/referral/dashboard?userId=${USER_ID}`);
        logResponse('Referral Dashboard', referralRes.data);
      } catch (error) {
        console.log('⚠️ Could not fetch referral dashboard:', error.response?.data?.message || error.message);
      }

      // Try to get referral wallet
      try {
        const walletRes = await axios.get(`${BASE_URL}/api/referral/wallet/${USER_ID}`);
        logResponse('Referral Wallet', walletRes.data);
      } catch (error) {
        console.log('⚠️ Could not fetch referral wallet:', error.response?.data?.message || error.message);
      }

      console.log(`\n📝 Note: User logged in with referral code: ${REFERRAL_CODE}`);
      console.log('    Check the order verification logs above for referral commission creation');
    } catch (error) {
      logError('Failed to verify referral', error);
    }

    // ==========================================
    // 10. FINAL WALLET STATUS
    // ==========================================
    console.log('\n💰 Step 10: Final wallet status...');
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
    // SUMMARY
    // ==========================================
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Products fetched: ${productIds.length}`);
    console.log(`✅ Orders created: ${orderIds.length}`);
    console.log(`✅ Referral code: ${REFERRAL_CODE}`);
    console.log(`✅ User ID: ${USER_ID}`);
    console.log('\n🎉 All tests completed!');
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
  }
}

// Run the tests
testAllUserFunctions().then(() => {
  console.log('\n✅ Test script finished successfully!');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Test script failed:', error);
  process.exit(1);
});
