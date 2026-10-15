const crypto = require("crypto");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const ServicePackage = require("../models/ServicePackage");

/* =========================================================
 * HELPER: Tạo chữ ký HMAC-SHA512 theo chuẩn chính thức của VNPay
 * ========================================================= */
function sortObject(obj) {
  const sorted = {};
  const str = [];
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      str.push(encodeURIComponent(key));
    }
  }
  str.sort();
  for (let key = 0; key < str.length; key++) {
    sorted[str[key]] = encodeURIComponent(obj[str[key]] ?? "").replace(/%20/g, "+");
  }
  return sorted;
}

function buildSignData(sortedObj) {
  return Object.entries(sortedObj)
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
}

function createHmacSha512(secret, data) {
  return crypto.createHmac("sha512", secret).update(data, "utf-8").digest("hex");
}

/**
 * Định dạng ngày giờ GMT+7 theo chuẩn VNPay: yyyyMMddHHmmss
 */
function getVnpayDateFormat(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  const tzOffset = 7 * 60; // Vietnam GMT+7 in minutes
  const vnTime = new Date(date.getTime() + (tzOffset + date.getTimezoneOffset()) * 60000);
  return (
    vnTime.getFullYear() +
    pad(vnTime.getMonth() + 1) +
    pad(vnTime.getDate()) +
    pad(vnTime.getHours()) +
    pad(vnTime.getMinutes()) +
    pad(vnTime.getSeconds())
  );
}

/* =========================================================
 * POST /api/payment/create-payment-url
 * Tạo URL thanh toán VNPay Sandbox
 * Yêu cầu: protect middleware (req.user.id)
 * ========================================================= */
const createPaymentUrl = async (req, res) => {
  try {
    const userId = req.user.id;
    let ipAddr =
      req.headers["x-forwarded-for"] ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      "127.0.0.1";

    if (typeof ipAddr === "string") {
      if (ipAddr.includes(",")) {
        ipAddr = ipAddr.split(",")[0].trim();
      }
      if (ipAddr === "::1" || ipAddr === "::ffff:127.0.0.1") {
        ipAddr = "127.0.0.1";
      }
    }

    const tmnCode = process.env.VNP_TMN_CODE;
    const secretKey = process.env.VNP_HASH_SECRET;
    const vnpUrl = process.env.VNP_URL;
    const returnUrl = process.env.VNP_RETURN_URL;
    let amount = parseInt(process.env.VNP_PRO_AMOUNT || "99000", 10);
    let orderInfoText = `Nang_cap_Pro_30_ngay_${userId}`;

    let pkgCode = "PRO_1M";
    let pkgDays = 30;

    const { packageCode } = req.body;
    if (packageCode) {
      const selectedPkg = await ServicePackage.findOne({
        code: String(packageCode).trim().toUpperCase(),
        isActive: true,
      });
      if (selectedPkg) {
        amount = selectedPkg.amount;
        pkgCode = selectedPkg.code;
        pkgDays = selectedPkg.days || 30;
        orderInfoText = `Nang_cap_${selectedPkg.code}_${selectedPkg.days}d_${userId}`;
      }
    }

    // Tạo orderId duy nhất: userId_timestamp
    const orderId = `${userId.toString().slice(-6)}_${Date.now()}`;

    // Lưu transaction với trạng thái PENDING
    await Transaction.create({
      userId,
      orderId,
      amount,
      packageCode: pkgCode,
      days: pkgDays,
      status: "PENDING",
    });

    // Build VNPay params (thời gian chuẩn GMT+7)
    const createDate = getVnpayDateFormat();

    const vnpParams = {
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode: tmnCode,
      vnp_Locale: "vn",
      vnp_CurrCode: "VND",
      vnp_TxnRef: orderId,
      vnp_OrderInfo: orderInfoText,
      vnp_OrderType: "other",
      vnp_Amount: amount * 100, // VNPay nhận đơn vị x100
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr: ipAddr,
      vnp_CreateDate: createDate,
    };

    const sortedParams = sortObject(vnpParams);
    const signData = buildSignData(sortedParams);
    const secureHash = createHmacSha512(secretKey, signData);

    const paymentUrl = `${vnpUrl}?${signData}&vnp_SecureHash=${secureHash}`;

    return res.status(200).json({
      success: true,
      data: { paymentUrl, orderId },
    });
  } catch (error) {
    console.error("[Payment] createPaymentUrl error:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể tạo URL thanh toán. Vui lòng thử lại.",
    });
  }
};

