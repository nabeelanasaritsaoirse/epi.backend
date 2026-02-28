/**
 * Role Helper Functions
 * Utility functions for role-based access control
 * Supports both primary role and additionalRoles (backward compatible)
 */

/**
 * Check if user has a specific role
 * Checks both 'role' field (primary) and 'additionalRoles' array
 * @param {Object} user - User object
 * @param {String} roleName - Role to check
 * @returns {Boolean}
 */
const hasRole = (user, roleName) => {
  if (!user) return false;

  // Check primary role
  if (user.role === roleName) return true;

  // Check additional roles (if exists)
  if (user.additionalRoles && Array.isArray(user.additionalRoles)) {
    if (user.additionalRoles.includes(roleName)) return true;
  }

  return false;
};

/**
 * Check if user has any of the given roles
 * @param {Object} user - User object
 * @param {Array} roleNames - Array of roles to check
 * @returns {Boolean}
 */
const hasAnyRole = (user, roleNames) => {
  if (!user || !roleNames) return false;
  if (!Array.isArray(roleNames)) roleNames = [roleNames];

  return roleNames.some(role => hasRole(user, role));
};

/**
 * Check if user is admin (admin or super_admin)
 * @param {Object} user - User object
 * @returns {Boolean}
 */
const isAdmin = (user) => {
  return hasAnyRole(user, ['admin', 'super_admin']);
};

/**
 * Check if user is super admin
 * @param {Object} user - User object
 * @returns {Boolean}
 */
const isSuperAdmin = (user) => {
  return hasRole(user, 'super_admin');
};

/**
 * Check if user is sales team member
 * @param {Object} user - User object
 * @returns {Boolean}
 */
const isSalesTeam = (user) => {
  return hasRole(user, 'sales_team');
};

/**
 * Check if user is a seller
 * @param {Object} user - User object
 * @returns {Boolean}
 */
const isSeller = (user) => {
  return hasRole(user, 'seller');
};

/**
 * Check if user can access admin panel (admin, super_admin, or sales_team)
 * @param {Object} user - User object
 * @returns {Boolean}
 */
const canAccessPanel = (user) => {
  return hasAnyRole(user, ['admin', 'super_admin', 'sales_team']);
};

/**
 * Get all roles for a user (primary + additional)
 * @param {Object} user - User object
 * @returns {Array} Array of unique roles
 */
const getAllRoles = (user) => {
  if (!user) return [];

  const roles = [user.role];

  if (user.additionalRoles && Array.isArray(user.additionalRoles)) {
    roles.push(...user.additionalRoles);
  }

  // Return unique roles
  return [...new Set(roles)];
};

/**
 * Add a role to user's additionalRoles
 * @param {Object} user - User mongoose document
 * @param {String} roleName - Role to add
 * @returns {Object} Updated user
 */
const addRole = async (user, roleName) => {
  if (!user) throw new Error('User is required');

  // Don't add if already has this role
  if (hasRole(user, roleName)) {
    return user;
  }

  // Initialize additionalRoles if not exists
  if (!user.additionalRoles) {
    user.additionalRoles = [];
  }

  user.additionalRoles.push(roleName);
  await user.save();

  return user;
};

/**
 * Remove a role from user's additionalRoles
 * @param {Object} user - User mongoose document
 * @param {String} roleName - Role to remove
 * @returns {Object} Updated user
 */
const removeRole = async (user, roleName) => {
  if (!user) throw new Error('User is required');

  // Can't remove primary role
  if (user.role === roleName) {
    throw new Error('Cannot remove primary role. Change role field directly.');
  }

  if (user.additionalRoles && user.additionalRoles.includes(roleName)) {
    user.additionalRoles = user.additionalRoles.filter(r => r !== roleName);
    await user.save();
  }

  return user;
};

module.exports = {
  hasRole,
  hasAnyRole,
  isAdmin,
  isSuperAdmin,
  isSalesTeam,
  isSeller,
  canAccessPanel,
  getAllRoles,
  addRole,
  removeRole
};
