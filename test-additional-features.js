const axios = require('axios');

const BASE_URL = 'https://api.epielio.com';
const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTE1ZTc1NmE3YjAzNmFhMjJhZjNkNDYiLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NjQyOTQyMDUsImV4cCI6MTc2NDg5OTAwNX0.ecTw7Bm6nz5Wcyu1Sqx1OBI23VmjouRc0jzwTPJjA0w';
const USER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTFkNjAzNTk2MjU0MmJmNDEyMGYzMGIiLCJyb2xlIjoidXNlciIsImlhdCI6MTc2Mzk1NDU4MywiZXhwIjoxNzY0NTU5MzgzfQ.F-goKWFq0_8QG6yy26W-rjMpiBZqSKVBCzz7QZnDMNI';

const adminRequest = axios.create({
  baseURL: BASE_URL,
  headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` }
});

const userRequest = axios.create({
  baseURL: BASE_URL,
  headers: { 'Authorization': `Bearer ${USER_TOKEN}` }
});

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const additionalTestResults = {
  singleNotification: null,
  userCommentDelete: null,
  adminCommentModeration: null,
  adminSoftDelete: null,
  getComments: null,
  unlikeTest: null
};

// Test: Get Single Notification with Details
async function testGetSingleNotification() {
  console.log('\n📄 Testing Get Single Notification...\n');

  try {
    // Get first published notification ID
    const feedResponse = await userRequest.get('/api/notifications?page=1&limit=1');
    const notificationId = feedResponse.data.data.notifications[0]._id;

    // Get single notification
    const singleResponse = await userRequest.get(`/api/notifications/${notificationId}`);
    const notification = singleResponse.data.data;

    console.log(`✅ Single notification fetched: ${notification.notificationId}`);
    console.log(`   - Title: ${notification.title}`);
    console.log(`   - Type: ${notification.type}`);
    console.log(`   - Post Type: ${notification.postType}`);
    console.log(`   - Likes: ${notification.likeCount}`);
    console.log(`   - Comments: ${notification.commentCount}`);
    console.log(`   - Views: ${notification.viewCount}`);
    console.log(`   - Is Liked By Me: ${notification.isLikedByMe}`);
    console.log(`   - Comments Enabled: ${notification.commentsEnabled}`);
    console.log(`   - Likes Enabled: ${notification.likesEnabled}`);

    additionalTestResults.singleNotification = {
      success: true,
      notificationId: notification.notificationId,
      details: {
        title: notification.title,
        type: notification.type,
        postType: notification.postType,
        likeCount: notification.likeCount,
        commentCount: notification.commentCount,
        viewCount: notification.viewCount,
        isLikedByMe: notification.isLikedByMe
      }
    };

    return notificationId;

  } catch (error) {
    console.error(`❌ Get single notification failed:`, error.response?.data || error.message);
    additionalTestResults.singleNotification = {
      success: false,
      error: error.response?.data || error.message
    };
    return null;
  }
}

// Test: Get Comments for Notification
async function testGetComments(notificationId) {
  console.log('\n💬 Testing Get Comments...\n');

  try {
    const response = await userRequest.get(`/api/notifications/${notificationId}/comments?page=1&limit=10`);
    const comments = response.data.data.comments;

    console.log(`✅ Comments fetched: ${comments.length} comments`);
    comments.forEach((comment, index) => {
      console.log(`   ${index + 1}. ${comment.user.name}: ${comment.text}`);
    });

    additionalTestResults.getComments = {
      success: true,
      count: comments.length,
      comments: comments
    };

    return comments.length > 0 ? comments[0]._id : null;

  } catch (error) {
    console.error(`❌ Get comments failed:`, error.response?.data || error.message);
    additionalTestResults.getComments = {
      success: false,
      error: error.response?.data || error.message
    };
    return null;
  }
}

// Test: Unlike Notification
async function testUnlike(notificationId) {
  console.log('\n👎 Testing Unlike Notification...\n');

  try {
    // Unlike (toggle like again)
    await userRequest.post(`/api/notifications/${notificationId}/like`);
    console.log(`✅ Notification unliked successfully`);

    // Like again to restore state
    await userRequest.post(`/api/notifications/${notificationId}/like`);
    console.log(`✅ Notification liked again`);

    additionalTestResults.unlikeTest = {
      success: true
    };

  } catch (error) {
    console.error(`❌ Unlike test failed:`, error.response?.data || error.message);
    additionalTestResults.unlikeTest = {
      success: false,
      error: error.response?.data || error.message
    };
  }
}

// Test: User Delete Own Comment
async function testUserDeleteComment() {
  console.log('\n🗑️  Testing User Delete Own Comment...\n');

  try {
    // Get a notification
    const feedResponse = await userRequest.get('/api/notifications?page=1&limit=1');
    const notificationId = feedResponse.data.data.notifications[0]._id;

    // Add a new comment
    const commentResponse = await userRequest.post(`/api/notifications/${notificationId}/comments`, {
      text: 'This is a test comment that I will delete soon.'
    });
    const commentId = commentResponse.data.data._id;
    console.log(`✅ Test comment created: ${commentId}`);

    await sleep(1000);

    // Delete own comment
    await userRequest.delete(`/api/notifications/${notificationId}/comments/${commentId}`);
    console.log(`✅ User successfully deleted own comment`);

    additionalTestResults.userCommentDelete = {
      success: true,
      commentId: commentId
    };

  } catch (error) {
    console.error(`❌ User delete comment failed:`, error.response?.data || error.message);
    additionalTestResults.userCommentDelete = {
      success: false,
      error: error.response?.data || error.message
    };
  }
}

// Test: Admin Comment Moderation
async function testAdminCommentModeration() {
  console.log('\n👮 Testing Admin Comment Moderation...\n');

  try {
    // Get all notifications
    const adminNotifications = await adminRequest.get('/api/admin/notifications?page=1&limit=20');
    const notifications = adminNotifications.data.data.notifications;

    // Find a notification with comments
    let targetNotification = null;
    let targetComment = null;

    for (const notif of notifications) {
      if (notif.commentCount > 0) {
        // Get comments for this notification
        const commentsResponse = await userRequest.get(`/api/notifications/${notif._id}/comments?page=1&limit=10`);
        const comments = commentsResponse.data.data.comments;

        if (comments.length > 0) {
          targetNotification = notif;
          targetComment = comments[0];
          break;
        }
      }
    }

    if (targetNotification && targetComment) {
      // Admin delete comment with reason
      await adminRequest.delete(
        `/api/admin/notifications/${targetNotification._id}/comments/${targetComment._id}`,
        { data: { reason: 'Spam content - administrative moderation' } }
      );

      console.log(`✅ Admin successfully deleted comment from notification: ${targetNotification.notificationId}`);
      console.log(`   - Comment: "${targetComment.text.substring(0, 50)}..."`);
      console.log(`   - Reason: Spam content - administrative moderation`);

      additionalTestResults.adminCommentModeration = {
        success: true,
        notificationId: targetNotification.notificationId,
        commentId: targetComment._id
      };
    } else {
      console.log(`⚠️  No comments found to moderate`);
      additionalTestResults.adminCommentModeration = {
        success: false,
        reason: 'No comments available to moderate'
      };
    }

  } catch (error) {
    console.error(`❌ Admin comment moderation failed:`, error.response?.data || error.message);
    additionalTestResults.adminCommentModeration = {
      success: false,
      error: error.response?.data || error.message
    };
  }
}

// Test: Admin Soft Delete Notification
async function testAdminSoftDelete() {
  console.log('\n🗑️  Testing Admin Soft Delete Notification...\n');

  try {
    // Create a test notification to delete
    const testNotification = await adminRequest.post('/api/admin/notifications/create', {
      postType: 'POST',
      title: 'Test Notification - Will be Deleted',
      body: 'This notification is created for testing soft delete functionality.',
      sendInApp: false,
      sendPush: false,
      commentsEnabled: false,
      likesEnabled: false
    });

    const notificationId = testNotification.data.data._id;
    const notifId = testNotification.data.data.notificationId;
    console.log(`✅ Test notification created: ${notifId}`);

    await sleep(1000);

    // Soft delete the notification
    await adminRequest.delete(`/api/admin/notifications/${notificationId}`);
    console.log(`✅ Admin successfully soft deleted notification: ${notifId}`);

    // Try to get it again (should fail or return deleted status)
    try {
      await userRequest.get(`/api/notifications/${notificationId}`);
      console.log(`⚠️  Deleted notification still accessible`);
    } catch (error) {
      if (error.response?.status === 404) {
        console.log(`✅ Deleted notification correctly returns 404`);
      }
    }

    additionalTestResults.adminSoftDelete = {
      success: true,
      notificationId: notifId
    };

  } catch (error) {
    console.error(`❌ Admin soft delete failed:`, error.response?.data || error.message);
    additionalTestResults.adminSoftDelete = {
      success: false,
      error: error.response?.data || error.message
    };
  }
}

// Test: Get Admin Notifications List with Filters
async function testAdminGetNotifications() {
  console.log('\n📋 Testing Admin Get Notifications with Filters...\n');

  try {
    // Test different filters
    console.log('Testing filter: status=published');
    const publishedResponse = await adminRequest.get('/api/admin/notifications?status=published&page=1&limit=5');
    console.log(`✅ Published notifications: ${publishedResponse.data.data.notifications.length}`);

    await sleep(500);

    console.log('Testing filter: status=scheduled');
    const scheduledResponse = await adminRequest.get('/api/admin/notifications?status=scheduled&page=1&limit=5');
    console.log(`✅ Scheduled notifications: ${scheduledResponse.data.data.notifications.length}`);

    await sleep(500);

    console.log('Testing filter: type=ADMIN_POST');
    const typeResponse = await adminRequest.get('/api/admin/notifications?type=ADMIN_POST&page=1&limit=5');
    console.log(`✅ ADMIN_POST notifications: ${typeResponse.data.data.notifications.length}`);

    console.log(`✅ All admin filter tests passed`);

  } catch (error) {
    console.error(`❌ Admin get notifications failed:`, error.response?.data || error.message);
  }
}

// MAIN EXECUTION
async function runAdditionalTests() {
  console.log('🚀 Starting Additional Notification Tests...\n');
  console.log('=' .repeat(60));

  try {
    // Test get single notification
    const notificationId = await testGetSingleNotification();

    if (notificationId) {
      await sleep(1000);

      // Test get comments
      await testGetComments(notificationId);
      await sleep(1000);

      // Test unlike
      await testUnlike(notificationId);
      await sleep(1000);
    }

    // Test user delete own comment
    await testUserDeleteComment();
    await sleep(1000);

    // Test admin comment moderation
    await testAdminCommentModeration();
    await sleep(1000);

    // Test admin soft delete
    await testAdminSoftDelete();
    await sleep(1000);

    // Test admin get notifications with filters
    await testAdminGetNotifications();

    console.log('\n' + '='.repeat(60));
    console.log('\n📋 ADDITIONAL TEST RESULTS:\n');
    console.log(JSON.stringify(additionalTestResults, null, 2));

    // Save results
    const fs = require('fs');
    fs.writeFileSync('additional-test-results.json', JSON.stringify(additionalTestResults, null, 2));
    console.log('\n✅ Additional test results saved to additional-test-results.json');

    console.log('\n🎉 All Additional Tests Completed!\n');

  } catch (error) {
    console.error('❌ Test execution failed:', error);
  }
}

runAdditionalTests();
