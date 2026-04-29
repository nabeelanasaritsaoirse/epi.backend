const InstallmentOrder = require("../models/InstallmentOrder");

exports.getCompletedOrders = async (page = 1, limit = 10, fromDate, toDate) => {
  const skip = (page - 1) * limit;

  const query = { status: "COMPLETED" };

  if (fromDate || toDate) {
    query.completedAt = {};
    if (fromDate) {
      const f = new Date(fromDate);
      f.setHours(0, 0, 0, 0);
      query.completedAt.$gte = f;
    }
    if (toDate) {
      const t = new Date(toDate);
      t.setHours(23, 59, 59, 999);
      query.completedAt.$lte = t;
    }
  }

  const [orders, total] = await Promise.all([
    InstallmentOrder.find(query)
      .populate("user", "name phoneNumber")
      .populate("product", "name")
      .sort({ completedAt: -1 })
      .skip(skip)
      .limit(limit),

    InstallmentOrder.countDocuments(query)
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

exports.getOrdersCompletingSoon = async (page = 1, limit = 10, fromDate, toDate) => {
  const now = new Date();
  
  // Default 'completing soon' logic: next 3 days
  const defaultFutureDate = new Date();
  defaultFutureDate.setDate(now.getDate() + 3);

  const query = {
    status: "ACTIVE",
    "paymentSchedule.status": "PENDING"
  };

  const activeOrders = await InstallmentOrder.find(query)
    .populate("user", "name phoneNumber")
    .populate("product", "name");

  const filtered = [];

  for (const order of activeOrders) {
    const pending = order.paymentSchedule.filter(i => i.status === "PENDING");
    if (!pending.length) continue;

    const lastPending = pending[pending.length - 1];

    // Apply date filter if provided, otherwise use default 3-day logic
    if (fromDate || toDate) {
      const dueDate = new Date(lastPending.dueDate);
      let match = true;
      if (fromDate) {
        const f = new Date(fromDate);
        f.setHours(0, 0, 0, 0);
        if (dueDate < f) match = false;
      }
      if (toDate) {
        const t = new Date(toDate);
        t.setHours(23, 59, 59, 999);
        if (dueDate > t) match = false;
      }
      
      if (!match) continue;
    } else {
      // Default logic: completing within next 3 days
      if (lastPending.dueDate > defaultFutureDate) continue;
    }

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
