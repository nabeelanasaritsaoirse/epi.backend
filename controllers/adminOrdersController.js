const adminOrdersService = require("../services/adminOrdersService")

exports.getCompletedOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const result = await adminOrdersService.getCompletedOrders(page, limit);

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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const result = await adminOrdersService.getOrdersCompletingSoon(page, limit);

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
