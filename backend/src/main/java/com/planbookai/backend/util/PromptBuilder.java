package com.planbookai.backend.util;

import com.planbookai.backend.model.entity.Question;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * PromptBuilder – Xây dựng prompt gửi lên Gemini AI để sinh câu hỏi và giáo án.
 *
 * <p>Thiết kế theo nguyên tắc Single Responsibility: chỉ chịu trách nhiệm
 * xây dựng chuỗi prompt, không phụ thuộc vào bất kỳ service AI nào.
 *
 * <p>Prompt được thiết kế để:
 * <ul>
 *   <li>Buộc Gemini trả về JSON thuần túy (không có markdown code fence).</li>
 *   <li>Định nghĩa rõ schema JSON để dễ parse.</li>
 *   <li>Điều chỉnh theo loại câu hỏi (MULTIPLE_CHOICE / SHORT_ANSWER / FILL_IN_BLANK).</li>
 * </ul>
 */
@Component
public class PromptBuilder {

    // =========================================================================
    // Question Prompts
    // =========================================================================

    /**
     * Tạo prompt hoàn chỉnh để gửi lên Gemini AI sinh câu hỏi.
     *
     * @param subject    Môn học (VD: Chemistry)
     * @param topic      Chủ đề (VD: Periodic Table)
     * @param difficulty Độ khó (EASY | MEDIUM | HARD)
     * @param type       Loại câu hỏi
     * @param count      Số câu cần sinh
     * @return Chuỗi prompt hoàn chỉnh
     */
    public String buildQuestionPrompt(
            String subject,
            String topic,
            Question.Difficulty difficulty,
            Question.QuestionType type,
            int count) {

        String difficultyLabel = mapDifficultyLabel(difficulty);
        String typeInstructions = buildTypeInstructions(type);

        return """
                You are an expert Vietnamese high school %s teacher and exam writer.
                Your task is to generate exactly %d %s questions about the topic "%s" with %s difficulty.

                %s

                CRITICAL RULES:
                1. Return ONLY a valid JSON array. No markdown, no code fences, no explanation.
                2. The JSON array must contain exactly %d question objects.
                3. All text must be in Vietnamese.
                4. Each question must be educationally accurate and appropriate for high school level.
                5. Difficulty level "%s" means: %s

                Required JSON schema for each question object:
                {
                  "content": "<question text in Vietnamese>",
                  "type": "%s",
                  "difficulty": "%s",
                  "topic": "%s",
                  "options": %s,
                  "correctAnswer": "<correct answer>",
                  "explanation": "<brief explanation in Vietnamese>"
                }

                Generate the JSON array now:
                """.formatted(
                subject, count, type.name(), topic, difficultyLabel,
                typeInstructions,
                count,
                difficultyLabel, getDifficultyDescription(difficulty),
                type.name(), difficulty.name(), topic,
                buildOptionsSchema(type)
        );
    }

    /**
     * Tạo prompt để sinh thêm câu hỏi bù vào đề thi khi ngân hàng không đủ (KAN-23).
     *
     * <p>Prompt chỉ yêu cầu Gemini sinh đúng {@code gapCount} câu (phần còn thiếu),
     * và truyền danh sách câu đã chọn từ bank để tránh trùng lặp nội dung.
     *
     * @param subject          Môn học
     * @param topic            Chủ đề
     * @param difficulty       Độ khó
     * @param type             Loại câu hỏi
     * @param gapCount         Số câu cần sinh thêm
     * @param existingContents Danh sách nội dung câu hỏi đã có (để tránh trùng)
     * @return Chuỗi prompt hoàn chỉnh
     */
    public String buildExamGenerationPrompt(
            String subject,
            String topic,
            Question.Difficulty difficulty,
            Question.QuestionType type,
            int gapCount,
            List<String> existingContents) {

        String difficultyLabel = mapDifficultyLabel(difficulty);
        String typeInstructions = buildTypeInstructions(type);

        String avoidSection = "";
        if (existingContents != null && !existingContents.isEmpty()) {
            StringBuilder sb = new StringBuilder(
                    "IMPORTANT – The following questions are already in the exam. Do NOT generate similar or duplicate questions:\n");
            int cap = Math.min(existingContents.size(), 10); // limit context size
            for (int i = 0; i < cap; i++) {
                sb.append("- ").append(existingContents.get(i)).append("\n");
            }
            avoidSection = sb.toString();
        }

        return """
                You are an expert Vietnamese high school %s teacher and exam writer.
                Your task is to generate exactly %d NEW %s questions about the topic "%s" with %s difficulty.
                These questions will supplement existing exam questions – AVOID duplicates.

                %s

                %s

                CRITICAL RULES:
                1. Return ONLY a valid JSON array. No markdown, no code fences, no explanation.
                2. The JSON array must contain exactly %d question objects.
                3. All text must be in Vietnamese.
                4. Each question must be educationally accurate and appropriate for high school level.
                5. Difficulty level "%s" means: %s

                Required JSON schema for each question object:
                {
                  "content": "<question text in Vietnamese>",
                  "type": "%s",
                  "difficulty": "%s",
                  "topic": "%s",
                  "options": %s,
                  "correctAnswer": "<correct answer>",
                  "explanation": "<brief explanation in Vietnamese>"
                }

                Generate the JSON array now:
                """.formatted(
                subject, gapCount, type.name(), topic, difficultyLabel,
                avoidSection,
                typeInstructions,
                gapCount,
                difficultyLabel, getDifficultyDescription(difficulty),
                type.name(), difficulty.name(), topic,
                buildOptionsSchema(type)
        );
    }

