/**
 * Exchange Rate Service
 *
 * Fetches currency exchange rates from an external API and caches them
 * in memory. Provides silent fallback: if the external API is unavailable,
 * the last successfully cached rates are returned without throwing an error.
 *
 * Base currency: INR (all product prices are stored in INR)
 *
 * Usage:
 *   const ExchangeRateService = require('./exchangeRateService');
 *   const rate  = ExchangeRateService.getRate('USD');   // 0.012
 *   const price = ExchangeRateService.convertAmount(1000, 'USD'); // 12.00
 *
 * Environment variables:
 *   EXCHANGE_RATE_API_KEY  — API key for exchangerate-api.com
 *   EXCHANGE_RATE_API_URL  — Override API URL (optional)
 *   EXCHANGE_RATE_TTL_MS   — Cache TTL in ms (default: 3 600 000 = 1 hour)
 */

const axios = require("axios");

const BASE_CURRENCY = "INR";
const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

// In-memory rate cache
let rateCache = {
  rates: {},        // { USD: 0.012, AED: 0.044, ... }
  fetchedAt: null,  // Date of last successful fetch
};

/**
 * Fetch fresh rates from the external API.
 * On failure, logs a warning and keeps the existing cache intact.
 */
async function fetchRates() {
  const apiKey = process.env.EXCHANGE_RATE_API_KEY;

  if (!apiKey) {
    console.warn(
      "[ExchangeRateService] EXCHANGE_RATE_API_KEY not set — using cached/fallback rates"
    );
    return;
  }

  const url =
    process.env.EXCHANGE_RATE_API_URL ||
    `https://v6.exchangerate-api.com/v6/${apiKey}/latest/${BASE_CURRENCY}`;

  try {
    const response = await axios.get(url, { timeout: 8000 });

    if (response.data?.result === "success" && response.data?.conversion_rates) {
      rateCache.rates = response.data.conversion_rates;
      rateCache.fetchedAt = new Date();
      console.log(
        `[ExchangeRateService] Rates refreshed at ${rateCache.fetchedAt.toISOString()} — ${Object.keys(rateCache.rates).length} currencies`
      );
    } else {
      console.warn(
        "[ExchangeRateService] Unexpected API response format:",
        response.data?.result
      );
    }
  } catch (err) {
    // Silent fallback: keep existing cache, do NOT throw
    console.warn(
      `[ExchangeRateService] Rate fetch failed (${err.message}) — using cached rates from ${rateCache.fetchedAt?.toISOString() || "N/A"}`
    );
  }
}

/**
 * Returns whether the cache is stale (older than TTL or never fetched).
 */
function isCacheStale() {
  if (!rateCache.fetchedAt) return true;
  const ttl = parseInt(process.env.EXCHANGE_RATE_TTL_MS) || DEFAULT_TTL_MS;
  return Date.now() - rateCache.fetchedAt.getTime() > ttl;
}

/**
 * Ensure the cache is fresh, refreshing if stale.
 * Does NOT throw on failure — silent fallback.
 */
async function ensureFreshRates() {
  if (isCacheStale()) {
    await fetchRates();
  }
}

/**
 * Get the exchange rate for a target currency (from INR).
 *
 * @param {string} targetCurrency  e.g. "USD", "AED", "GBP"
 * @returns {number} rate (INR → targetCurrency), or 1 if not found
 */
function getRate(targetCurrency) {
  if (!targetCurrency || targetCurrency === BASE_CURRENCY) return 1;
  const rate = rateCache.rates[targetCurrency.toUpperCase()];
  if (!rate) {
    console.warn(
      `[ExchangeRateService] Rate not found for ${targetCurrency} — returning 1 (no conversion)`
    );
    return 1;
  }
  return rate;
}

/**
 * Convert an INR amount to a target currency.
 *
 * @param {number} amountInr  Amount in INR
 * @param {string} toCurrency Target currency code
 * @param {number} [decimals=2] Decimal places to round to
 * @returns {number}
 */
function convertAmount(amountInr, toCurrency, decimals = 2) {
  const rate = getRate(toCurrency);
  return parseFloat((amountInr * rate).toFixed(decimals));
}

/**
 * Force-refresh rates immediately (used by admin endpoint and cron job).
 * @returns {Promise<void>}
 */
async function refreshRates() {
  await fetchRates();
}

/**
 * Get cache metadata (for health check / admin info endpoints).
 */
function getCacheInfo() {
  return {
    baseCurrency: BASE_CURRENCY,
    currencyCount: Object.keys(rateCache.rates).length,
    lastFetchedAt: rateCache.fetchedAt?.toISOString() || null,
    isStale: isCacheStale(),
  };
}

// Warm up on first import (fire-and-forget, does not block module load)
fetchRates().catch(() => {});

module.exports = {
  fetchRates,
  refreshRates,
  ensureFreshRates,
  getRate,
  convertAmount,
  getCacheInfo,
};
