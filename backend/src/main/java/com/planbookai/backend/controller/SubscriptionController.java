package com.planbookai.backend.controller;

import com.planbookai.backend.dto.PackageDTO;
import com.planbookai.backend.dto.PackageRequest;
import com.planbookai.backend.model.entity.User;
import com.planbookai.backend.service.SubscriptionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/packages")
@Tag(name = "Subscription Packages", description = "Quản lý các gói subscription. Ai cũng có thể xem, MANAGER/ADMIN mới có thể tạo/sửa/xóa.")
public class SubscriptionController {

    private final SubscriptionService subscriptionService;

    public SubscriptionController(SubscriptionService subscriptionService) {
        this.subscriptionService = subscriptionService;
    }

    @Operation(summary = "Lấy tất cả gói subscription", description = "Public endpoint. Trả về danh sách các gói đang hoạt động để Teacher lựa chọn mua.")
    @GetMapping
    public ResponseEntity<List<PackageDTO>> getAllPackages() {
        return ResponseEntity.ok(subscriptionService.getAllPackages());
    }

    @Operation(summary = "Tạo gói subscription mới", description = "Chỉ MANAGER và ADMIN. Định nghĩa tên, giá, thời hạn (days) và giới hạn tính năng của gói.")
    @PostMapping
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN')")
    public ResponseEntity<PackageDTO> createPackage(
            @RequestBody PackageRequest request,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(subscriptionService.createPackage(request, user));
    }

    @Operation(summary = "Cập nhật gói subscription", description = "Chỉ MANAGER và ADMIN.")
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN')")
    public ResponseEntity<PackageDTO> updatePackage(
            @PathVariable Integer id,
            @RequestBody PackageRequest request) {
        return ResponseEntity.ok(subscriptionService.updatePackage(id, request));
    }

    @Operation(summary = "Xóa gói subscription", description = "Chỉ MANAGER và ADMIN. Xóa cứng (hard delete).")
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN')")
    public ResponseEntity<Void> deletePackage(@PathVariable Integer id) {
        subscriptionService.deletePackage(id);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Vô hiệu hóa gói subscription", description = "Chỉ MANAGER và ADMIN. Ẩn gói khỏi danh sách công khai nhưng không xóa. Teacher đang dùng gói này vẫn không bị ảnh hưởng.")
    @PutMapping("/{id}/deactivate")
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN')")
    public ResponseEntity<PackageDTO> deactivatePackage(@PathVariable Integer id) {
        return ResponseEntity.ok(subscriptionService.deactivatePackage(id));
    }
}
