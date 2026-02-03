/**
 * Seed Reviews Script
 *
 * This script creates 10 sample reviews on a product by:
 * 1. Logging in as admin
 * 2. Creating 10 test users via signup API
 * 3. Creating installment orders for each user via admin API
 * 4. Marking each order as DELIVERED
 * 5. Creating a review from each user
 * 6. Verifying via the public GET product reviews API
 *
 * Usage: node scripts/seedReviews.js
 */

const BASE_URL = "http://13.127.15.87:8080";

// Admin credentials
const ADMIN_EMAIL = "admin@epi.com";
const ADMIN_PASSWORD = "@Saoirse123";

// Product to review (cello Opalware - has existing delivered order)
const PRODUCT_ID = "PROD185699527";
const PRODUCT_MONGO_ID = "6957883958b99914a79c110f";

// Sample review data - 10 realistic Indian reviews
const SAMPLE_REVIEWS = [
  {
    rating: 5,
    title: "Absolutely beautiful dinner set!",
    comment: "This Cello Opalware dinner set is stunning. The tropical lagoon design is gorgeous and looks premium on our dining table. Microwave safe which is a huge plus. The plates are lightweight yet feel sturdy. We have been using it for a month now and no scratches or chips. Worth every rupee. Highly recommended for families!",
    detailedRatings: { quality: 5, valueForMoney: 5, delivery: 5, accuracy: 5 },
    images: [{ url: "https://company-video-storage-prod.s3.ap-south-1.amazonaws.com/reviews/sample1.jpg", caption: "Beautiful design on the table" }],
  },
  {
    rating: 4,
    title: "Good quality, minor packaging issue",
    comment: "The dinner set quality is excellent. Opalware material is top notch and the green tropical design is eye-catching. Only reason for 4 stars is that one bowl had a tiny chip on arrival, but customer support was helpful. The set looks amazing during dinner parties. My family loves the lightweight feel.",
    detailedRatings: { quality: 5, valueForMoney: 4, delivery: 3, accuracy: 4 },
    images: [],
  },
  {
    rating: 5,
    title: "Perfect for daily use and gifting",
    comment: "Bought this as a housewarming gift and it was a hit! The 17-piece set covers everything you need. Microwave and dishwasher safe makes daily use hassle free. The opalware is much better than regular ceramic. Delivery was quick and packaging was secure. Will buy again for my own home.",
    detailedRatings: { quality: 5, valueForMoney: 5, delivery: 5, accuracy: 5 },
    images: [
      { url: "https://company-video-storage-prod.s3.ap-south-1.amazonaws.com/reviews/sample3a.jpg", caption: "Full set unboxed" },
      { url: "https://company-video-storage-prod.s3.ap-south-1.amazonaws.com/reviews/sample3b.jpg", caption: "Serving bowl closeup" },
    ],
  },
  {
    rating: 3,
    title: "Decent product but expected more",
    comment: "The quality of opalware is good and design is nice. However, I felt the plates are a bit smaller than what I expected from the images. The serving bowl is good sized though. For the price point, it is an okay deal. Not bad but not exceptional either.",
    detailedRatings: { quality: 3, valueForMoney: 3, delivery: 4, accuracy: 2 },
    images: [],
  },
  {
    rating: 5,
    title: "Best dinner set at this price!",
    comment: "After comparing many options, I chose this Cello set and I am so glad I did. The tropical lagoon pattern is unique and refreshing. All 17 pieces are perfect with no defects. Scratch resistant claim is true - tested with steel spoons and no marks. The veg bowls are the perfect size for dal and sabzi. 100% recommended!",
    detailedRatings: { quality: 5, valueForMoney: 5, delivery: 5, accuracy: 5 },
    images: [{ url: "https://company-video-storage-prod.s3.ap-south-1.amazonaws.com/reviews/sample5.jpg", caption: "No scratches after daily use" }],
  },
  {
    rating: 4,
    title: "Elegant and practical",
    comment: "Very happy with this purchase. The opalware material is lightweight which is great for everyday use. My mother was worried about it being fragile but it is quite sturdy. The green and white color combination is soothing. Only wish they had included a bigger serving plate in the set.",
    detailedRatings: { quality: 4, valueForMoney: 4, delivery: 5, accuracy: 4 },
    images: [],
  },
  {
    rating: 5,
    title: "Premium feel at affordable price",
    comment: "This dinner set exceeded my expectations completely. The Dazzle Tropical Lagoon design makes every meal feel special. Opalware is the future - so much lighter than traditional crockery. Easy to clean, no food stains stick to it. The quarter plates are perfect for breakfast. Bought a second set for my parents too!",
    detailedRatings: { quality: 5, valueForMoney: 5, delivery: 4, accuracy: 5 },
    images: [
      { url: "https://company-video-storage-prod.s3.ap-south-1.amazonaws.com/reviews/sample7a.jpg", caption: "Breakfast setup" },
    ],
  },
  {
    rating: 2,
    title: "Color faded after washing",
    comment: "Initially the set looked great but after about 2 weeks of regular washing, the green color started fading on two plates. The design is not as vibrant anymore. Quality of opalware itself is fine but the printing quality could be better. Disappointed with the durability of the design.",
    detailedRatings: { quality: 2, valueForMoney: 2, delivery: 4, accuracy: 3 },
    images: [],
  },
  {
    rating: 4,
    title: "Great for small families",
    comment: "Perfect dinner set for a family of 3-4. The 17 pieces include 4 dinner plates, 4 quarter plates, 8 bowls and 1 serving bowl. The tropical lagoon pattern is attractive. Microwave safe is a must have feature these days. Slightly pricey but the quality justifies it. Good investment for your kitchen.",
    detailedRatings: { quality: 4, valueForMoney: 3, delivery: 5, accuracy: 4 },
    images: [{ url: "https://company-video-storage-prod.s3.ap-south-1.amazonaws.com/reviews/sample9.jpg", caption: "Complete set laid out" }],
  },
  {
    rating: 5,
    title: "Replacing all my old crockery with this!",
    comment: "This is my second purchase from this brand and the quality is consistently excellent. Cello Opalware is chip resistant, scratch proof and so easy to maintain. The tropical design brings freshness to our dining area. My guests always compliment the crockery now. Already planning to buy the matching tea set next!",
    detailedRatings: { quality: 5, valueForMoney: 5, delivery: 5, accuracy: 5 },
    images: [],
  },
];