    // =========================================================================
    // Lesson Plan Prompts
    // =========================================================================

    /**
     * Framework dạy học được hỗ trợ cho sinh giáo án.
     */
    public enum LessonFramework {
        E5("5E", "Gồm 5 bước: Engage (Khởi động), Explore (Khám phá), Explain (Giải thích), Elaborate (Mở rộng), Evaluate (Đánh giá)."),
        E3("3E", "Gồm 3 bước: Engage (Kích hoạt), Explore (Khám phá), Explain (Giải thích). Phù hợp cho tiết học ngắn."),
        E4("4E", "Gồm 4 bước: Engage (Khởi động), Explore (Khám phá), Explain (Giải thích), Evaluate (Đánh giá)."),
        BACKWARD_DESIGN("Backward Design (Thiết kế ngược)", "Thiết kế ngược: 1) Xác định mục tiêu mong muốn, 2) Xác định bằng chứng đánh giá, 3) Lên kế hoạch hoạt động học tập."),
        TGAP("TGAP", "Mô hình Việt Nam: 1) Tình huống xuất phát, 2) Khám phá kiến thức mới, 3) Luyện tập – vận dụng, 4) Vận dụng – mở rộng.");

        private final String label;
        private final String description;

        LessonFramework(String label, String description) {
            this.label = label;
            this.description = description;
        }

        public String label() { return label; }
        public String description() { return description; }
    }

    /**
     * Tạo prompt hoàn chỉnh để Gemini AI sinh giáo án (objectives do AI tự suy ra).
     */
    public String buildLessonPlanPrompt(
            String subject,
            String topic,
            String grade,
            int duration,
            LessonFramework framework) {
        return buildLessonPlanPrompt(subject, topic, grade, duration, framework, null);
    }

    /**
     * Tạo prompt hoàn chỉnh để Gemini AI sinh giáo án.
     *
     * @param subject    Môn học (VD: Toán, Tiếng Việt, Khoa học)
     * @param topic      Chủ đề bài học (VD: Phép cộng phân số)
     * @param grade      Lớp (VD: Lớp 4, Grade 6)
     * @param duration   Thời lượng tiết học (phút, VD: 45)
     * @param framework  Khung phương pháp giảng dạy
     * @param objectives Chuỗi mục tiêu phân cách bằng dấu |, hoặc null để AI tự suy ra
     * @return Chuỗi prompt hoàn chỉnh
     */
    public String buildLessonPlanPrompt(
            String subject,
            String topic,
            String grade,
            int duration,
            LessonFramework framework,
            String objectives) {

        String objectivesBlock = buildObjectivesBlock(objectives, topic);

        return """
                You are an expert Vietnamese instructional designer and teacher with deep experience in lesson planning.
                Your task is to generate a complete, high-quality lesson plan based on the input below.

                === INPUT ===
                - Subject: %s
                - Grade Level: %s
                - Topic: %s
                - Duration (minutes): %d
                - Framework: %s
                %s

                CRITICAL RULES:
                1. Return ONLY a valid JSON object. No markdown, no code fences, no explanation.
                2. All text must be in Vietnamese (including all field values).
                3. The lesson plan must be educationally sound and ready to use in a real classroom.
                4. The total of all time_minutes in lesson_flow MUST equal exactly %d minutes.
                5. Objectives must be measurable and aligned with activities.
                6. Use age-appropriate language for the given grade level.

                OUTPUT FORMAT (STRICT JSON):
                {
                  "title": "<concise lesson title in Vietnamese>",
                  "grade_level": "%s",
                  "subject": "%s",
                  "topic": "%s",
                  "duration_minutes": %d,
                  "objectives": ["<objective 1>", "<objective 2>"],
                  "materials": ["<material 1>", "<material 2>"],
                  "lesson_flow": [
                    {
                      "phase": "<phase name in Vietnamese>",
                      "time_minutes": <number>,
                      "activities": "<detailed description of what happens in this phase>",
                      "teacher_actions": "<what the teacher does>",
                      "student_actions": "<what the students do>"
                    }
                  ],
                  "assessment": {
                    "methods": ["<method 1>", "<method 2>"],
                    "criteria": "<how learning outcomes are measured>"
                  },
                  "homework": "<homework description in Vietnamese>",
                  "notes": "<optional pedagogical notes for the teacher>"
                }

                Generate the JSON now:
                """.formatted(
                subject, grade, topic, duration,
                framework.label(),
                objectivesBlock,
                duration,
                grade, subject, topic, duration
        );
    }

