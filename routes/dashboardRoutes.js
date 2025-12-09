const express = require("express");
const router = express.Router();
const { isAdmin, verifyToken } = require("../middlewares/auth");
const { getDashboardStats } = require("../controllers/dashboardController");

router.get("/dashboard-stats", verifyToken, isAdmin, getDashboardStats);

module.exports = router;
