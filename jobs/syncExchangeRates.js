/**
 * Exchange Rate Sync Cron Job
 *
 * Refreshes the in-memory exchange rate cache every hour and
 * (optionally) recalculates non-overridden regional prices for
 * all global products.
 *
 * Schedule: every hour at minute 0  →  "0 * * * *"
 *
 * Registration: call startExchangeRateSyncJob() once at server startup
 * (see index.js).
 */

const cron = require("node-cron");
const ExchangeRateService = require("../services/exchangeRateService");

// Lazy-load Product to avoid circular dependency issues at startup
function getProductModel() {
  return require("../models/Product");
}

/**
 * Recalculate regional prices for products whose isManualOverride === false.
 * Runs after each successful rate refresh.
 */
async function syncProductRegionalPrices() {
  const Product = getProductModel();

  try {
    // Only process global products with at least one non-overridden regional price
    const products = await Product.find({
      isDeleted: false,
      isGlobalProduct: false,
      "regionalPricing.isManualOverride": false,
    }).select("pricing regionalPricing");

    if (products.length === 0) return;

    let updatedCount = 0;

    for (const product of products) {
      let dirty = false;

      product.regionalPricing.forEach((rp) => {
        if (rp.isManualOverride) return; // skip pinned prices

        const baseRegular = product.pricing?.regularPrice || 0;
        const baseSale = product.pricing?.salePrice || 0;

        const newRegular = ExchangeRateService.convertAmount(
          baseRegular,
          rp.currency
        );
        const newSale = baseSale
          ? ExchangeRateService.convertAmount(baseSale, rp.currency)
          : null;

        rp.regularPrice = newRegular;
        if (newSale !== null) rp.salePrice = newSale;
        rp.finalPrice = newSale || newRegular;
        rp.lastSyncedAt = new Date();
        dirty = true;
      });

      if (dirty) {
        await product.save();
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      console.log(
        `[syncExchangeRates] Updated regional prices for ${updatedCount} product(s)`
      );
    }
  } catch (err) {
    console.error("[syncExchangeRates] Price sync error:", err.message);
  }
}

/**
 * Start the hourly exchange rate sync cron job.
 * Call once at server startup.
 */
function startExchangeRateSyncJob() {
  // Every hour at minute 0
  cron.schedule("0 * * * *", async () => {
    console.log("[syncExchangeRates] Refreshing exchange rates…");
    try {
      await ExchangeRateService.refreshRates();
      await syncProductRegionalPrices();
    } catch (err) {
      console.error("[syncExchangeRates] Job error:", err.message);
    }
  });

  console.log(
    "[syncExchangeRates] Hourly exchange rate sync job registered (runs at :00 every hour)"
  );
}

module.exports = { startExchangeRateSyncJob, syncProductRegionalPrices };
