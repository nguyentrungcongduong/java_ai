package com.planbookai.backend.controller;

import com.planbookai.backend.dto.AuthResponse;
import com.planbookai.backend.dto.LoginRequest;
import com.planbookai.backend.dto.RefreshTokenRequest;
import com.planbookai.backend.dto.RegisterRequest;
import com.planbookai.backend.model.entity.User;
import com.planbookai.backend.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;

@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Authentication", description = "Đăng ký, đăng nhập, refresh token và quản lý phiên người dùng")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @Operation(summary = "Đăng ký tài khoản mới", description = "Tạo tài khoản Teacher mới. Mặc định role=TEACHER. Email phải chưa tồn tại trong hệ thống.")
    @PostMapping("/register")
    public AuthResponse register(@RequestBody RegisterRequest request) {
        return authService.register(request);
    }

    @Operation(summary = "Đăng nhập", description = "Xác thực email/password. Trả về accessToken và refreshToken. Lưu accessToken vào Authorization header cho các request tiếp theo.")
    @PostMapping("/login")
    public AuthResponse login(@RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @Operation(summary = "Làm mới access token", description = "Dùng refreshToken để lấy accessToken mới khi accessToken hết hạn (401).")
    @PostMapping("/refresh")
    public AuthResponse refresh(@RequestBody RefreshTokenRequest request) {
        return authService.refreshToken(request);
    }

    @Operation(summary = "Đăng xuất", description = "Xóa SecurityContext phía server. Client cần tự xóa token khỏi localStorage/sessionStorage.")
    @PostMapping("/logout")
    public ResponseEntity<String> logout() {
        SecurityContextHolder.clearContext();
        return ResponseEntity.ok("Logout successful. Please clear your tokens on the client-side.");
    }

    @Operation(summary = "Lấy thông tin người dùng hiện tại", description = "Trả về profile của người dùng đang đăng nhập dựa trên JWT token. Yêu cầu Bearer token hợp lệ.")
    @GetMapping("/me")
    public ResponseEntity<AuthResponse.UserDTO> getCurrentUser(@AuthenticationPrincipal User user) {
        // @AuthenticationPrincipal sẽ tự động inject đối tượng User từ SecurityContext
        if (user == null) {
            // Trả về 401 Unauthorized nếu không có user nào được xác thực
            return ResponseEntity.status(401).build();
        }
        // Xây dựng DTO để chỉ trả về thông tin cần thiết
        AuthResponse.UserDTO userDTO = AuthResponse.UserDTO.builder()
                .id(user.getId())
                .fullName(user.getFullName())
                .email(user.getEmail())
                .role(user.getRole() != null ? user.getRole().getName().name() : null)
                .isActive(user.getIsActive())
                .build();
        return ResponseEntity.ok(userDTO);
    }
}