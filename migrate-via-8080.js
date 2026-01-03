const axios = require("axios");

/* =====================
   CONFIG
===================== */
const DEV_BASE = "http://13.127.15.87:8080/api";
const PROD_BASE = "https://api.epielio.com/api";

const ADMIN_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTJlODM0NjcxODgxOTM5NjhkNWIyNzIiLCJyb2xlIjoic3VwZXJfYWRtaW4iLCJpYXQiOjE3NjczNDk3NTYsImV4cCI6MTc2Nzk1NDU1Nn0.lIOQai1Ir7SqMOBa6QXvTWKY00j3U4DVS3CV0FHZUNI";

/* =====================
   AXIOS CLIENTS
===================== */
const devApi = axios.create({
  baseURL: DEV_BASE,
  headers: {
    Authorization: `Bearer ${ADMIN_TOKEN}`,
    "Content-Type": "application/json",
  },
});

const prodApi = axios.create({
  baseURL: PROD_BASE,
  headers: {
    Authorization: `Bearer ${ADMIN_TOKEN}`,
  },
});

/* =====================
   RUN
===================== */
async function run() {
  console.log("🚀 SUB-CATEGORY MIGRATION VIA 8080 STARTED");

  // 1️⃣ Load DEV categories
  const devCatRes = await devApi.get("/categories?isActive=all");
  const devCategories = devCatRes.data.data || [];

  const devCategoryMap = {};
  devCategories.forEach((c) => {
    devCategoryMap[c.categoryId] = c._id;
  });

  console.log(`📁 Loaded ${devCategories.length} DEV categories`);

  // 2️⃣ Load PROD categories
  const prodCatRes = await prodApi.get("/categories?isActive=all");
  const prodCategories = prodCatRes.data.data || [];

  for (const cat of prodCategories) {
    // Only sub-categories
    if (!cat.parentCategoryId) continue;

    const devParentId = devCategoryMap[cat.parentCategoryId];
    if (!devParentId) {
      console.log(`⚠ Parent missing in DEV: ${cat.name}`);
      continue;
    }

    try {
      await devApi.post("/categories", {
        name: cat.name,
        description: cat.description,
        parentCategoryId: devParentId,
        image: cat.image,
        meta: cat.meta,
        displayOrder: cat.displayOrder || 0,
        isFeatured: cat.isFeatured || false,
      });

      console.log(`✔ Sub-category created: ${cat.name}`);
    } catch (err) {
      console.log(`↺ Sub-category exists: ${cat.name}`);
    }
  }

  console.log("✅ SUB-CATEGORY MIGRATION COMPLETED");
}

run().catch((err) => {
  console.error("❌ SUB-CATEGORY MIGRATION FAILED");
  console.error(err.response?.data || err.message);
});
