package com.planbookai.backend.controller;

import com.planbookai.backend.dto.ErrorResponse;
import com.planbookai.backend.dto.ProfileResponse;
import com.planbookai.backend.dto.ProfileUpdateRequest;
import com.planbookai.backend.dto.RoleAssignRequest;
import com.planbookai.backend.dto.UserRequest;
import com.planbookai.backend.dto.UserResponse;
import com.planbookai.backend.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/v1/users")
@Tag(name = "Users", description = "Quản lý người dùng. ADMIN/MANAGER xem danh sách và quản lý. Mọi user đã đăng nhập xem và sửa profile của chính mình.")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @Operation(summary = "Lấy danh sách tất cả users", description = "Chỉ ADMIN và MANAGER. Trả về thông tin tất cả tài khoản trong hệ thống.")
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<?> getAll() {
        try {
            List<UserResponse> users = userService.findAll();
            return ResponseEntity.ok(users);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("Failed to fetch users: " + e.getMessage()));
        }
    }

    @Operation(summary = "Xem profile cá nhân", description = "Bất kỳ user đã đăng nhập. Trả về thông tin chi tiết của user hiện tại.")
    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getMe() {
        Optional<ProfileResponse> me = userService.findCurrentUserProfile();
        return me.<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(new ErrorResponse("Current user profile not found")));
    }

    @Operation(summary = "Cập nhật profile cá nhân", description = "Bất kỳ user đã đăng nhập. Chỉ cập nhật được fullName và thông tin cá nhân, không thể thay đổi role hay email.")
    @PutMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> updateMe(@Valid @RequestBody ProfileUpdateRequest req) {
        try {
            Optional<ProfileResponse> updated = userService.updateCurrentUserProfile(req);
            return updated.<ResponseEntity<?>>map(ResponseEntity::ok)
                    .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                            .body(new ErrorResponse("Current user profile not found")));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("Failed to update profile: " + e.getMessage()));
        }
    }

    @Operation(summary = "Lấy thông tin user theo ID", description = "Trả về chi tiết một user cụ thể.")
    @GetMapping("/{id}")
    public ResponseEntity<?> getById(@PathVariable Long id) {
        Optional<UserResponse> userOpt = userService.findById(id);
        return userOpt.<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(new ErrorResponse("User not found with ID: " + id)));
    }

    @Operation(summary = "Tạo user mới (Admin)", description = "Tạo tài khoản mới với role tùy chỉnh. Dùng cho Admin tạo tài khoản Staff/Manager.")
    @PostMapping
    public ResponseEntity<?> create(@Valid @RequestBody UserRequest user) {
        try {
            UserResponse created = userService.create(user);
            return ResponseEntity.status(HttpStatus.CREATED).body(created);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse(e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("Failed to create user: " + e.getMessage()));
        }
    }

    @Operation(summary = "Cập nhật thông tin user (Admin)", description = "Admin cập nhật thông tin bất kỳ user nào.")
    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @Valid @RequestBody UserRequest user) {
        try {
            Optional<UserResponse> updated = userService.update(id, user);
            return updated.<ResponseEntity<?>>map(ResponseEntity::ok)
                    .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                            .body(new ErrorResponse("User not found with ID: " + id)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse(e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("Failed to update user: " + e.getMessage()));
        }
    }

    @Operation(summary = "Gán role cho user", description = "Chỉ ADMIN. Thay đổi role của một user. Body: {\"roleId\": 2}")
    @PutMapping("/{id}/role")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> assignRole(@PathVariable Long id, @Valid @RequestBody RoleAssignRequest req) {
        try {
            Optional<UserResponse> updated = userService.assignRole(id, req.getRoleId());
            return updated.<ResponseEntity<?>>map(ResponseEntity::ok)
                    .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                            .body(new ErrorResponse("User not found with ID: " + id)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse(e.getMessage()));
        }
    }

    @Operation(summary = "Xóa user", description = "Chỉ ADMIN. Xóa tài khoản người dùng khỏi hệ thống.")
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        boolean deleted = userService.delete(id);
        if (deleted) {
            return ResponseEntity.ok(new ErrorResponse("User deleted successfully with ID: " + id));
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ErrorResponse("User not found with ID: " + id));
    }
}
