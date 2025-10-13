/**
 * Utility functions for date formatting compatible with OrientDB
 */

/**
 * Convert JavaScript Date to OrientDB-compatible datetime format
 * OrientDB expects: yyyy-MM-dd HH:mm:ss
 * @param {Date} date - The date to convert
 * @returns {string} - Formatted date string
 */
function toOrientDBDateTime(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const seconds = String(d.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Get current timestamp in OrientDB format
 * @returns {string} - Current timestamp
 */
function now() {
  return toOrientDBDateTime();
}

/**
 * Add hours to current date and return in OrientDB format
 * @param {number} hours - Number of hours to add
 * @returns {string} - Future timestamp
 */
function addHours(hours) {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return toOrientDBDateTime(date);
}

/**
 * Add days to current date and return in OrientDB format
 * @param {number} days - Number of days to add
 * @returns {string} - Future timestamp
 */
function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toOrientDBDateTime(date);
}

module.exports = {
  toOrientDBDateTime,
  now,
  addHours,
  addDays,
};
