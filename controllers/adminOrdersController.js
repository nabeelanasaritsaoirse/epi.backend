const adminOrdersService = require("../services/adminOrdersService");

exports.getCompletedOrders = async (req, res) => {
  const orders = await adminOrdersService.getCompletedOrders();
  res.json({ success: true, count: orders.length, orders });
};

exports.getOrdersCompletingSoon = async (req, res) => {
  const orders = await adminOrdersService.getOrdersCompletingSoon();
  res.json({ success: true, count: orders.length, orders });
};

exports.downloadShippingLabel = async (req, res) => {
  const label = await adminOrdersService.getShippingLabel(req.params.orderId);
  res.json({ success: true, label });
};