    // =========================================================================
    // Private helpers
    // =========================================================================

    private String buildObjectivesBlock(String objectives, String topic) {
        if (objectives == null || objectives.isBlank()) {
            return "- Objectives: (AI will infer appropriate objectives based on the topic)";
        }
        return "- Objectives: " + objectives;
    }

    private String buildTypeInstructions(Question.QuestionType type) {
        return switch (type) {
            case MULTIPLE_CHOICE -> """
                    For MULTIPLE_CHOICE questions:
                    - Provide exactly 4 options labeled A, B, C, D.
                    - Exactly one option must be correct (isCorrect: true), others false.
                    - Options should be plausible but clearly differentiated.""";
            case SHORT_ANSWER -> """
                    For SHORT_ANSWER questions:
                    - The question requires a short text answer (1-3 sentences).
                    - Set options to null.
                    - The correctAnswer field should contain the expected answer.""";
            case FILL_IN_BLANK -> """
                    For FILL_IN_BLANK questions:
                    - Use "___" (three underscores) to indicate the blank in the content.
                    - Set options to null.
                    - The correctAnswer field should contain the word(s) that fill the blank.""";
        };
    }

    private String buildOptionsSchema(Question.QuestionType type) {
        if (type == Question.QuestionType.MULTIPLE_CHOICE) {
            return """
                    [
                      {"label": "A", "text": "<option A text>", "isCorrect": false},
                      {"label": "B", "text": "<option B text>", "isCorrect": true},
                      {"label": "C", "text": "<option C text>", "isCorrect": false},
                      {"label": "D", "text": "<option D text>", "isCorrect": false}
                    ]""";
        }
        return "null";
    }

    private String mapDifficultyLabel(Question.Difficulty difficulty) {
        return switch (difficulty) {
            case EASY   -> "EASY (Dễ)";
            case MEDIUM -> "MEDIUM (Trung bình)";
            case HARD   -> "HARD (Khó)";
        };
    }

    private String getDifficultyDescription(Question.Difficulty difficulty) {
        return switch (difficulty) {
            case EASY   -> "recall-level knowledge, straightforward questions";
            case MEDIUM -> "comprehension and application, moderate complexity";
            case HARD   -> "analysis and synthesis, complex multi-step reasoning";
        };
    }

    // =========================================================================
    // Lesson Plan from File Prompt
    // =========================================================================

    /**
     * Tạo prompt để Gemini đọc nội dung file (PDF/DOCX) và sinh giáo án.
     *
     * @param grade      Khối lớp (VD: Lớp 10)
     * @param duration   Thời lượng (phút)
     * @param framework  Framework giảng dạy
     * @param objectives Mục tiêu bổ sung (tuỳ chọn)
     * @return Chuỗi prompt hoàn chỉnh kèm hướng dẫn đọc file
     */
    public String buildLessonPlanFromFilePrompt(
            String grade,
            int duration,
            LessonFramework framework,
            String objectives) {

        String objectivesBlock = buildObjectivesBlock(objectives, "nội dung trong tài liệu");

        return """
                You are an expert Vietnamese instructional designer. The attached document is a teaching curriculum, textbook chapter, or lesson reference material.

                Your task:
                1. READ and UNDERSTAND the content of the attached document.
                2. EXTRACT the main topic, subject, and key concepts from the document.
                3. GENERATE a complete, high-quality lesson plan based on that content.

                === LESSON PLAN CONFIGURATION ===
                - Grade Level: %s
                - Duration (minutes): %d
                - Framework: %s
                %s

                CRITICAL RULES:
                1. Return ONLY a valid JSON object. No markdown, no code fences, no explanation.
                2. All text must be in Vietnamese (including all field values).
                3. The lesson plan must reflect the actual content of the attached document.
                4. The total of all time_minutes in lesson_flow MUST equal exactly %d minutes.
                5. Infer subject and topic from the document content.

                OUTPUT FORMAT (STRICT JSON):
                {
                  "title": "<concise lesson title in Vietnamese>",
                  "grade_level": "%s",
                  "subject": "<subject inferred from document>",
                  "topic": "<main topic inferred from document>",
                  "duration_minutes": %d,
                  "objectives": ["<objective 1>", "<objective 2>"],
                  "materials": ["<material 1>", "<material 2>"],
                  "lesson_flow": [
                    {
                      "phase": "<phase name in Vietnamese>",
                      "time_minutes": <number>,
                      "activities": "<detailed description>",
                      "teacher_actions": "<what the teacher does>",
                      "student_actions": "<what the students do>"
                    }
                  ],
                  "assessment": {
                    "methods": ["<method 1>", "<method 2>"],
                    "criteria": "<how learning outcomes are measured>"
                  },
                  "homework": "<homework description in Vietnamese>",
                  "notes": "<optional pedagogical notes for the teacher>"
                }

                Generate the JSON now:
                """.formatted(
                grade, duration,
                framework.label(),
                objectivesBlock,
                duration,
                grade, duration
        );
    }
}
