package com.planbookai.backend.controller;

import com.planbookai.backend.dto.OrderDTO;
import com.planbookai.backend.dto.OrderRequest;
import com.planbookai.backend.model.entity.Order;
import com.planbookai.backend.model.entity.User;
import com.planbookai.backend.repository.OrderRepository;
import com.planbookai.backend.repository.SubscriptionPackageRepository;
import com.planbookai.backend.service.SubscriptionService;
import com.planbookai.backend.service.VNPayService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * VNPayController – xử lý 3 endpoint chính của luồng thanh toán VNPay.
 */
@RestController
@RequestMapping("/api/v1/payment/vnpay")
@Tag(name = "VNPay Payment", description = "Tich hợp thanh toán VNPay. Teacher tạo URL thanh toán, VNPay callback qua Return URL và IPN server-to-server.")
public class VNPayController {

    private final VNPayService vnPayService;
    private final SubscriptionService subscriptionService;
    private final OrderRepository orderRepository;
    private final SubscriptionPackageRepository packageRepository;

    @Value("${app.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    public VNPayController(VNPayService vnPayService,
                           SubscriptionService subscriptionService,
                           OrderRepository orderRepository,
                           SubscriptionPackageRepository packageRepository) {
        this.vnPayService          = vnPayService;
        this.subscriptionService   = subscriptionService;
        this.orderRepository       = orderRepository;
        this.packageRepository     = packageRepository;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 1. Tạo URL thanh toán
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Teacher gọi endpoint này để nhận link thanh toán VNPay.
     * Backend:
     *  - Tạo Order với status PENDING
     *  - Lưu vnpayTxnRef vào order
     *  - Trả về { paymentUrl } để FE redirect
     */
    @Operation(
        summary = "Tạo URL thanh toán VNPay",
        description = "Chỉ TEACHER. Tạo order PENDING và trả về {paymentUrl, orderId}. FE redirect đến paymentUrl để người dùng thanh toán trên cổng VNPay."
    )
    @PostMapping("/create-payment-url")
    @PreAuthorize("hasRole('TEACHER')")
    public ResponseEntity<Map<String, String>> createPaymentUrl(
            @RequestBody OrderRequest request,
            @AuthenticationPrincipal User user,
            HttpServletRequest httpRequest) {

        // Tạo đơn hàng PENDING
        OrderDTO orderDto = subscriptionService.createOrder(request, user);

        // Mã giao dịch: timestamp + orderId (chuẩn VNPay max 32 ký tự)
        String txnRef = System.currentTimeMillis() + "" + orderDto.getId();

        // Lưu txnRef vào order
        Order order = orderRepository.findById(orderDto.getId())
                .orElseThrow(() -> new RuntimeException("Order not found"));
        order.setVnpayTxnRef(txnRef);
        order.setPaymentMethod("VNPAY");
        orderRepository.save(order);

        // Sinh URL thanh toán
        long amountVnd = order.getAmountPaid().setScale(0, java.math.RoundingMode.HALF_UP).longValue();
        String orderInfo = "Thanh toan goi " + order.getSubscriptionPackage().getName();
        String clientIp  = getClientIp(httpRequest);

        String paymentUrl = vnPayService.createPaymentUrl(txnRef, amountVnd, orderInfo, clientIp);

        Map<String, String> result = new HashMap<>();
        result.put("paymentUrl", paymentUrl);
        result.put("orderId", String.valueOf(orderDto.getId()));
        return ResponseEntity.ok(result);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. Return URL (browser redirect sau khi thanh toán)
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * VNPay redirect trình duyệt về đây sau khi người dùng thanh toán.
     * Endpoint này KHÔNG phải là nguồn tin cậy duy nhất — chỉ dùng để
     * redirect FE sang trang kết quả. Logic kích hoạt subscription thực
     * hiện ở IPN bên dưới.
     */
    @Operation(
        summary = "VNPay Return URL (browser redirect)",
        description = "VNPay redirect trình duyệt về đây sau khi thanh toán xong. Verify chữ ký và redirect sang /payment/result trên frontend kèm kết quả."
    )
    @GetMapping("/return")
    public jakarta.servlet.http.HttpServletResponse handleReturn(
            @RequestParam Map<String, String> params,
            jakarta.servlet.http.HttpServletResponse response) throws Exception {

        boolean valid     = vnPayService.validateSignature(params);
        String  txnRef    = params.get("vnp_TxnRef");
        String  responseCode = params.getOrDefault("vnp_ResponseCode", "99");
        boolean success   = valid && "00".equals(responseCode);

        String packageName = "";
        String packageDuration = "";
        String amountDisplay = "";
        final String[] bankCodeRef = {params.getOrDefault("vnp_BankCode", "")};

        if (success) {
            // Cập nhật transaction no từ VNPay (phòng khi IPN chưa về kịp)
            orderRepository.findByVnpayTxnRef(txnRef).ifPresent(order -> {
                if (order.getStatus() == Order.OrderStatus.PENDING) {
                    order.setVnpayTransactionNo(params.get("vnp_TransactionNo"));
                    order.setVnpayBankCode(params.get("vnp_BankCode"));
                    order.setStatus(Order.OrderStatus.ACTIVE);
                    activateOrder(order);
                    orderRepository.save(order);
                }
            });
        }

        // Lấy thông tin gói từ order để hiển thị trên result page
        String pkgName = "";
        String pkgDuration = "";
        String paid = "";
        try {
            Order ord = orderRepository.findByVnpayTxnRef(txnRef).orElse(null);
            if (ord != null && ord.getSubscriptionPackage() != null) {
                pkgName = ord.getSubscriptionPackage().getName();
                pkgDuration = String.valueOf(ord.getSubscriptionPackage().getDurationDays());
                paid = ord.getAmountPaid().setScale(0, java.math.RoundingMode.HALF_UP).toPlainString();
            }
        } catch (Exception ignored) {}

        String redirectUrl = frontendUrl + "/payment/result"
                + "?success="  + success
                + "&orderId="  + txnRef
                + "&code="     + responseCode
                + "&pkgName="  + java.net.URLEncoder.encode(pkgName, java.nio.charset.StandardCharsets.UTF_8)
                + "&pkgDays="  + pkgDuration
                + "&amount="   + paid
                + "&bank="     + bankCodeRef[0];

        response.sendRedirect(redirectUrl);
        return response;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 3. IPN – Server-to-server notify (đây là nguồn tin cậy nhất)
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * VNPay gọi endpoint này từ phía server để xác nhận giao dịch.
     * Phải trả về {"RspCode":"00","Message":"Confirm Success"} trong vòng 5s.
     */
    @Operation(
        summary = "VNPay IPN (Server-to-Server callback)",
        description = "VNPay gọi endpoint này từ phía server sau khi thanh toán. Đầu nhất định, không phụ thuộc trình duyệt. Trả về {RspCode, Message} trong 5 giây."
    )
    @GetMapping("/ipn")
    public ResponseEntity<Map<String, String>> handleIpn(
            @RequestParam Map<String, String> params) {

        Map<String, String> rsp = new HashMap<>();

        boolean valid = vnPayService.validateSignature(params);
        if (!valid) {
            rsp.put("RspCode", "97");
            rsp.put("Message", "Invalid Checksum");
            return ResponseEntity.ok(rsp);
        }

        String txnRef      = params.get("vnp_TxnRef");
        String responseCode = params.getOrDefault("vnp_ResponseCode", "99");
        String vnpAmount    = params.get("vnp_Amount"); // VNPay gửi * 100

        Order order = orderRepository.findByVnpayTxnRef(txnRef).orElse(null);
        if (order == null) {
            rsp.put("RspCode", "01");
            rsp.put("Message", "Order Not Found");
            return ResponseEntity.ok(rsp);
        }

        if (order.getStatus() != Order.OrderStatus.PENDING) {
            rsp.put("RspCode", "02");
            rsp.put("Message", "Order Already Confirmed");
            return ResponseEntity.ok(rsp);
        }

        // Kiểm tra số tiền
        long expectedAmount = order.getAmountPaid()
                .setScale(0, java.math.RoundingMode.HALF_UP).longValue() * 100;
        if (vnpAmount != null && Long.parseLong(vnpAmount) != expectedAmount) {
            rsp.put("RspCode", "04");
            rsp.put("Message", "Invalid Amount");
            return ResponseEntity.ok(rsp);
        }

        if ("00".equals(responseCode)) {
            order.setVnpayTransactionNo(params.get("vnp_TransactionNo"));
            order.setVnpayBankCode(params.get("vnp_BankCode"));
            order.setStatus(Order.OrderStatus.ACTIVE);
            activateOrder(order);
        } else {
            order.setStatus(Order.OrderStatus.CANCELLED);
        }
        orderRepository.save(order);

        rsp.put("RspCode", "00");
        rsp.put("Message", "Confirm Success");
        return ResponseEntity.ok(rsp);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Set startedAt và expiresAt khi order chuyển sang ACTIVE */
    private void activateOrder(Order order) {
        if (order.getStartedAt() == null) {
            LocalDateTime now = LocalDateTime.now();
            order.setStartedAt(now);
            int days = order.getSubscriptionPackage().getDurationDays();
            order.setExpiresAt(now.plusDays(days));
        }
    }

    /** Lấy IP thực của client (hỗ trợ proxy/nginx) */
    private String getClientIp(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isBlank() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getRemoteAddr();
        }
        // X-Forwarded-For có thể chứa nhiều IP, lấy cái đầu tiên
        if (ip != null && ip.contains(",")) {
            ip = ip.split(",")[0].trim();
        }
        return ip != null ? ip : "127.0.0.1";
    }
}
