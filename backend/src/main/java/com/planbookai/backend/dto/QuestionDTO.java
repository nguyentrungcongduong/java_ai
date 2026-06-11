package com.planbookai.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * QuestionDTO – Response object đại diện cho 1 câu hỏi.
 *
 * <p>Dùng cho cả:
 * <ul>
 *   <li>GET /questions/{id} – xem chi tiết</li>
 *   <li>POST /questions/ai-generate – preview trước khi lưu</li>
 * </ul>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuestionDTO {

    private Long id;

    private Integer bankId;

    private String bankName;

    private Long createdById;

    private String createdByName;

    /** Nội dung câu hỏi (text). */
    private String content;

    /** Loại câu hỏi: MULTIPLE_CHOICE | SHORT_ANSWER | FILL_IN_BLANK. */
    private String type;

    /** Độ khó: EASY | MEDIUM | HARD. */
    private String difficulty;

    /** Chủ đề. */
    private String topic;

    /**
     * Danh sách đáp án (cho MULTIPLE_CHOICE).
     * Format: [{label: "A", text: "...", isCorrect: true/false}]
     */
    private List<Map<String, Object>> options;

    /** Đáp án đúng (dạng text). */
    private String correctAnswer;

    /** Giải thích đáp án. */
    private String explanation;

    /** true nếu câu hỏi được sinh bởi AI. */
    private Boolean aiGenerated;

    /** true nếu đã được Manager phê duyệt. */
    private Boolean isApproved;

    /** ID của Manager đã phê duyệt. Null nếu chưa được duyệt. */
    private Long approvedById;

    /** Tên của Manager đã phê duyệt. Null nếu chưa được duyệt. */
    private String approvedByName;

    private LocalDateTime createdAt;

    // ----------------------------------------------------------
    // Nested DTO cho danh sách bank (GET /question-banks)
    // ----------------------------------------------------------

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class QuestionBankDTO {
        private Integer id;
        private String name;
        private String subject;
        private String gradeLevel;
        private String description;
        private Long createdById;
        private String createdByName;
        private Boolean isPublished;
        private Boolean isOwnBank;   // true = do chính teacher này tạo
        private LocalDateTime createdAt;
    }
}
