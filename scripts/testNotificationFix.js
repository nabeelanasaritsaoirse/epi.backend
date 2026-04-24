/**
 * Test script to verify notification system correctly sanitizes data
 */

const mongoose = require('mongoose');

// Test the sanitization logic
function sanitizeDataForFCM(data = {}) {
  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) {
      continue;
    }
    sanitized[key] = String(value);
  }
  return sanitized;
}

// Test the ObjectId conversion in triggerNotification
function convertPushData(pushData) {
  Object.keys(pushData).forEach(key => {
    if (pushData[key] !== null && pushData[key] !== undefined) {
      pushData[key] = String(pushData[key]);
    }
  });
  return pushData;
}

// Test cases
console.log('🧪 Testing Notification Data Sanitization\n');

// Test 1: Regular metadata with ObjectId
const testObjectId = new mongoose.Types.ObjectId();
const metadata1 = {
  orderId: testObjectId,
  amount: 100,
  status: 'confirmed'
};

console.log('Test 1: Metadata with ObjectId');
console.log('Input:', metadata1);
const sanitized1 = convertPushData({ type: 'ORDER_CONFIRMATION', ...metadata1 });
console.log('Output:', sanitized1);
console.log('All strings?', Object.values(sanitized1).every(v => typeof v === 'string'));
console.log('');

// Test 2: Nested data from buildPushData
const notification = {
  _id: new mongoose.Types.ObjectId(),
  type: 'SYSTEM_NOTIFICATION',
  systemType: 'ORDER_DELIVERED',
  metadata: {
    orderId: new mongoose.Types.ObjectId()
  }
};

console.log('Test 2: buildPushData output');
const orderIdString = notification.metadata.orderId.toString();
const pushData = {
  notificationId: notification._id.toString(),
  type: notification.type,
  navigateTo: `/notifications/${notification._id}`,
  systemType: notification.systemType,
  orderId: orderIdString,
  navigateToOrder: `/orders/${orderIdString}`
};
console.log('Input:', pushData);
const sanitized2 = convertPushData(pushData);
console.log('Output:', sanitized2);
console.log('All strings?', Object.values(sanitized2).every(v => typeof v === 'string'));
console.log('');

// Test 3: FCM Service sanitization
console.log('Test 3: FCM Service data sanitization');
const fcmData = {
  clickAction: 'FLUTTER_NOTIFICATION_CLICK',
  timestamp: Date.now(),
  orderId: new mongoose.Types.ObjectId(),
  amount: 150.50,
  count: 5
};
console.log('Input:', fcmData);
const sanitized3 = sanitizeDataForFCM(fcmData);
console.log('Output:', sanitized3);
console.log('All strings?', Object.values(sanitized3).every(v => typeof v === 'string'));
console.log('');

// Test 4: Null/undefined values
console.log('Test 4: Null/undefined handling');
const dataWithNulls = {
  validKey: 'value',
  nullKey: null,
  undefinedKey: undefined,
  numberId: 123
};
console.log('Input:', dataWithNulls);
const sanitized4 = sanitizeDataForFCM(dataWithNulls);
console.log('Output:', sanitized4);
console.log('Should only have validKey and numberId:', Object.keys(sanitized4));
console.log('All strings?', Object.values(sanitized4).every(v => typeof v === 'string'));
console.log('');

console.log('✅ All tests completed!');
