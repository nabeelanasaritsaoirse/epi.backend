/**
 * Shared utility helpers used across controllers.
 */

/**
 * Escape special regex characters in user-supplied strings.
 * Prevents ReDoS attacks when input is used inside MongoDB $regex queries.
 *
 * @param {string} str - Raw user input
 * @returns {string} Safe string for use in RegExp / $regex
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Parse and validate pagination query parameters.
 * Ensures page >= 1 and 1 <= limit <= maxLimit.
 *
 * @param {object} query      - req.query object
 * @param {number} defaultLimit - Default limit when not provided (default 10)
 * @param {number} maxLimit   - Maximum allowed limit (default 100)
 * @returns {{ page, limit, skip }}
 */
function parsePagination(query, defaultLimit = 10, maxLimit = 100) {
  const page  = Math.max(1, parseInt(query.page,  10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  const skip  = (page - 1) * limit;
  return { page, limit, skip };
}

module.exports = { escapeRegex, parsePagination };
