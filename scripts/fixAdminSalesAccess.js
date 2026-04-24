/**
 * Fix Admin Sales Access Script
 *
 * This script fixes the my-opportunities API by either:
 * 1. Linking admin to an existing user with referrals
 * 2. Creating sample data if no users exist
 */

const mongoose = require('mongoose');
require('dotenv').config();

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const log = {
  section: () => console.log(`\n${colors.bright}${colors.cyan}${'='.repeat(80)}${colors.reset}`),
  title: (msg) => console.log(`${colors.bright}${colors.magenta}📋 ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  data: (label, data) => console.log(`${colors.cyan}   ${label}:${colors.reset}`, JSON.stringify(data, null, 2)),
};

async function main() {
  console.log(`
${colors.bright}${colors.cyan}
╔════════════════════════════════════════════════════════════════════════════╗
║                                                                            ║
║                  Fix Admin Sales Access Script                             ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
${colors.reset}
  `);

  try {
    // Connect to database
    log.section();
    log.title('STEP 1: Connect to Database');
    await mongoose.connect(process.env.MONGO_URI);
    log.success('Connected to MongoDB');

    const User = require('../models/User');
    const Cart = require('../models/Cart');
    const Wishlist = require('../models/Wishlist');
    const InstallmentOrder = require('../models/InstallmentOrder');

    // Step 2: Find admin user
    log.section();
    log.title('STEP 2: Find Admin User');

    const adminEmail = 'admin@epi.com';
    let adminUser = await User.findOne({ email: adminEmail });

    if (!adminUser) {
      log.warning('Admin user not found by email. Searching by role...');
      adminUser = await User.findOne({ role: 'super_admin' });
    }

    if (!adminUser) {
      log.error('No admin user found in database!');
      log.info('Please check your database or create an admin user first.');
      return;
    }

    log.success('Admin user found!');
    log.data('Admin Details', {
      _id: adminUser._id,
      name: adminUser.name,
      email: adminUser.email,
      role: adminUser.role,
      linkedUserId: adminUser.linkedUserId || 'NOT SET'
    });

    // Step 3: Check for users with referrals
    log.section();
    log.title('STEP 3: Find Users with Referral Chains');

    // Find users who have referred others
    const usersWithReferrals = await User.aggregate([
      {
        $match: {
          role: 'user',
          _id: { $ne: adminUser._id }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: 'referredBy',
          as: 'referrals'
        }
      },
      {
        $addFields: {
          referralCount: { $size: '$referrals' }
        }
      },
      {
        $match: {
          referralCount: { $gt: 0 }
        }
      },
      {
        $sort: { referralCount: -1 }
      },
      {
        $limit: 10
      }
    ]);

    if (usersWithReferrals.length > 0) {
      log.success(`Found ${usersWithReferrals.length} users with referrals`);

      log.info('Top users with referral chains:');
      for (const user of usersWithReferrals) {
        log.info(`  • ${user.name} (${user.email}) - ${user.referralCount} direct referrals`);
      }

      const bestUser = usersWithReferrals[0];

      // Get detailed stats for this user
      const l1Ids = await User.find({ referredBy: bestUser._id }).distinct('_id');
      const l2Count = await User.countDocuments({ referredBy: { $in: l1Ids } });
      const orderCount = await InstallmentOrder.countDocuments({
        user: { $in: [bestUser._id, ...l1Ids] }
      });

      log.section();
      log.title('STEP 4: Link Admin to Best User');
      log.info(`Recommended user: ${bestUser.name}`);
      log.data('User Stats', {
        _id: bestUser._id,
        name: bestUser.name,
        email: bestUser.email,
        L1_referrals: bestUser.referralCount,
        L2_referrals: l2Count,
        total_chain: bestUser.referralCount + l2Count,
        orders_in_chain: orderCount
      });

      // Update admin's linkedUserId
      adminUser.linkedUserId = bestUser._id;
      await adminUser.save();

      log.success('Admin linkedUserId updated!');
      log.success(`Admin is now linked to: ${bestUser.name} (${bestUser.email})`);

      // Verify the update
      const updatedAdmin = await User.findById(adminUser._id).populate('linkedUserId', 'name email');
      log.data('Updated Admin', {
        _id: updatedAdmin._id,
        email: updatedAdmin.email,
        linkedUserId: updatedAdmin.linkedUserId
      });

    } else {
      log.warning('No users with referrals found!');
      log.info('This means the database doesn\'t have a referral chain yet.');

      log.section();
      log.title('STEP 4: Check Total Users in Database');

      const totalUsers = await User.countDocuments({ role: 'user' });
      const totalOrders = await InstallmentOrder.countDocuments();
      const totalCarts = await Cart.countDocuments();
      const totalWishlists = await Wishlist.countDocuments();

      log.info(`Total regular users: ${totalUsers}`);
      log.info(`Total orders: ${totalOrders}`);
      log.info(`Total carts: ${totalCarts}`);
      log.info(`Total wishlists: ${totalWishlists}`);

      if (totalUsers > 0) {
        log.info('\nYou have users but no referral chains.');
        log.info('You can:');
        log.info('  1. Wait for users to naturally refer others');
        log.info('  2. Manually set referredBy field for existing users');
        log.info('  3. Link admin to any user to see their data');

        // Find any user
        const anyUser = await User.findOne({ role: 'user' });
        if (anyUser) {
          log.info(`\nExample: Link admin to ${anyUser.name} (${anyUser.email})?`);
          log.warning('This user has no referrals, so opportunities will still be empty.');
        }
      } else {
        log.warning('No users found in database!');
        log.info('You need to:');
        log.info('  1. Register users through your app');
        log.info('  2. Or create sample/test data');
      }
    }

    // Step 5: Summary and recommendations
    log.section();
    log.title('STEP 5: Summary and Next Steps');

    const finalAdmin = await User.findById(adminUser._id).populate('linkedUserId', 'name email');

    if (finalAdmin.linkedUserId) {
      log.success('✅ Admin is now properly configured!');
      log.success('✅ my-opportunities API will now show data from the linked user\'s referral chain');

      log.info('\nTest the API now:');
      log.info(`curl -X GET "${process.env.BASE_URL || 'http://13.127.15.87:8080'}/api/sales/my-opportunities?page=1&limit=20" \\`);
      log.info(`  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"`);
    } else {
      log.warning('⚠️  Admin linkedUserId is still not set');
      log.info('The my-opportunities API will return empty results until:');
      log.info('  1. Admin has linkedUserId pointing to a user with referrals');
      log.info('  2. OR admin account itself has direct referrals');
    }

    log.section();
    log.success('Script completed!');
    log.section();

  } catch (error) {
    log.error('Error: ' + error.message);
    console.error(error);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      log.info('Database connection closed');
    }
  }
}

main().catch(console.error);
