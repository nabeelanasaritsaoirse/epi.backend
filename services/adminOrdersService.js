const InstallmentOrder = require("../models/InstallmentOrder");

exports.getCompletedOrders = async (page = 1, limit = 10) => {
  const skip = (page - 1) * limit;

  const [orders, total] = await Promise.all([
    InstallmentOrder.find({ status: "COMPLETED" })
      .populate("user", "name phoneNumber")
      .populate("product", "name")
      .sort({ completedAt: -1 })
      .skip(skip)
      .limit(limit),

    InstallmentOrder.countDocuments({ status: "COMPLETED" })
  ]);

  return {
    orders,
    pagination: {
      totalRecords: total,
      totalPages: Math.ceil(total / limit),
      currentPage: page
    }
  };
};

exports.getOrdersCompletingSoon = async (page = 1, limit = 10) => {
  const now = new Date();
  const threeDays = new Date();
  threeDays.setDate(now.getDate() + 3);

  const activeOrders = await InstallmentOrder.find({
    status: "ACTIVE",
    "paymentSchedule.status": "PENDING"
  })
    .populate("user", "name phoneNumber")
    .populate("product", "name");

  const filtered = [];

  for (const order of activeOrders) {
    const pending = order.paymentSchedule.filter(i => i.status === "PENDING");
    if (!pending.length) continue;

    const lastPending = pending[pending.length - 1];

    if (lastPending.dueDate <= threeDays) {
      filtered.push({
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

  const total = filtered.length;
  const start = (page - 1) * limit;
  const paginated = filtered.slice(start, start + limit);

  return {
    orders: paginated,
    pagination: {
      totalRecords: total,
      totalPages: Math.ceil(total / limit),
      currentPage: page
    }
  };
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