/* =========================================================
 * GET /api/payment/vnpay-return
 * VNPay redirect về sau khi thanh toán (người dùng thấy)
 * ========================================================= */
const vnpayReturn = async (req, res) => {
  try {
    const vnpParams = { ...req.query };
    const secureHash = vnpParams["vnp_SecureHash"];
    delete vnpParams["vnp_SecureHash"];
    delete vnpParams["vnp_SecureHashType"];

    const secretKey = process.env.VNP_HASH_SECRET;
    const sortedParams = sortObject(vnpParams);
    const signData = buildSignData(sortedParams);
    const calcHash = createHmacSha512(secretKey, signData);

    if (!secureHash || calcHash.toLowerCase() !== secureHash.toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: "Chữ ký không hợp lệ.",
        code: "INVALID_SIGNATURE",
      });
    }

    const responseCode = vnpParams["vnp_ResponseCode"];
    const orderId = vnpParams["vnp_TxnRef"];
    const vnpayTransactionNo = vnpParams["vnp_TransactionNo"] || "";
    const bankCode = vnpParams["vnp_BankCode"] || "";

    const transaction = await Transaction.findOne({ orderId });
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy giao dịch.",
        code: "NOT_FOUND",
      });
    }

    if (transaction.status !== "PENDING") {
      // Đã xử lý trước đó (idempotent)
      return res.status(200).json({
        success: transaction.status === "SUCCESS",
        message:
          transaction.status === "SUCCESS"
            ? "Giao dịch đã được xử lý thành công trước đó."
            : "Giao dịch thất bại.",
        code: transaction.status,
        data: { orderId, status: transaction.status },
      });
    }

    if (responseCode === "00") {
      // Thanh toán thành công
      transaction.status = "SUCCESS";
      transaction.vnpayTransactionNo = vnpayTransactionNo;
      transaction.vnpayResponseCode = responseCode;
      transaction.bankCode = bankCode;
      await transaction.save();

      // Nâng cấp user lên Pro theo số ngày của gói đã mua (cộng dồn nếu đang còn hạn)
      const proDays = Number(transaction.days) || parseInt(process.env.VNP_PRO_DAYS || "30", 10);
      const userDoc = await User.findById(transaction.userId);
      const baseDate =
        userDoc?.isPro && userDoc?.proExpiresAt && new Date(userDoc.proExpiresAt) > new Date()
          ? new Date(userDoc.proExpiresAt)
          : new Date();

      const proExpiresAt = new Date(baseDate.getTime() + proDays * 24 * 60 * 60 * 1000);

      await User.findByIdAndUpdate(transaction.userId, {
        isPro: true,
        proExpiresAt,
        title: "VIP",
      });

      return res.status(200).json({
        success: true,
        message: "Thanh toán thành công! Tài khoản đã được nâng cấp lên Pro.",
        code: "SUCCESS",
        data: {
          orderId,
          status: "SUCCESS",
          proExpiresAt,
        },
      });
    } else {
      // Thanh toán thất bại
      transaction.status = "FAILED";
      transaction.vnpayResponseCode = responseCode;
      await transaction.save();

      return res.status(200).json({
        success: false,
        message: "Thanh toán không thành công.",
        code: "FAILED",
        data: { orderId, status: "FAILED", responseCode },
      });
    }
  } catch (error) {
    console.error("[Payment] vnpayReturn error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi xử lý callback thanh toán.",
    });
  }
};

/* =========================================================
 * GET /api/payment/pro-status
 * Lấy trạng thái Pro của user hiện tại
 * ========================================================= */
const getProStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "isPro proExpiresAt title name"
    );

    if (!user) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng." });
    }

    // Tự động thu hồi Pro nếu hết hạn
    if (user.isPro && user.proExpiresAt && new Date() > user.proExpiresAt) {
      user.isPro = false;
      user.title = "Học viên";
      await user.save();
    }

    return res.status(200).json({
      success: true,
      data: {
        isPro: user.isPro,
        proExpiresAt: user.proExpiresAt,
        title: user.title,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi server." });
  }
};

/**
 * GET /api/payment/packages
 * Lấy danh sách gói dịch vụ Pro/VIP đang hoạt động cho người dùng
 */
const getActivePackages = async (req, res) => {
  try {
    const packages = await ServicePackage.find({ isActive: true }).sort({
      order: 1,
      createdAt: -1,
    });
    return res.status(200).json({
      success: true,
      data: { packages },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi server." });
  }
};

module.exports = { createPaymentUrl, vnpayReturn, getProStatus, getActivePackages };
