package com.planbookai.backend.controller;

import com.planbookai.backend.dto.PageResponse;
import com.planbookai.backend.dto.QuestionBankRequest;
import com.planbookai.backend.dto.QuestionDTO;
import com.planbookai.backend.model.entity.User;
import com.planbookai.backend.service.QuestionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/question-banks")
@RequiredArgsConstructor
@Tag(name = "Question Banks", description = "Quản lý ngân hàng câu hỏi. Teacher/Staff tạo và quản lý ngân hàng riêng. Dùng làm nguồn câu hỏi cho AI sinh đề thi.")
public class QuestionBankController {

    private final QuestionService questionService;

    @Operation(summary = "Lấy danh sách ngân hàng câu hỏi của tôi", description = "Trả về các ngân hàng câu hỏi thuộc sở hữu của user hiện tại.")
    @GetMapping
    @PreAuthorize("hasAnyRole('TEACHER','STAFF','MANAGER','ADMIN')")
    public ResponseEntity<List<QuestionDTO.QuestionBankDTO>> getMyBanks(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(questionService.getMyBanks(user));
    }

    @Operation(summary = "Xem chi tiết ngân hàng câu hỏi", description = "Lấy thông tin chi tiết của một ngân hàng. User chỉ xem được ngân hàng của mình.")
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('TEACHER','STAFF','MANAGER','ADMIN')")
    public ResponseEntity<QuestionDTO.QuestionBankDTO> getBank(
            @PathVariable Integer id,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(questionService.getBank(id, user));
    }

    @Operation(summary = "Tạo ngân hàng câu hỏi mới", description = "Chỉ TEACHER và STAFF. Điền tên, môn học, khối lớp cho ngân hàng.")
    @PostMapping
    @PreAuthorize("hasAnyRole('TEACHER','STAFF')")
    public ResponseEntity<QuestionDTO.QuestionBankDTO> createBank(
            @Valid @RequestBody QuestionBankRequest request,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.status(201).body(questionService.createBank(request, user));
    }

    @Operation(summary = "Cập nhật ngân hàng câu hỏi", description = "Chỉ TEACHER và STAFF. Chỉ cập nhật được ngân hàng của chính mình.")
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('TEACHER','STAFF')")
    public ResponseEntity<QuestionDTO.QuestionBankDTO> updateBank(
            @PathVariable Integer id,
            @Valid @RequestBody QuestionBankRequest request,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(questionService.updateBank(id, request, user));
    }

    @Operation(summary = "Xóa ngân hàng câu hỏi", description = "Chỉ TEACHER và STAFF. Xóa ngân hàng và tất cả câu hỏi bên trong.")
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('TEACHER','STAFF')")
    public ResponseEntity<Void> deleteBank(
            @PathVariable Integer id,
            @AuthenticationPrincipal User user) {
        questionService.deleteBank(id, user);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Lấy danh sách câu hỏi trong ngân hàng", description = "Phân trang, lọc theo topic, difficulty (EASY/MEDIUM/HARD), type (MULTIPLE_CHOICE/TRUE_FALSE/ESSAY).")
    @GetMapping("/{id}/questions")
    @PreAuthorize("hasAnyRole('TEACHER','STAFF','MANAGER','ADMIN')")
    public ResponseEntity<PageResponse<QuestionDTO>> getQuestionsInBank(
            @PathVariable Integer id,
            @RequestParam(defaultValue = "0") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) String topic,
            @RequestParam(required = false) String difficulty,
            @RequestParam(required = false) String type,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(questionService.getQuestionsByBank(id, user, page, size, topic, difficulty, type));
    }
}
