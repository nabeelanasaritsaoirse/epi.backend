const adminOrdersService = require("../services/adminOrdersService")

exports.getCompletedOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, fromDate, toDate } = req.query;

    const result = await adminOrdersService.getCompletedOrders(
      parseInt(page),
      parseInt(limit),
      fromDate,
      toDate
    );

    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    console.error("Completed Orders Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getOrdersCompletingSoon = async (req, res) => {
  try {
    const { page = 1, limit = 10, fromDate, toDate } = req.query;

    const result = await adminOrdersService.getOrdersCompletingSoon(
      parseInt(page),
      parseInt(limit),
      fromDate,
      toDate
    );

    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    console.error("Completing Soon Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.downloadShippingLabel = async (req, res) => {
  try {
    const label = await adminOrdersService.getShippingLabel(req.params.orderId);

    res.json({ success: true, label });
  } catch (err) {
    console.error("Shipping Label Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
