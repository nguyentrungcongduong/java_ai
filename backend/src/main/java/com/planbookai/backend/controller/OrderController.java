package com.planbookai.backend.controller;

import com.planbookai.backend.dto.OrderDTO;
import com.planbookai.backend.dto.OrderRequest;
import com.planbookai.backend.model.entity.User;
import com.planbookai.backend.service.SubscriptionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/orders")
@Tag(name = "Orders", description = "Quản lý đơn hàng mua gói subscription. Teacher tạo đơn, Manager/Admin duyệt.")
public class OrderController {

    private final SubscriptionService subscriptionService;

    public OrderController(SubscriptionService subscriptionService) {
        this.subscriptionService = subscriptionService;
    }

    @Operation(summary = "Lấy tất cả đơn hàng", description = "Chỉ MANAGER và ADMIN. Trả về danh sách tất cả orders trong hệ thống.")
    @GetMapping
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN')")
    public ResponseEntity<List<OrderDTO>> getAllOrders() {
        return ResponseEntity.ok(subscriptionService.getAllOrders());
    }

    @Operation(summary = "Cập nhật trạng thái đơn hàng", description = "Chỉ MANAGER và ADMIN. Body: {\"status\": \"ACTIVE\"} hoặc {\"status\": \"CANCELLED\"}.")
    @PutMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN')")
    public ResponseEntity<OrderDTO> updateOrderStatus(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        String status = body.get("status");
        return ResponseEntity.ok(subscriptionService.updateOrderStatus(id, status));
    }

    @Operation(summary = "Tạo đơn hàng mua gói", description = "Chỉ TEACHER. Tạo order mới với status PENDING. Thanh toán qua VNPay hoặc đợi Manager duyệt thủ công.")
    @PostMapping
    @PreAuthorize("hasRole('TEACHER')")
    public ResponseEntity<OrderDTO> createOrder(
            @RequestBody OrderRequest request,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(subscriptionService.createOrder(request, user));
    }

    @Operation(summary = "Xem đơn hàng của tôi", description = "Chỉ TEACHER. Trả về lịch sử các đơn hàng mà Teacher hiện tại đã tạo.")
    @GetMapping("/my")
    @PreAuthorize("hasRole('TEACHER')")
    public ResponseEntity<List<OrderDTO>> getMyOrders(
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(subscriptionService.getMyOrders(user));
    }
}
