const InstallmentOrder = require("../models/InstallmentOrder");

exports.getCompletedOrders = async () => {
  return InstallmentOrder.find({ status: "COMPLETED" })
    .populate("user", "name phoneNumber")
    .populate("product", "name")
    .sort({ completedAt: -1 });
};

exports.getOrdersCompletingSoon = async () => {
  const now = new Date();
  const threeDays = new Date();
  threeDays.setDate(now.getDate() + 3);

  const activeOrders = await InstallmentOrder.find({
    status: "ACTIVE",
    "paymentSchedule.status": "PENDING"
  })
    .populate("user", "name phoneNumber")
    .populate("product", "name");

  const result = [];

  for (const order of activeOrders) {
    const pending = order.paymentSchedule.filter(i => i.status === "PENDING");
    if (!pending.length) continue;

    const lastPending = pending[pending.length - 1];

    if (lastPending.dueDate <= threeDays) {
      result.push({
        orderId: order.orderId,
        user: order.user,
        productName: order.productName,
        remainingInstallments: pending.length,
        lastDueDate: lastPending.dueDate,
        remainingAmount: order.remainingAmount,
        deliveryAddress: order.deliveryAddress
      });
    }
  }

  return result;
};

exports.getShippingLabel = async (orderId) => {
  const order = await InstallmentOrder.findOne({ orderId })
    .populate("user", "name phoneNumber");

  if (!order) throw new Error("Order not found");

  return {
    orderId: order.orderId,
    name: order.deliveryAddress.name,
    phone: order.deliveryAddress.phoneNumber,
    productName: order.productName,
    address: `
${order.deliveryAddress.addressLine1},
${order.deliveryAddress.addressLine2},
${order.deliveryAddress.city}, ${order.deliveryAddress.state} - ${order.deliveryAddress.pincode}
    `,
    amountPaid: order.totalPaidAmount,
    remainingAmount: order.remainingAmount
  };
};
