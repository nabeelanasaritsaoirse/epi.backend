const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://api.epielio.com';
const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTE1ZTc1NmE3YjAzNmFhMjJhZjNkNDYiLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NjQyOTQyMDUsImV4cCI6MTc2NDg5OTAwNX0.ecTw7Bm6nz5Wcyu1Sqx1OBI23VmjouRc0jzwTPJjA0w';
const USER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTFkNjAzNTk2MjU0MmJmNDEyMGYzMGIiLCJyb2xlIjoidXNlciIsImlhdCI6MTc2Mzk1NDU4MywiZXhwIjoxNzY0NTU5MzgzfQ.F-goKWFq0_8QG6yy26W-rjMpiBZqSKVBCzz7QZnDMNI';

// Product IDs for PRODUCT_SHARE notifications
const PRODUCT_IDS = [
  '6928d9178d575774e5274628', // JBL PartyBox 310
  '6928d9168d575774e5274621', // Amazon Echo Hub
  '6928d9158d575774e527461a', // PlayStation 5 Pro
  '6928d8f88d575774e5274613', // iPad Pro 12.9-inch
  '6928d8f68d575774e527460c'  // Apple Watch Ultra 2
];

// Image files to upload
const IMAGES = [
  'apple-190970_1280.jpg',
  'black-and-white-2573314_1280.jpg',
  'camera-510530_1280.jpg',
  'electronic-connector-7669295_1280.jpg',
  'headphones-956720_1280.jpg'
];

const testResults = {
  created: [],
  published: [],
  scheduled: [],
  failed: [],
  userInteractions: [],
  adminActions: []
};

