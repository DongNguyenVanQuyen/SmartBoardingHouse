//src/controllers/debtController.js
const Invoice = require("../models/Invoice");
const { success, error: sendError } = require("../utils/response");

// GET /debts
const getDebts = async (req, res) => {
  try {
    const today = new Date();

    const allUnpaid = await Invoice.find({
      tenant: req.user._id,
      status: { $in: ["unpaid", "partial", "overdue"] },
    }).populate("room", "roomNumber");

    // Phân loại n�?quá hạn và chưa đến hạn
    const overdue = [];
    const pending = [];

    for (const inv of allUnpaid) {
      // Cập nhật trạng thái overdue
      if (inv.dueDate < today && inv.status !== "paid") {
        if (inv.status !== "overdue") {
          inv.status = "overdue";
          await inv.save();
        }
        overdue.push(inv);
      } else {
        pending.push(inv);
      }
    }

    const paid = await Invoice.find({
      tenant: req.user._id,
      status: "paid",
    })
      .sort({ updatedAt: -1 })
      .limit(10)
      .populate("room", "roomNumber");

    const totalDebt = allUnpaid.reduce(
      (sum, inv) => sum + (inv.totalAmount - inv.paidAmount),
      0,
    );
    const overdueDebt = overdue.reduce(
      (sum, inv) => sum + (inv.totalAmount - inv.paidAmount),
      0,
    );

    return success(
      res,
      {
        summary: {
          totalDebt,
          overdueDebt,
          pendingDebt: totalDebt - overdueDebt,
        },
        overdue,
        pending,
        recentPaid: paid,
      },
      "Lấy thông tin công n�?thành công",
    );
  } catch (err) {
    return sendError(res, err.message);
  }
};

module.exports = { getDebts };

