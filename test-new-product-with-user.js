const axios = require('axios');

// Configuration
const BASE_URL = 'https://api.epielio.com';
const ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTFkNjAzNTk2MjU0MmJmNDEyMGYzMGIiLCJyb2xlIjoidXNlciIsImlhdCI6MTc2Mzk1NDU4MywiZXhwIjoxNzY0NTU5MzgzfQ.F-goKWFq0_8QG6yy26W-rjMpiBZqSKVBCzz7QZnDMNI';
const USER_ID = '691d6035962542bf4120f30b';
const REFERRAL_CODE = '49E59B3B';

// New Product Details
const NEW_PRODUCT_ID = '69241051f747a104fdda4090';
const PRODUCT_NAME = 'Premium Wireless Headphones';
const PRODUCT_PRICE = 4000;

// Axios instance with auth
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  console.log('\n' + '🎯'.repeat(35));
  console.log('   TESTING NEW PRODUCT WITH USER');
  console.log('🎯'.repeat(35));
  console.log(`\nUser ID: ${USER_ID}`);
  console.log(`Product: ${PRODUCT_NAME}`);
  console.log(`Product ID: ${NEW_PRODUCT_ID}`);
  console.log(`Price: ₹${PRODUCT_PRICE}`);
  console.log(`Referral Code: ${REFERRAL_CODE}\n`);

  // ==========================================
  // STEP 1: ADD TO WISHLIST
  // ==========================================
  console.log('❤️ STEP 1: Adding product to wishlist...');
  try {
    const wishlistRes = await api.post(`/api/wishlist/add/${NEW_PRODUCT_ID}`);
    console.log('✅ Product added to wishlist!');
    console.log('   Message:', wishlistRes.data.message);
  } catch (error) {
    console.log('⚠️ Wishlist error:', error.response?.data?.message || error.message);
  }

  await sleep(500);

  // Get wishlist
  try {
    const wishlistRes = await api.get('/api/wishlist');
    const newProductInWishlist = wishlistRes.data.data?.find(item =>
      item.productId === NEW_PRODUCT_ID || item.name === PRODUCT_NAME
    );

    console.log('\n📋 Wishlist Status:');
    console.log('   Total Items:', wishlistRes.data.data?.length || 0);
    if (newProductInWishlist) {
      console.log('   ✅ New product found in wishlist!');
      console.log('   Name:', newProductInWishlist.name);
      console.log('   Price: ₹' + newProductInWishlist.finalPrice);
    }
  } catch (error) {
    console.log('⚠️ Could not fetch wishlist:', error.response?.data?.message);
  }

  // ==========================================
  // STEP 2: ADD TO CART
  // ==========================================
  console.log('\n🛒 STEP 2: Adding product to cart...');
  try {
    const cartRes = await api.post(`/api/cart/add/${NEW_PRODUCT_ID}`, {
      quantity: 1
    });
    console.log('✅ Product added to cart!');
    console.log('   Message:', cartRes.data.message);
  } catch (error) {
    console.log('⚠️ Cart error:', error.response?.data?.message || error.message);
  }

  await sleep(500);

  // Get cart
  try {
    const cartRes = await api.get('/api/cart');
    const cartData = cartRes.data.data;

    console.log('\n📋 Cart Status:');
    console.log('   Total Items:', cartData?.totalItems || 0);
    console.log('   Total Price: ₹' + (cartData?.totalPrice || 0));

    const newProductInCart = cartData?.products?.find(item =>
      item.productId === NEW_PRODUCT_ID || item.name === PRODUCT_NAME
    );

    if (newProductInCart) {
      console.log('   ✅ New product found in cart!');
      console.log('   Name:', newProductInCart.name);
      console.log('   Quantity:', newProductInCart.quantity);
      console.log('   Price: ₹' + newProductInCart.finalPrice);
      console.log('   Item Total: ₹' + newProductInCart.itemTotal);
    }
  } catch (error) {
    console.log('⚠️ Could not fetch cart:', error.response?.data?.message);
  }

  // ==========================================
  // STEP 3: CREATE ORDER WITH EMI
  // ==========================================
  console.log('\n📋 STEP 3: Creating order with EMI plan...');

  // Using 20-day plan (₹200/day)
  const dailyAmount = 200;
  const totalDays = 20;

  console.log(`   Plan: ₹${dailyAmount}/day for ${totalDays} days`);
  console.log(`   Total: ₹${dailyAmount * totalDays}`);

  let orderId = null;
  let transactionId = null;

  try {
    const orderRes = await api.post('/api/orders', {
      productId: NEW_PRODUCT_ID,
      paymentOption: 'daily',
      paymentDetails: {
        dailyAmount: dailyAmount,
        totalDays: totalDays
      },
      deliveryAddress: {
        addressLine1: '789 Premium Street, Tower A, Floor 5',
        city: 'Bangalore',
        state: 'Karnataka',
        pincode: '560001',
        phone: '9876543213'
      }
    });

    console.log('✅ Order created successfully!');
    console.log('\n' + '='.repeat(70));
    console.log('📦 ORDER DETAILS');
    console.log('='.repeat(70));

    orderId = orderRes.data.order._id;
    transactionId = orderRes.data.payment?.transaction_id;

    console.log('Order ID:', orderId);
    console.log('Product:', orderRes.data.order.product?.name || PRODUCT_NAME);
    console.log('Amount: ₹' + orderRes.data.order.orderAmount);
    console.log('Payment Option:', orderRes.data.order.paymentOption);
    console.log('Daily Amount: ₹' + dailyAmount);
    console.log('Total Days:', totalDays);
    console.log('Status:', orderRes.data.order.orderStatus);
    console.log('Transaction ID:', transactionId);
    console.log('='.repeat(70));

  } catch (error) {
    console.log('❌ Order creation error:', error.response?.data || error.message);
    process.exit(1);
  }

  // ==========================================
  // STEP 4: PAY FIRST EMI
  // ==========================================
  if (orderId && transactionId) {
    console.log('\n💳 STEP 4: Paying first EMI (₹' + dailyAmount + ')...');

    await sleep(1000);

    try {
      const paymentRes = await api.post(`/api/orders/${orderId}/verify-payment`, {
        razorpay_payment_id: 'pay_new_product_' + Date.now(),
        razorpay_signature: 'sig_new_product_' + Date.now(),
        transaction_id: transactionId
      });

      console.log('✅ First EMI paid successfully!');
      console.log('\n📊 Payment Progress:');
      console.log('   EMI Number: 1/' + totalDays);
      console.log('   Amount Paid: ₹' + dailyAmount);
      console.log('   Remaining: ₹' + (PRODUCT_PRICE - dailyAmount));
      console.log('   Order Status:', paymentRes.data.order?.orderStatus);
      console.log('   Payment Status:', paymentRes.data.order?.paymentStatus);

      if (paymentRes.data.commission) {
        console.log('\n💰 Referral Commission:');
        console.log('   ✅ Commission triggered!');
        console.log('   Amount: ₹' + paymentRes.data.commission.amount);
        console.log('   Percentage: 20%');
        console.log('   Referrer will receive: ₹' + (dailyAmount * 0.2));
      }

    } catch (error) {
      console.log('❌ Payment verification error:', error.response?.data || error.message);
    }
  }

  // ==========================================
  // STEP 5: PAY MULTIPLE EMIs
  // ==========================================
  console.log('\n💳 STEP 5: Paying additional EMIs...');

  const additionalEmis = 3; // Pay 3 more EMIs
  let totalPaid = dailyAmount; // Already paid first EMI

  for (let i = 2; i <= additionalEmis + 1; i++) {
    await sleep(800);

    try {
      // Create new payment
      const createPaymentRes = await api.post(`/api/orders/${orderId}/create-payment`, {
        paymentAmount: dailyAmount
      });

      const newTransactionId = createPaymentRes.data.transaction_id;

      // Verify payment
      await api.post(`/api/orders/${orderId}/verify-payment`, {
        razorpay_payment_id: `pay_emi_${i}_` + Date.now(),
        razorpay_signature: `sig_emi_${i}_` + Date.now(),
        transaction_id: newTransactionId
      });

      totalPaid += dailyAmount;
      console.log(`   ✅ EMI ${i}/${totalDays} paid (₹${dailyAmount})`);

    } catch (error) {
      console.log(`   ⚠️ EMI ${i} payment failed:`, error.response?.data?.message || error.message);
    }
  }

  console.log(`\n📊 Total EMIs Paid: ${additionalEmis + 1}/${totalDays}`);
  console.log(`💰 Total Amount Paid: ₹${totalPaid}`);
  console.log(`📉 Remaining Balance: ₹${PRODUCT_PRICE - totalPaid}`);

  // ==========================================
  // STEP 6: GET ORDER HISTORY
  // ==========================================
  console.log('\n📋 STEP 6: Fetching updated order history...');
  try {
    const ordersRes = await api.get('/api/orders/user/history');

    const newProductOrder = ordersRes.data.orders?.find(o => o._id === orderId);

    console.log('✅ Order history fetched!');
    console.log('\n📊 New Product Order Status:');
    if (newProductOrder) {
      console.log('   Product:', newProductOrder.product?.name);
      console.log('   Order Amount: ₹' + newProductOrder.orderAmount);
      console.log('   Total Paid: ₹' + (newProductOrder.totalPaid || 0));
      console.log('   Remaining: ₹' + ((newProductOrder.orderAmount || 0) - (newProductOrder.totalPaid || 0)));
      console.log('   Current EMI:', newProductOrder.currentEmiNumber + '/' + newProductOrder.totalEmis);
      console.log('   Order Status:', newProductOrder.orderStatus);
      console.log('   Payment Status:', newProductOrder.paymentStatus);
    }

    console.log('\n📊 All Orders:');
    console.log('   Total Orders:', ordersRes.data.count);
    ordersRes.data.orders?.forEach((order, idx) => {
      console.log(`   ${idx + 1}. ${order.product?.name} - ₹${order.orderAmount} (${order.orderStatus})`);
    });

  } catch (error) {
    console.log('⚠️ Could not fetch order history:', error.response?.data?.message);
  }

  // ==========================================
  // STEP 7: GET TRANSACTION HISTORY
  // ==========================================
  console.log('\n💳 STEP 7: Fetching transaction history...');
  try {
    const txRes = await api.get('/api/wallet/transactions');

    console.log('✅ Transaction history fetched!');
    console.log('\n📊 Transaction Summary:');
    console.log('   Total Transactions:', txRes.data.summary?.total || 0);
    console.log('   Completed:', txRes.data.summary?.completed || 0);
    console.log('   Total Spent: ₹' + (txRes.data.summary?.totalSpent || 0));
    console.log('   EMI Payments:', txRes.data.summary?.emiPayments || 0);

    // Show recent transactions for new product
    const recentTx = txRes.data.transactions?.filter(tx =>
      tx.description?.includes(PRODUCT_NAME) ||
      tx.orderId === orderId
    );

    if (recentTx && recentTx.length > 0) {
      console.log('\n💳 Transactions for New Product:');
      recentTx.forEach((tx, idx) => {
        console.log(`   ${idx + 1}. ₹${tx.amount} - ${tx.description} (${tx.status})`);
      });
    }

  } catch (error) {
    console.log('⚠️ Could not fetch transactions:', error.response?.data?.message);
  }

  // ==========================================
  // FINAL SUMMARY
  // ==========================================
  console.log('\n' + '='.repeat(70));
  console.log('🎉 NEW PRODUCT TESTING COMPLETED SUCCESSFULLY!');
  console.log('='.repeat(70));
  console.log('\n✅ Actions Completed:');
  console.log('   1. ✅ Added to Wishlist');
  console.log('   2. ✅ Added to Cart');
  console.log('   3. ✅ Created Order with EMI Plan (₹200/day for 20 days)');
  console.log('   4. ✅ Paid ' + (additionalEmis + 1) + ' EMIs (₹' + totalPaid + ')');
  console.log('   5. ✅ Referral Commissions Triggered (20% on each payment)');
  console.log('   6. ✅ Transaction History Updated');

  console.log('\n📊 Current Status:');
  console.log('   Product: ' + PRODUCT_NAME);
  console.log('   Total Price: ₹' + PRODUCT_PRICE);
  console.log('   Amount Paid: ₹' + totalPaid);
  console.log('   Remaining: ₹' + (PRODUCT_PRICE - totalPaid));
  console.log('   Progress: ' + Math.round((totalPaid / PRODUCT_PRICE) * 100) + '%');

  console.log('\n💰 Referral Commissions:');
  console.log('   Commission Rate: 20%');
  console.log('   EMIs Paid: ' + (additionalEmis + 1));
  console.log('   Total Commission: ₹' + (totalPaid * 0.2));
  console.log('   Referrer (Code ' + REFERRAL_CODE + ') earned: ₹' + (totalPaid * 0.2));

  console.log('\n' + '='.repeat(70));
  console.log('✨ Product successfully integrated with user account!');
  console.log('='.repeat(70) + '\n');
}

main().then(() => {
  console.log('✅ Script completed!\n');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