// Helper to make requests
const adminRequest = axios.create({
  baseURL: BASE_URL,
  headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` }
});

const userRequest = axios.create({
  baseURL: BASE_URL,
  headers: { 'Authorization': `Bearer ${USER_TOKEN}` }
});

// Sleep helper
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 1. CREATE 5 OFFER NOTIFICATIONS
async function createOfferNotifications() {
  console.log('\n📢 Creating 5 OFFER Notifications...\n');

  const offers = [
    {
      title: '🎉 Mega Weekend Sale - Up to 70% OFF!',
      body: 'Get ready for the biggest sale of the season! Grab your favorite electronics at unbeatable prices. Limited time offer - Shop now and save big on smartphones, laptops, headphones & more!',
      sendInApp: true,
      sendPush: true
    },
    {
      title: '⚡ Flash Deal: Premium Headphones at 50% OFF',
      body: 'Don\'t miss out! Sony WH-1000XM5 now available at half price. Industry-leading noise cancellation, 30-hour battery life. Hurry, only 24 hours left!',
      sendInApp: true,
      sendPush: true
    },
    {
      title: '🎁 Buy 1 Get 1 Free - Smart Accessories',
      body: 'Exclusive offer on smart watches and fitness bands! Purchase any smart accessory and get another one absolutely FREE. Valid on all premium brands. Offer ends tonight!',
      sendInApp: true,
      sendPush: true
    },
    {
      title: '🔥 Clearance Sale: Gaming Consoles 40% OFF',
      body: 'Level up your gaming experience! PlayStation 5, Xbox Series X, and Nintendo Switch - All at massive discounts. Plus free games worth $100 with every purchase!',
      sendInApp: true,
      sendPush: true
    },
    {
      title: '💰 Cashback Bonanza - Earn Up to ₹5000 Back!',
      body: 'Shop for ₹20,000 or more and get instant cashback of ₹5000 in your wallet! Valid on all categories. Use code: MEGA5000. Offer valid for today only!',
      sendInApp: true,
      sendPush: true
    }
  ];

  for (let i = 0; i < offers.length; i++) {
    try {
      const response = await adminRequest.post('/api/admin/notifications/create', {
        postType: 'OFFER',
        ...offers[i],
        commentsEnabled: true,
        likesEnabled: true
      });

      console.log(`✅ OFFER ${i + 1} Created:`, response.data.data.notificationId);
      testResults.created.push({
        type: 'OFFER',
        id: response.data.data._id,
        notificationId: response.data.data.notificationId,
        title: offers[i].title
      });

      await sleep(1000); // Wait 1 second between requests
    } catch (error) {
      console.error(`❌ OFFER ${i + 1} Failed:`, error.response?.data || error.message);
      testResults.failed.push({ type: 'OFFER', index: i + 1, error: error.response?.data });
    }
  }
}

// 2. CREATE 5 POST NOTIFICATIONS
async function createPostNotifications() {
  console.log('\n📝 Creating 5 POST Notifications...\n');

  const posts = [
    {
      title: '🚀 Exciting New Features Coming Soon!',
      body: 'We\'re thrilled to announce upcoming features that will revolutionize your shopping experience! Get ready for:\n\n✨ AI-powered product recommendations\n🎯 Personalized deals based on your preferences\n📱 Enhanced mobile app with AR try-on\n🎁 Loyalty rewards program\n\nStay tuned for more updates!',
      sendInApp: true,
      sendPush: true
    },
    {
      title: '🌟 Customer Appreciation Week Starts Tomorrow!',
      body: 'Thank you for being an amazing part of our community! To show our gratitude, we\'re hosting a week-long celebration with:\n\n• Daily surprise deals\n• Exclusive member-only discounts\n• Free gift wrapping\n• Priority customer support\n\nYour loyalty means everything to us! ❤️',
      sendInApp: true,
      sendPush: true
    },
    {
      title: '📦 New Express Delivery in Your Area!',
      body: 'Great news! We\'ve launched same-day delivery in your city! 🎉\n\nOrder before 2 PM and get your products delivered the same day. Perfect for last-minute gifts and urgent needs.\n\nFree express delivery on orders above ₹2000. Try it now!',
      sendInApp: true,
      sendPush: true
    },
    {
      title: '🏆 You\'re Invited: Exclusive Product Launch Event',
      body: 'Join us for the biggest tech launch of 2024!\n\n📅 Date: This Saturday\n⏰ Time: 7 PM IST\n📍 Location: Live Virtual Event\n\nBe the first to witness groundbreaking innovations. Register now and get a special launch discount code!\n\nLimited seats available!',
      sendInApp: true,
      sendPush: true
    },
    {
      title: '💡 Tips: How to Choose the Perfect Smartphone',
      body: 'Confused about which phone to buy? Here are our expert tips:\n\n1️⃣ Camera Quality: Look for 48MP+ sensors\n2️⃣ Battery Life: Minimum 4500mAh\n3️⃣ Display: AMOLED for vibrant colors\n4️⃣ Storage: 128GB minimum\n5️⃣ Processor: Latest generation chips\n\nVisit our buying guide for detailed comparisons!',
      sendInApp: true,
      sendPush: false
    }
  ];

  for (let i = 0; i < posts.length; i++) {
    try {
      const response = await adminRequest.post('/api/admin/notifications/create', {
        postType: 'POST',
        ...posts[i],
        commentsEnabled: true,
        likesEnabled: true
      });

      console.log(`✅ POST ${i + 1} Created:`, response.data.data.notificationId);
      testResults.created.push({
        type: 'POST',
        id: response.data.data._id,
        notificationId: response.data.data.notificationId,
        title: posts[i].title
      });

      await sleep(1000);
    } catch (error) {
      console.error(`❌ POST ${i + 1} Failed:`, error.response?.data || error.message);
      testResults.failed.push({ type: 'POST', index: i + 1, error: error.response?.data });
    }
  }
}

// 3. CREATE 5 POST_WITH_IMAGE NOTIFICATIONS
async function createPostWithImageNotifications() {
  console.log('\n🖼️  Creating 5 POST_WITH_IMAGE Notifications...\n');

  const postsWithImages = [
    {
      title: '🎧 Unboxing: Premium Headphones Collection',
      body: 'Check out our latest collection of premium headphones! Featuring top brands like Sony, Bose, and Apple. Experience studio-quality sound, all-day comfort, and cutting-edge technology. Swipe to see more!',
      image: 'headphones-956720_1280.jpg'
    },
    {
      title: '📸 Photography Masterclass: Camera Essentials',
      body: 'Capture life\'s precious moments like a pro! Our new range of professional cameras is here. From mirrorless to DSLRs, find the perfect camera for your photography journey. Limited stock available!',
      image: 'camera-510530_1280.jpg'
    },
    {
      title: '🍎 Fresh Apple Products Just Arrived!',
      body: 'The wait is over! Latest Apple products now in stock:\n\n• iPhone 15 Pro Max\n• MacBook Pro M3\n• iPad Pro with M2\n• Apple Watch Ultra 2\n\nPremium quality, authentic products with official warranty. Pre-order now!',
      image: 'apple-190970_1280.jpg'
    },
    {
      title: '🔌 Tech Components Sale - Build Your Dream Setup',
      body: 'Calling all tech enthusiasts! Massive discount on electronic components and accessories. Build your custom PC, upgrade your home theater, or create your smart home setup. Everything you need, all in one place!',
      image: 'electronic-connector-7669295_1280.jpg'
    },
    {
      title: '⚫ The Black Collection - Minimalist Tech',
      body: 'Elegance meets technology. Introducing our exclusive black edition collection. Sleek, sophisticated, and powerful. These limited edition products are designed for those who appreciate refined aesthetics.',
      image: 'black-and-white-2573314_1280.jpg'
    }
  ];

  for (let i = 0; i < postsWithImages.length; i++) {
    try {
      // First create the notification
      const response = await adminRequest.post('/api/admin/notifications/create', {
        postType: 'POST_WITH_IMAGE',
        title: postsWithImages[i].title,
        body: postsWithImages[i].body,
        sendInApp: true,
        sendPush: true,
        commentsEnabled: true,
        likesEnabled: true
      });

      const notificationId = response.data.data._id;
      console.log(`✅ POST_WITH_IMAGE ${i + 1} Created:`, response.data.data.notificationId);

      // Then upload the image
      const imagePath = path.join(__dirname, postsWithImages[i].image);
      if (fs.existsSync(imagePath)) {
        const formData = new FormData();
        formData.append('image', fs.createReadStream(imagePath));

        try {
          await adminRequest.put(`/api/admin/notifications/${notificationId}/upload-image`, formData, {
            headers: formData.getHeaders()
          });
          console.log(`✅ Image uploaded for POST_WITH_IMAGE ${i + 1}`);
        } catch (uploadError) {
          console.error(`❌ Image upload failed for POST_WITH_IMAGE ${i + 1}:`, uploadError.response?.data || uploadError.message);
        }
      }

      testResults.created.push({
        type: 'POST_WITH_IMAGE',
        id: notificationId,
        notificationId: response.data.data.notificationId,
        title: postsWithImages[i].title,
        image: postsWithImages[i].image
      });

      await sleep(2000); // Wait 2 seconds (upload limit)
    } catch (error) {
      console.error(`❌ POST_WITH_IMAGE ${i + 1} Failed:`, error.response?.data || error.message);
      testResults.failed.push({ type: 'POST_WITH_IMAGE', index: i + 1, error: error.response?.data });
    }
  }
}

// 4. CREATE 5 PRODUCT_SHARE NOTIFICATIONS
async function createProductShareNotifications() {
  console.log('\n🛍️  Creating 5 PRODUCT_SHARE Notifications...\n');

  const productShares = [
    {
      title: '🎵 JBL PartyBox 310 - Party Like Never Before!',
      body: 'Transform any gathering into an epic party! Powerful bass, stunning LED lights, and Bluetooth connectivity. Perfect for outdoor events, house parties, and celebrations. Get yours now!',
      productId: PRODUCT_IDS[0]
    },
    {
      title: '🏠 Amazon Echo Hub - Your Smart Home Command Center',
      body: 'Control your entire smart home with just your voice! Alexa built-in, intuitive touch screen, and seamless device integration. Make your home smarter today!',
      productId: PRODUCT_IDS[1]
    },
    {
      title: '🎮 PlayStation 5 Pro - Next-Gen Gaming Awaits',
      body: 'Experience gaming like never before! 2TB storage, 8K gaming support, ray tracing technology. Immerse yourself in breathtaking graphics and lightning-fast load times. Limited stock!',
      productId: PRODUCT_IDS[2]
    },
    {
      title: '📱 iPad Pro 12.9" - Unleash Your Creativity',
      body: 'The ultimate tablet for creatives and professionals. M2 chip power, Liquid Retina display, Apple Pencil support. Perfect for design, video editing, and productivity. Available now!',
      productId: PRODUCT_IDS[3]
    },
    {
      title: '⌚ Apple Watch Ultra 2 - Adventure Ready',
      body: 'Built for explorers and adventurers! Titanium case, action button, dual-frequency GPS. Track your fitness, monitor your health, stay connected anywhere. Pre-order today!',
      productId: PRODUCT_IDS[4]
    }
  ];

  for (let i = 0; i < productShares.length; i++) {
    try {
      const response = await adminRequest.post('/api/admin/notifications/create', {
        postType: 'PRODUCT_SHARE',
        ...productShares[i],
        sendInApp: true,
        sendPush: true,
        commentsEnabled: true,
        likesEnabled: true
      });

      console.log(`✅ PRODUCT_SHARE ${i + 1} Created:`, response.data.data.notificationId);
      testResults.created.push({
        type: 'PRODUCT_SHARE',
        id: response.data.data._id,
        notificationId: response.data.data.notificationId,
        title: productShares[i].title,
        productId: productShares[i].productId
      });

      await sleep(1000);
    } catch (error) {
      console.error(`❌ PRODUCT_SHARE ${i + 1} Failed:`, error.response?.data || error.message);
      testResults.failed.push({ type: 'PRODUCT_SHARE', index: i + 1, error: error.response?.data });
    }
  }
}

// 5. PUBLISH NOTIFICATIONS
async function publishNotifications() {
  console.log('\n📤 Publishing Notifications...\n');

  // Publish first 15 notifications, schedule the rest
  const toPublish = testResults.created.slice(0, 15);
  const toSchedule = testResults.created.slice(15);

  for (const notification of toPublish) {
    try {
      await adminRequest.post(`/api/admin/notifications/${notification.id}/publish`);
      console.log(`✅ Published: ${notification.notificationId}`);
      testResults.published.push(notification);
      await sleep(500);
    } catch (error) {
      console.error(`❌ Publish failed for ${notification.notificationId}:`, error.response?.data || error.message);
    }
  }

  // Schedule remaining for 1 hour from now
  const scheduledTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  for (const notification of toSchedule) {
    try {
      await adminRequest.post(`/api/admin/notifications/${notification.id}/schedule`, {
        scheduledAt: scheduledTime
      });
      console.log(`✅ Scheduled: ${notification.notificationId} for ${scheduledTime}`);
      testResults.scheduled.push(notification);
      await sleep(500);
    } catch (error) {
      console.error(`❌ Schedule failed for ${notification.notificationId}:`, error.response?.data || error.message);
    }
  }
}

// 6. TEST USER INTERACTIONS
async function testUserInteractions() {
  console.log('\n👤 Testing User Interactions...\n');

  // Get notification feed
  try {
    const feedResponse = await userRequest.get('/api/notifications?page=1&limit=20');
    console.log(`✅ User feed fetched: ${feedResponse.data.data.notifications.length} notifications`);

    const notifications = feedResponse.data.data.notifications.slice(0, 5); // Test with first 5

    for (const notification of notifications) {
      try {
        // Like notification
        await userRequest.post(`/api/notifications/${notification._id}/like`);
        console.log(`✅ Liked: ${notification.notificationId}`);

        // Add comment
        const comment = await userRequest.post(`/api/notifications/${notification._id}/comments`, {
          text: `This is amazing! 🎉 Can't wait to take advantage of this offer. Thanks for sharing!`
        });
        console.log(`✅ Commented on: ${notification.notificationId}`);

        // Mark as read
        await userRequest.post(`/api/notifications/${notification._id}/mark-read`);
        console.log(`✅ Marked as read: ${notification.notificationId}`);

        testResults.userInteractions.push({
          notificationId: notification.notificationId,
          liked: true,
          commented: true,
          commentId: comment.data.data._id
        });

        await sleep(1000);
      } catch (error) {
        console.error(`❌ User interaction failed:`, error.response?.data || error.message);
      }
    }

    // Get unread count
    const unreadResponse = await userRequest.get('/api/notifications/unread-count');
    console.log(`✅ Unread count: ${unreadResponse.data.data.count}`);

  } catch (error) {
    console.error(`❌ User interactions failed:`, error.response?.data || error.message);
  }
}

