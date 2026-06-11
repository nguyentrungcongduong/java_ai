package com.planbookai.backend.controller;

import com.planbookai.backend.dto.PromptTemplateDTO;
import com.planbookai.backend.dto.PromptTemplateRequest;
import com.planbookai.backend.model.entity.User;
import com.planbookai.backend.service.AiPromptTemplateService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.List;

@RestController
@RequestMapping("/api/v1/ai/prompt-templates")
@Tag(name = "AI Prompt Templates (Legacy)", description = "Legacy endpoint tại /api/v1/ai/prompt-templates. Ưu tiên dùng /api/v1/prompt-templates thay thế.")
public class AiPromptTemplateController {

    private final AiPromptTemplateService service;

    public AiPromptTemplateController(AiPromptTemplateService service) {
        this.service = service;
    }

    @Operation(summary = "[Legacy] Lấy tất cả templates", description = "Endpoint cũ, dùng GET /api/v1/prompt-templates thay thế.")
    @GetMapping
    public List<PromptTemplateDTO> getAll() {
        return service.getAllTemplates();
    }

    @Operation(summary = "[Legacy] Lấy templates đã duyệt", description = "Endpoint cũ, dùng GET /api/v1/prompt-templates/approved thay thế.")
    @GetMapping("/approved")
    public List<PromptTemplateDTO> getApproved(@RequestParam(required = false) String purpose) {
        return service.getApprovedTemplatesByPurpose(purpose);
    }

    @Operation(summary = "[Legacy] Tạo template mới")
    @PostMapping
    public PromptTemplateDTO create(@RequestBody PromptTemplateRequest request, @AuthenticationPrincipal User user) {
        return service.createTemplate(request, user);
    }

    @Operation(summary = "[Legacy] Cập nhật template")
    @PutMapping("/{id}")
    public PromptTemplateDTO update(@PathVariable Long id, @RequestBody PromptTemplateRequest request) {
        return service.updateTemplate(id, request);
    }

    @Operation(summary = "[Legacy] Xóa template")
    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        service.deleteTemplate(id);
    }

    @Operation(summary = "[Legacy] Sinh nội dung AI từ template")
    @PostMapping("/generate")
    public Map<String, String> generate(@RequestBody Map<String, Object> payload) {
        Long templateId = Long.valueOf(payload.get("templateId").toString());
        Map<String, String> inputs = (Map<String, String>) payload.get("inputs");
        String content = service.generateContent(templateId, inputs);
        return Map.of("content", content);
    }
}