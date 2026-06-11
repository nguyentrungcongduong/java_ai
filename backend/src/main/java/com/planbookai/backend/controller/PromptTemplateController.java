package com.planbookai.backend.controller;

import com.planbookai.backend.dto.ErrorResponse;
import com.planbookai.backend.dto.PromptTemplateDTO;
import com.planbookai.backend.dto.PromptTemplateRequest;
import com.planbookai.backend.model.entity.Role;
import com.planbookai.backend.model.entity.User;
import com.planbookai.backend.service.AiPromptTemplateService;
import com.planbookai.backend.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;

import java.util.Map;
import java.util.List;

@RestController
@RequestMapping("/api/v1/prompt-templates")
@Tag(name = "Prompt Templates", description = "Quản lý mẫu prompt AI. Staff tạo, Manager duyệt, Teacher sử dụng khi sinh giáo án và câu hỏi.")
public class PromptTemplateController {

    private final AiPromptTemplateService aiPromptTemplateService;
    private final AuthService authService;

    public PromptTemplateController(AiPromptTemplateService aiPromptTemplateService, AuthService authService) {
        this.aiPromptTemplateService = aiPromptTemplateService;
        this.authService = authService;
    }


    @Operation(
        summary = "Lấy danh sách Prompt Templates",
        description = "ADMIN/MANAGER/STAFF thấy tất cả template. TEACHER chỉ thấy template đã APPROVED. Có thể lọc theo purpose: LESSON_PLAN_GEN hoặc QUESTION_GEN."
    )
    @GetMapping
    @PreAuthorize("hasAnyRole('TEACHER', 'STAFF', 'MANAGER', 'ADMIN')")
    public ResponseEntity<List<PromptTemplateDTO>> getTemplates(
            @Parameter(description = "Lọc theo mục đích sử dụng: LESSON_PLAN_GEN | QUESTION_GEN")
            @RequestParam(required = false) String purpose,
            Authentication authentication) {
        
        // Kiểm tra quyền hạn dựa trên Authorities của SecurityContext
        boolean canSeeAll = authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(role -> role.equals("ROLE_ADMIN") || 
                                 role.equals("ROLE_MANAGER") || 
                                 role.equals("ROLE_STAFF"));

        List<PromptTemplateDTO> templates = canSeeAll 
                ? aiPromptTemplateService.getTemplatesByPurpose(purpose, false) 
                : aiPromptTemplateService.getTemplatesByPurpose(purpose, true);
                
        return ResponseEntity.ok(templates);
    }

    @Operation(
        summary = "Lấy danh sách template đã được duyệt",
        description = "Trả về các template có status = APPROVED. Dùng cho dropdown trong Teacher UI. Lọc theo purpose để lấy đúng loại."
    )
    @GetMapping("/approved")
    @PreAuthorize("hasAnyRole('TEACHER', 'STAFF', 'MANAGER', 'ADMIN')")
    public ResponseEntity<List<PromptTemplateDTO>> getApprovedTemplates(
            @Parameter(description = "Lọc theo mục đích: LESSON_PLAN_GEN | QUESTION_GEN")
            @RequestParam(required = false) String purpose) {
        return ResponseEntity.ok(aiPromptTemplateService.getApprovedTemplatesByPurpose(purpose));
    }

    @Operation(summary = "Lấy chi tiết template theo ID")
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('TEACHER', 'STAFF', 'MANAGER', 'ADMIN')")
    public ResponseEntity<PromptTemplateDTO> getById(@PathVariable Long id) {
        return ResponseEntity.ok(aiPromptTemplateService.getAllTemplates().stream()
                .filter(t -> t.getId().equals(id)).findFirst()
                .orElseThrow(() -> new RuntimeException("Template not found")));
    }

    @Operation(
        summary = "Tạo mới Prompt Template",
        description = "Chỉ STAFF và ADMIN có quyền tạo. Template mới sẽ có status PENDING, cần Manager duyệt trước khi Teacher dùng được."
    )
    @PostMapping
    @PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
    public ResponseEntity<PromptTemplateDTO> create(@RequestBody PromptTemplateRequest request, @AuthenticationPrincipal User user) {
        return ResponseEntity.status(HttpStatus.CREATED).body(aiPromptTemplateService.createTemplate(request, user));
    }

    @Operation(
        summary = "Cập nhật Prompt Template",
        description = "Chỉ STAFF và ADMIN có quyền chỉnh sửa. Chỉ có thể cập nhật template đang ở trạng thái PENDING hoặc REJECTED."
    )
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
    public ResponseEntity<PromptTemplateDTO> update(@PathVariable Long id, @RequestBody PromptTemplateRequest request) {
        return ResponseEntity.ok(aiPromptTemplateService.updateTemplate(id, request));
    }

    @Operation(summary = "Xóa Prompt Template", description = "Chỉ STAFF và ADMIN có quyền xóa.")
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        aiPromptTemplateService.deleteTemplate(id);
        return ResponseEntity.noContent().build();
    }

    @Operation(
        summary = "Duyệt / Từ chối Prompt Template",
        description = "Chỉ MANAGER và ADMIN có quyền. Body: {\"status\": \"APPROVED\"} hoặc {\"status\": \"REJECTED\"}. Mặc định status=APPROVED nếu không truyền body."
    )
    @PutMapping("/{id}/approve")
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN')")
    public ResponseEntity<?> approve(
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, String> body,
            @AuthenticationPrincipal User manager) {
        try {
            String status = (body != null && body.containsKey("status")) ? body.get("status") : "APPROVED";
            PromptTemplateDTO updated = aiPromptTemplateService.approveTemplate(id, status, manager);
            return ResponseEntity.ok(updated);
        } catch (RuntimeException e) {
            return ResponseEntity.status(404)
                    .body(new ErrorResponse(e.getMessage()));
        }
    }

    @Operation(
        summary = "Sinh nội dung từ Prompt Template bằng AI",
        description = "Lấy template theo templateId, điền các biến trong inputs vào {{variable}}, gửi cho Gemini AI. Trả về {\"content\": \"...\"}. Dùng cho cả giáo án và câu hỏi."
    )
    @PostMapping("/generate")
    @PreAuthorize("hasAnyRole('TEACHER', 'STAFF', 'MANAGER', 'ADMIN')")
    public ResponseEntity<?> generate(@RequestBody Map<String, Object> payload) {
        try {
            if (!payload.containsKey("templateId") || payload.get("templateId") == null) {
                return ResponseEntity.badRequest().body(new ErrorResponse("Thiếu ID mẫu (templateId)"));
            }
            
            Long templateId = Long.valueOf(payload.get("templateId").toString());
            @SuppressWarnings("unchecked")
            Map<String, String> inputs = (Map<String, String>) payload.get("inputs");
            
            String content = aiPromptTemplateService.generateContent(templateId, inputs);
            return ResponseEntity.ok(Map.of("content", content));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(new ErrorResponse("Lỗi xử lý AI: " + e.getMessage()));
        }
    }
}