// 7. TEST ADMIN ACTIONS
async function testAdminActions() {
  console.log('\n👑 Testing Admin Actions...\n');

  if (testResults.published.length > 0) {
    const notification = testResults.published[0];

    try {
      // Update notification
      await adminRequest.patch(`/api/admin/notifications/${notification.id}`, {
        title: notification.title + ' [UPDATED]'
      });
      console.log(`✅ Updated notification: ${notification.notificationId}`);

      // Update settings
      await adminRequest.patch(`/api/admin/notifications/${notification.id}/settings`, {
        commentsEnabled: false
      });
      console.log(`✅ Updated settings: ${notification.notificationId}`);

      // Get analytics
      const analytics = await adminRequest.get('/api/admin/notifications/analytics');
      console.log(`✅ Analytics fetched:`, analytics.data.data);

      testResults.adminActions.push({
        updated: true,
        settingsChanged: true,
        analytics: true
      });

    } catch (error) {
      console.error(`❌ Admin action failed:`, error.response?.data || error.message);
    }
  }
}

// 8. TEST FCM TOKEN
async function testFCMToken() {
  console.log('\n🔔 Testing FCM Token Registration...\n');

  try {
    // Register token
    await userRequest.post('/api/notifications/register-token', {
      fcmToken: 'd7OAyilqQ4-di5hxrIqNIi:APA91bEJKV3VoAbuh-S0k5Edm1Gl_sTtOvMGkvKJyPXtahKb4hldanPfyCCoJgRGcUwfC1-jKT_lblGNM4U5egIt9S41psUsT5uGOSfdNycG38tF1Xvtf94'
    });
    console.log(`✅ FCM Token registered`);

    // Update preferences
    await userRequest.put('/api/notifications/preferences', {
      pushEnabled: true,
      orderUpdates: true,
      promotionalOffers: true,
      paymentAlerts: true
    });
    console.log(`✅ Notification preferences updated`);

  } catch (error) {
    console.error(`❌ FCM token test failed:`, error.response?.data || error.message);
  }
}