// Test user names
const TEST_USERS = [
  { name: "Priya Sharma", email: "priya.review.test@example.com" },
  { name: "Amit Kumar", email: "amit.review.test@example.com" },
  { name: "Neha Gupta", email: "neha.review.test@example.com" },
  { name: "Rajesh Patel", email: "rajesh.review.test@example.com" },
  { name: "Sneha Reddy", email: "sneha.review.test@example.com" },
  { name: "Vikram Singh", email: "vikram.review.test@example.com" },
  { name: "Anita Desai", email: "anita.review.test@example.com" },
  { name: "Karan Mehta", email: "karan.review.test@example.com" },
  { name: "Pooja Nair", email: "pooja.review.test@example.com" },
  { name: "Arjun Joshi", email: "arjun.review.test@example.com" },
];

// Helper: API call
async function apiCall(method, path, body = null, token = null) {
  const url = `${BASE_URL}${path}`;
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(url, options);
  const data = await res.json();
  return { status: res.status, data };
}

// Helper: delay
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("=== REVIEW SEED SCRIPT ===\n");

  // ─── Step 1: Admin Login ───
  console.log("Step 1: Logging in as admin...");
  const adminLogin = await apiCall("POST", "/api/admin-auth/login", {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });

  if (!adminLogin.data.success) {
    console.error("Admin login failed:", adminLogin.data.message);
    process.exit(1);
  }

  const ADMIN_TOKEN = adminLogin.data.data.accessToken;
  console.log("  Admin logged in successfully.\n");

  // ─── Step 2: Create 10 Test Users ───
  console.log("Step 2: Creating 10 test users...");
  const userTokens = [];

  for (let i = 0; i < TEST_USERS.length; i++) {
    const user = TEST_USERS[i];
    const firebaseUid = `review_test_user_${Date.now()}_${i}`;

    const signup = await apiCall("POST", "/api/auth/signup", {
      name: user.name,
      email: user.email,
      firebaseUid: firebaseUid,
    });

    if (!signup.data.success && !signup.data.data) {
      console.error(`  Failed to create user ${user.name}:`, signup.data.message);
      continue;
    }

    const userData = signup.data.data;
    userTokens.push({
      userId: userData.userId,
      name: user.name,
      token: userData.accessToken,
    });

    console.log(`  [${i + 1}/10] Created: ${user.name} (${userData.userId})`);
    await delay(200);
  }

  console.log(`  Created ${userTokens.length} users.\n`);

  if (userTokens.length === 0) {
    console.error("No users created. Exiting.");
    process.exit(1);
  }

  // ─── Step 2.5: Add Wallet Funds to Each User ───
  console.log("Step 2.5: Adding wallet funds to each user...");

  for (let i = 0; i < userTokens.length; i++) {
    const user = userTokens[i];
    const creditRes = await apiCall(
      "POST",
      "/api/admin/wallet/credit",
      { userId: user.userId, amount: 1000, description: "Test funds for review seeding" },
      ADMIN_TOKEN
    );

    if (creditRes.data.success) {
      console.log(`  [${i + 1}/10] Credited Rs.1000 to ${user.name}`);
    } else {
      console.error(`  [${i + 1}/10] Failed to credit ${user.name}: ${creditRes.data.message}`);
    }
    await delay(200);
  }
  console.log("  Wallet funds added.\n");

  // ─── Step 3: Create Installment Orders for Each User ───
  console.log("Step 3: Creating installment orders for each user...");
  const orderIds = [];

  for (let i = 0; i < userTokens.length; i++) {
    const user = userTokens[i];

    const orderRes = await apiCall(
      "POST",
      "/api/installments/admin/orders/create-for-user",
      {
        userId: user.userId,
        productId: PRODUCT_ID,
        totalDays: 10,
        paymentMethod: "WALLET",
        shippingAddress: {
          name: user.name,
          phoneNumber: "9876543210",
          addressLine1: "123 Test Street",
          city: "Mumbai",
          state: "Maharashtra",
          pincode: "400001",
          country: "India",
        },
      },
      ADMIN_TOKEN
    );

    if (!orderRes.data.success) {
      console.error(`  Failed to create order for ${user.name}:`, orderRes.data.message || orderRes.data.error || JSON.stringify(orderRes.data));
      continue;
    }

    const orderData = orderRes.data.data;
    const orderId = orderData?.order?._id || orderData?.order?.orderId || orderData?._id;
    if (!orderId) {
      console.error(`  No orderId found for ${user.name}. Response:`, JSON.stringify(orderData).substring(0, 200));
      continue;
    }
    orderIds.push({ userId: user.userId, orderId, name: user.name, index: i });

    console.log(`  [${i + 1}/10] Order created for ${user.name}: ${orderId}`);
    await delay(300);
  }

  console.log(`  Created ${orderIds.length} orders.\n`);

  // ─── Step 4: Mark All Orders as DELIVERED ───
  console.log("Step 4: Marking orders as DELIVERED...");

  for (const order of orderIds) {
    const deliveryRes = await apiCall(
      "PUT",
      `/api/installments/admin/orders/${order.orderId}/delivery-status`,
      { status: "DELIVERED" },
      ADMIN_TOKEN
    );

    if (!deliveryRes.data.success) {
      console.error(`  Failed to deliver order ${order.orderId}:`, deliveryRes.data.message || deliveryRes.data.error || JSON.stringify(deliveryRes.data));
      continue;
    }

    console.log(`  [${order.name}] Order ${order.orderId} marked DELIVERED`);
    await delay(200);
  }

  console.log("  All orders marked as delivered.\n");

  // ─── Step 5: Create Reviews from Each User ───
  console.log("Step 5: Creating reviews from each user...");
  let successCount = 0;
  let errorCount = 0;

  for (const order of orderIds) {
    const userToken = userTokens.find((u) => u.userId === order.userId);
    if (!userToken) continue;

    const reviewData = SAMPLE_REVIEWS[order.index];

    // First check if user can review
    const canReview = await apiCall(
      "GET",
      `/api/reviews/can-review/${PRODUCT_ID}`,
      null,
      userToken.token
    );

    console.log(`  [${order.name}] Can review: ${canReview.data?.data?.canReview} (${canReview.data?.data?.reason || "eligible"})`);

    if (!canReview.data?.data?.canReview) {
      console.error(`  [${order.name}] Cannot review: ${canReview.data?.data?.reason}`);
      errorCount++;
      continue;
    }

    // Create the review
    const reviewRes = await apiCall(
      "POST",
      "/api/reviews",
      {
        productId: PRODUCT_ID,
        rating: reviewData.rating,
        title: reviewData.title,
        comment: reviewData.comment,
        images: reviewData.images,
        detailedRatings: reviewData.detailedRatings,
      },
      userToken.token
    );

    if (reviewRes.data.success) {
      const status = reviewRes.data.data?.autoModeration?.isFlagged ? "(FLAGGED)" : "(PUBLISHED)";
      console.log(`  [${order.name}] Review created! Rating: ${reviewData.rating} stars ${status}`);
      successCount++;
    } else {
      console.error(`  [${order.name}] Review failed: ${reviewRes.data.message} (code: ${reviewRes.data.errorCode})`);
      errorCount++;
    }

    await delay(300);
  }

  console.log(`\n  Reviews created: ${successCount} | Failed: ${errorCount}\n`);

  // ─── Step 6: Verify - Get Product Reviews ───
  console.log("Step 6: Verifying via GET /api/products/:productId/reviews ...");
  const verifyRes = await apiCall("GET", `/api/products/${PRODUCT_ID}/reviews?limit=20`);

  if (verifyRes.data.success) {
    const stats = verifyRes.data.data.ratingStats;
    const reviews = verifyRes.data.data.reviews;
    const pagination = verifyRes.data.data.pagination;

    console.log("\n  === PRODUCT REVIEW STATS ===");
    console.log(`  Average Rating : ${stats.averageRating} / 5`);
    console.log(`  Total Reviews  : ${stats.totalReviews}`);
    console.log(`  Distribution   : 5★(${stats.ratingDistribution[5]}) 4★(${stats.ratingDistribution[4]}) 3★(${stats.ratingDistribution[3]}) 2★(${stats.ratingDistribution[2]}) 1★(${stats.ratingDistribution[1]})`);
    console.log(`  Aspect Ratings : Quality(${stats.aspectRatings.quality}) Value(${stats.aspectRatings.valueForMoney}) Delivery(${stats.aspectRatings.delivery}) Accuracy(${stats.aspectRatings.accuracy})`);
    console.log(`\n  === REVIEWS (${pagination.total} total) ===`);

    reviews.forEach((r, i) => {
      console.log(`  ${i + 1}. [${r.rating}★] "${r.title}" by ${r.userName} ${r.verifiedPurchase ? "(Verified)" : ""}`);
    });
  } else {
    console.error("  Verification failed:", verifyRes.data.message);
  }

  // ─── Step 7: Test Admin Stats Endpoint ───
  console.log("\nStep 7: Testing admin review stats...");
  const statsRes = await apiCall("GET", "/api/reviews/admin/stats", null, ADMIN_TOKEN);

  if (statsRes.data.success) {
    const s = statsRes.data.data.stats;
    console.log("  === ADMIN REVIEW STATS ===");
    console.log(`  Total Reviews    : ${s.totalReviews}`);
    console.log(`  Published        : ${s.publishedReviews}`);
    console.log(`  Flagged          : ${s.flaggedReviews}`);
    console.log(`  Auto-Flagged     : ${s.autoFlaggedReviews}`);
    console.log(`  Average Rating   : ${s.averageRating}`);
    console.log(`  Avg Quality Score: ${s.avgQualityScore}`);
  }

  // ─── Step 8: Test Admin Unpublish ───
  console.log("\nStep 8: Testing admin actions (unpublish + publish)...");

  const allReviewsRes = await apiCall("GET", "/api/reviews/admin/all?limit=1", null, ADMIN_TOKEN);

  if (allReviewsRes.data.success && allReviewsRes.data.data.reviews.length > 0) {
    const testReviewId = allReviewsRes.data.data.reviews[0]._id;

    // Unpublish
    const unpubRes = await apiCall(
      "PATCH",
      `/api/reviews/admin/${testReviewId}/unpublish`,
      { moderationNote: "Test unpublish from seed script" },
      ADMIN_TOKEN
    );
    console.log(`  Unpublish review ${testReviewId}: ${unpubRes.data.success ? "SUCCESS" : "FAILED"}`);

    // Publish back
    const pubRes = await apiCall(
      "PATCH",
      `/api/reviews/admin/${testReviewId}/publish`,
      {},
      ADMIN_TOKEN
    );
    console.log(`  Publish review ${testReviewId}: ${pubRes.data.success ? "SUCCESS" : "FAILED"}`);

    // Respond
    const respondRes = await apiCall(
      "POST",
      `/api/reviews/admin/${testReviewId}/respond`,
      { message: "Thank you for your wonderful review! We are glad you loved the product." },
      ADMIN_TOKEN
    );
    console.log(`  Admin respond to ${testReviewId}: ${respondRes.data.success ? "SUCCESS" : "FAILED"}`);
  }

  console.log("\n=== SEED SCRIPT COMPLETED ===");
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
