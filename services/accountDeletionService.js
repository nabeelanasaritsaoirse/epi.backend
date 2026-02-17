const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { deleteImageFromS3 } = require('./awsUploadService');

/**
 * Permanently delete a user account and all associated data.
 * Used by both the delete-account API and the scheduled deletion cron.
 * @param {string} userId - The MongoDB ObjectId of the user to delete
 * @returns {Object} Summary of deleted data
 */
async function hardDeleteUserAccount(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  console.log(`[AccountDeletion] Starting hard delete for user: ${user.email} (${userId})`);

  // 1. Delete profile picture from S3
  if (user.profilePicture && user.profilePicture.includes('s3.amazonaws.com')) {
    try {
      await deleteImageFromS3(user.profilePicture);
      console.log('[AccountDeletion] Profile picture deleted from S3');
    } catch (error) {
      console.error('[AccountDeletion] Error deleting profile picture:', error);
    }
  }

  // 2. Delete KYC documents from S3
  let kycCount = 0;
  if (user.kycDocuments && user.kycDocuments.length > 0) {
    for (const doc of user.kycDocuments) {
      if (doc.docUrl && doc.docUrl.includes('s3.amazonaws.com')) {
        try {
          await deleteImageFromS3(doc.docUrl);
          kycCount++;
        } catch (error) {
          console.error(`[AccountDeletion] Error deleting KYC doc (${doc.docType}):`, error);
        }
      }
    }
  }

  // 3. Delete user transactions
  let deletedTransactionCount = 0;
  try {
    const result = await Transaction.deleteMany({ user: userId });
    deletedTransactionCount = result.deletedCount;
    console.log(`[AccountDeletion] Deleted ${deletedTransactionCount} transactions`);
  } catch (error) {
    console.error('[AccountDeletion] Error deleting transactions:', error);
  }

  // 4. Clean referral chains
  try {
    await User.updateMany(
      { referredUsers: userId },
      { $pull: { referredUsers: userId } }
    );
    await User.updateMany(
      { referredBy: userId },
      { $unset: { referredBy: 1 } }
    );
    console.log('[AccountDeletion] Referral chain cleaned up');
  } catch (error) {
    console.error('[AccountDeletion] Error cleaning referral chain:', error);
  }

  // 5. Delete the user record
  await User.findByIdAndDelete(userId);

  console.log(`[AccountDeletion] Account deleted successfully: ${user.email}`);

  return {
    user: true,
    email: user.email,
    transactions: deletedTransactionCount,
    profilePicture: !!user.profilePicture,
    kycDocuments: kycCount,
    addresses: user.addresses?.length || 0,
    bankDetails: user.bankDetails?.length || 0
  };
}

module.exports = { hardDeleteUserAccount };