// MAIN EXECUTION
async function runAllTests() {
  console.log('🚀 Starting Comprehensive Notification Testing...\n');
  console.log('=' .repeat(60));

  try {
    await createOfferNotifications();
    await createPostNotifications();
    await createPostWithImageNotifications();
    await createProductShareNotifications();

    console.log('\n' + '='.repeat(60));
    console.log(`\n📊 CREATION SUMMARY:`);
    console.log(`✅ Total Created: ${testResults.created.length}`);
    console.log(`❌ Total Failed: ${testResults.failed.length}`);

    if (testResults.created.length > 0) {
      await publishNotifications();
      await sleep(2000);
      await testUserInteractions();
      await testAdminActions();
      await testFCMToken();
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n📋 FINAL TEST RESULTS:\n');
    console.log(`Created: ${testResults.created.length}`);
    console.log(`Published: ${testResults.published.length}`);
    console.log(`Scheduled: ${testResults.scheduled.length}`);
    console.log(`User Interactions: ${testResults.userInteractions.length}`);
    console.log(`Failed: ${testResults.failed.length}`);

    // Save results to file
    fs.writeFileSync('notification-test-results.json', JSON.stringify(testResults, null, 2));
    console.log('\n✅ Test results saved to notification-test-results.json');

    console.log('\n🎉 All Tests Completed!\n');

  } catch (error) {
    console.error('❌ Test execution failed:', error);
  }
}

runAllTests();
