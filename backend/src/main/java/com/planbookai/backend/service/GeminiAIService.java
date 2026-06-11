package com.planbookai.backend.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.genai.Client;
import com.google.genai.types.GenerateContentResponse;
import com.planbookai.backend.dto.GradingFeedbackRequest;
import com.planbookai.backend.dto.LessonPlanDTO;
import com.planbookai.backend.dto.QuestionDTO;
import com.planbookai.backend.exception.AIServiceException;
import com.planbookai.backend.model.entity.LessonPlan;
import com.planbookai.backend.model.entity.Question;
import com.planbookai.backend.model.entity.User;
import com.planbookai.backend.util.PromptBuilder;
import com.planbookai.backend.util.PromptBuilder.LessonFramework;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class GeminiAIService {

    private static final Logger log = LoggerFactory.getLogger(GeminiAIService.class);

    private final Client geminiClient;
    private final PromptBuilder promptBuilder;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final AiRateLimitService rateLimitService;
    private final CurrentUserService currentUserService;

    // ── Gemini config ──────────────────────────────────────────────────────────
    @Value("${gemini.model:gemini-2.0-flash}")
    private String model;

    // ── Groq config (ưu tiên nếu có key) ─────────────────────────────────────
    @Value("${groq.api-key:}")
    private String groqApiKey;

    @Value("${groq.model:llama-3.3-70b-versatile}")
    private String groqModel;

    @Value("${groq.base-url:https://api.groq.com/openai/v1}")
    private String groqBaseUrl;

    public GeminiAIService(Optional<Client> geminiClient, PromptBuilder promptBuilder,
                           ObjectMapper objectMapper, AiRateLimitService rateLimitService,
                           CurrentUserService currentUserService) {
        this.geminiClient = geminiClient.orElse(null);
        this.promptBuilder = promptBuilder;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newHttpClient();
        this.rateLimitService = rateLimitService;
        this.currentUserService = currentUserService;
    }

    // ── Rate limit helper ─────────────────────────────────────────────────────
    /**
     * Kiểm tra + tăng AI quota cho user hiện tại.
     * Nếu không có user trong SecurityContext (unauthenticated) thì bỏ qua.
     */
    private void enforceRateLimit() {
        currentUserService.getCurrentUserEntity().ifPresent(rateLimitService::checkAndIncrement);
    }

    // =========================================================================
    // AI Provider Router: Groq ưu tiên → Gemini fallback
    // =========================================================================

    /**
     * Gọi AI provider theo thứ tự ưu tiên:
     * 1. Groq (nếu GROQ_API_KEY được cấu hình)
     * 2. Gemini (nếu GEMINI_API_KEY được cấu hình)
     */
    private String callAIProvider(String prompt) {
        if (groqApiKey != null && !groqApiKey.isBlank()) {
            log.debug("[AI] Using Groq provider (model={})", groqModel);
            return callGroqApi(prompt);
        }
        if (geminiClient != null) {
            log.debug("[AI] Using Gemini provider (model={})", model);
            try {
                GenerateContentResponse response = geminiClient.models.generateContent(model, prompt, null);
                return response != null ? response.text() : null;
            } catch (Exception e) {
                String msg = e.getMessage();
                log.error("[AI] Gemini call failed: {}", msg, e);
                if (msg != null && msg.contains("API key not valid")) {
                    throw new AIServiceException("API Key Gemini không hợp lệ.");
                }
                throw new AIServiceException("Gemini AI service is unavailable: " + msg);
            }
        }
        throw new AIServiceException("Không có AI provider nào được cấu hình. Vui lòng set GROQ_API_KEY hoặc GEMINI_API_KEY.");
    }

    /**
     * Gọi Groq API (OpenAI-compatible format).
     */
    @SuppressWarnings("unchecked")
    private String callGroqApi(String prompt) {
        try {
            Map<String, Object> message = Map.of("role", "user", "content", prompt);
            Map<String, Object> body = Map.of(
                    "model", groqModel,
                    "messages", List.of(message),
                    "temperature", 0.7
            );
            String requestBody = objectMapper.writeValueAsString(body);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(groqBaseUrl + "/chat/completions"))
                    .header("Authorization", "Bearer " + groqApiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                log.error("[AI] Groq returned HTTP {}: {}", response.statusCode(), response.body());
                throw new AIServiceException("Groq API error " + response.statusCode() + ": " + response.body());
            }

            Map<String, Object> responseMap = objectMapper.readValue(
                    response.body(), new TypeReference<Map<String, Object>>() {});
            List<Map<String, Object>> choices = (List<Map<String, Object>>) responseMap.get("choices");
            if (choices == null || choices.isEmpty()) {
                throw new AIServiceException("Groq returned empty choices.");
            }
            Map<String, Object> messageObj = (Map<String, Object>) choices.get(0).get("message");
            return (String) messageObj.get("content");

        } catch (AIServiceException e) {
            throw e;
        } catch (Exception e) {
            log.error("[AI] Groq call failed: {}", e.getMessage(), e);
            throw new AIServiceException("Groq service unavailable: " + e.getMessage());
        }
    }

    // =========================================================================
    // Question Generation
    // =========================================================================

    /**
     * Sinh danh sách câu hỏi thông qua Gemini AI (chưa lưu DB).
     */
    public List<QuestionDTO> generateQuestions(
            String subject,
            String topic,
            Question.Difficulty difficulty,
            Question.QuestionType type,
            int count) {

        enforceRateLimit();

        if (geminiClient == null) {
            throw new AIServiceException("Hệ thống AI chưa được thiết lập. Vui lòng liên hệ Admin để cấu hình GEMINI_API_KEY.");
        }

        String prompt = promptBuilder.buildQuestionPrompt(subject, topic, difficulty, type, count);
        log.info("[GeminiAI] Sending prompt for {} questions: subject={}, topic={}, difficulty={}, type={}",
                count, subject, topic, difficulty, type);

        return callGeminiAndParse(prompt, subject, topic, difficulty, type);
    }

    /**
     * Sinh câu hỏi bù vào đề thi khi ngân hàng không đủ (KAN-23).
     *
     * <p>Prompt được tối ưu để tránh trùng lặp với các câu hỏi đã có trong đề.
     *
     * @param subject          Môn học
     * @param topic            Chủ đề
     * @param difficulty       Độ khó
     * @param type             Loại câu hỏi
     * @param gapCount         Số câu cần sinh bù
     * @param existingContents Nội dung các câu hỏi đã có (để tránh trùng)
     * @return Danh sách QuestionDTO mới (chưa lưu DB)
     * @throws AIServiceException nếu Gemini trả về lỗi hoặc JSON không hợp lệ
     */
    public List<QuestionDTO> generateExamGapQuestions(
            String subject,
            String topic,
            Question.Difficulty difficulty,
            Question.QuestionType type,
            int gapCount,
            List<String> existingContents) {

        if (gapCount <= 0) {
            return List.of();
        }

        enforceRateLimit();

        if (geminiClient == null) {
            throw new AIServiceException("Hệ thống AI chưa được thiết lập. Vui lòng liên hệ Admin để cấu hình GEMINI_API_KEY.");
        }

        String prompt = promptBuilder.buildExamGenerationPrompt(
                subject, topic, difficulty, type, gapCount, existingContents);

        log.info("[GeminiAI][ExamGap] Generating {} gap questions: subject={}, topic={}, difficulty={}, type={}",
                gapCount, subject, topic, difficulty, type);

        return callGeminiAndParse(prompt, subject, topic, difficulty, type);
    }

    // =========================================================================
    // Lesson Plan Generation from File (PDF / DOCX)
    // =========================================================================

    /**
     * Sinh giáo án từ tài liệu (PDF hoặc DOCX) do giáo viên upload.
     *
     * <p>Gửi file kèm prompt lên Gemini multimodal để AI đọc nội dung
     * và sinh giáo án JSON theo framework đã chọn.
     *
     * @param fileBytes      Nội dung nhị phân của file
     * @param mimeType       MIME type: "application/pdf" hoặc "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
     * @param gradeLevel     Khối lớp
     * @param duration       Thời lượng tiết học (phút)
     * @param framework      Framework giảng dạy
     * @param objectives     Mục tiêu bổ sung (tuỳ chọn)
     * @return LessonPlanDTO đã parse từ JSON trả về của Gemini
     */
    public LessonPlanDTO generateLessonPlanFromFileContent(
            byte[] fileBytes,
            String mimeType,
            String gradeLevel,
            int duration,
            LessonFramework framework,
            String objectives) {

        if (fileBytes == null || fileBytes.length == 0) {
            throw new AIServiceException("File không hợp lệ hoặc rỗng.");
        }

        String prompt = promptBuilder.buildLessonPlanFromFilePrompt(gradeLevel, duration, framework, objectives);
        log.info("[AI] Generating lesson plan from file: gradeLevel={}, duration={}, framework={}, mimeType={}",
                gradeLevel, duration, framework.label(), mimeType);

        // Gemini hỗ trợ multimodal (gửi cả file). Groq không hỗ trợ → fallback sang text-only prompt
        String rawResponse;
        if (groqApiKey != null && !groqApiKey.isBlank()) {
            // Groq: chỉ gửi prompt text, bó qua file bytes
            log.warn("[AI] Groq does not support file upload. Generating lesson plan from prompt only (no file content).");
            rawResponse = callAIProvider(prompt);
        } else if (geminiClient != null) {
            // Gemini: gửi cả prompt + file bytes (multimodal)
            try {
                com.google.genai.types.Content content = com.google.genai.types.Content.fromParts(
                        com.google.genai.types.Part.fromText(prompt),
                        com.google.genai.types.Part.fromBytes(fileBytes, mimeType));
                com.google.genai.types.GenerateContentResponse response =
                        geminiClient.models.generateContent(model, content, null);
                rawResponse = response != null ? response.text() : null;
            } catch (Exception e) {
                log.error("[AI] Gemini generateLessonPlanFromFile failed: {}", e.getMessage(), e);
                throw new AIServiceException("Gemini AI service is unavailable: " + e.getMessage());
            }
        } else {
            throw new AIServiceException("Không có AI provider nào được cấu hình.");
        }

        log.debug("[AI] Raw file lesson plan response: {}", rawResponse);
        String cleanedJson = cleanJsonResponse(rawResponse);

        Map<String, Object> raw;
        try {
            raw = objectMapper.readValue(cleanedJson, new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            log.error("[AI] Failed to parse file lesson plan JSON: {}", cleanedJson, e);
            throw new AIServiceException("AI returned invalid JSON for lesson plan. Please try again.");
        }

        if (raw == null) {
            throw new AIServiceException("AI returned empty response for lesson plan.");
        }

        return mapRawToLessonPlan(raw);
    }


    // =========================================================================
    // Lesson Plan Generation
    // =========================================================================

    public LessonPlanDTO generateLessonPlan(
            String subject,
            String topic,
            String grade,
            int duration,
            LessonFramework framework,
            String objectives) {

        enforceRateLimit();

        String prompt = promptBuilder.buildLessonPlanPrompt(
                subject, topic, grade, duration, framework, objectives);

        log.info("[AI] Generating lesson plan: subject={}, topic={}, grade={}, duration={}, framework={}",
                subject, topic, grade, duration, framework.label());

        String rawResponse = callAIProvider(prompt);

        log.debug("[AI] Raw lesson plan response: {}", rawResponse);
        String cleanedJson = cleanJsonResponse(rawResponse);

        Map<String, Object> raw;
        try {
            raw = objectMapper.readValue(cleanedJson, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            log.error("[AI] Failed to parse lesson plan JSON: {}", cleanedJson, e);
            throw new AIServiceException("AI returned invalid JSON for lesson plan. Please try again.");
        }

        if (raw == null) {
            log.error("[AI] Raw lesson plan map is null");
            throw new AIServiceException("AI returned empty response for lesson plan.");
        }

        return mapRawToLessonPlan(raw);
    }

    // =========================================================================
    // Grading Feedback Generation
    // =========================================================================

    /**
     * Sinh gợi ý feedback cho bài kiểm tra bằng Gemini AI.
     *
     * <p>CHỈ dựa trên dữ liệu CÓ THẬT: điểm số, câu sai, câu bỏ trống.
     * KHÔNG suy đoán hay bịa đặt nguyên nhân tâm lý.
     *
     * @param request Thông tin bài làm của học sinh
     * @return Plain text feedback ngắn gọn (≤ 500 chars)
     */
    public String generateFeedback(GradingFeedbackRequest request) {
        enforceRateLimit();

        String prompt = buildGradingFeedbackPrompt(request);
        log.info("[AI] Generating grading feedback for student={}, exam={}",
                request.getStudentName(), request.getExamTitle());

        String rawResponse = callAIProvider(prompt);

        if (rawResponse == null || rawResponse.isBlank()) {
            throw new AIServiceException("AI returned empty feedback response.");
        }

        String cleaned = rawResponse.trim();
        if (cleaned.length() > 500) {
            cleaned = cleaned.substring(0, 497) + "...";
        }

        log.debug("[AI] Raw feedback: {}", cleaned);
        return cleaned;
    }

    /**
     * Build prompt cho grading feedback.
     * Chỉ đưa vào dữ liệu có thật — không bịa.
     */
    private String buildGradingFeedbackPrompt(GradingFeedbackRequest req) {
        StringBuilder sb = new StringBuilder();
        sb.append("Bạn là một giáo viên có kinh nghiệm, viết nhận xét phản hồi cho bài kiểm tra của học sinh.\n");
        sb.append("CHỈ dựa trên dữ liệu được cung cấp bên dưới. KHÔNG suy đoán hay bịa đặt nguyên nhân.\n\n");

        sb.append("Thông tin bài kiểm tra:\n");
        sb.append("- Môn: ").append(nullSafe(req.getSubject())).append("\n");
        sb.append("- Lớp: ").append(nullSafe(req.getGradeLevel())).append("\n");
        sb.append("- Tên học sinh: ").append(nullSafe(req.getStudentName())).append("\n");
        sb.append("- Điểm: ").append(req.getTotalScore()).append("/").append(req.getTotalPossible())
          .append(" (").append(req.getPercentage()).append("%)\n");
        sb.append("- Số câu đúng: ").append(req.getCorrectCount())
          .append(", sai: ").append(req.getWrongCount())
          .append(", bỏ trống: ").append(req.getBlankCount()).append("\n\n");

        if (!req.getWrongQuestions().isEmpty()) {
            sb.append("Câu sai:\n");
            for (GradingFeedbackRequest.WrongQuestionInfo q : req.getWrongQuestions()) {
                sb.append("- Câu ").append(q.getOrder()).append(": ")
                  .append(nullSafe(q.getQuestionContent())).append("\n");
                sb.append("  Học sinh trả lời: ").append(nullSafe(q.getStudentAnswer()))
                  .append(" | Đáp án đúng: ").append(nullSafe(q.getCorrectAnswer())).append("\n");
            }
            sb.append("\n");
        }

        if (!req.getBlankQuestions().isEmpty()) {
            sb.append("Câu bỏ trống:\n");
            for (GradingFeedbackRequest.BlankQuestionInfo q : req.getBlankQuestions()) {
                sb.append("- Câu ").append(q.getOrder()).append(": ")
                  .append(nullSafe(q.getQuestionContent())).append("\n");
            }
            sb.append("\n");
        }

        sb.append("YÊU CẦU:\n");
        sb.append("1. Nhận xét NGẮN GỌN, tối đa 4-5 câu\n");
        sb.append("2. GỢI Ý, không phán xét cứng nhắc\n");
        sb.append("3. Điểm mạnh → ghi nhận ngắn gọn\n");
        sb.append("4. Điểm yếu → chỉ ra DỰA TRÊN DỮ LIỆU CÓ (câu sai ở đâu, bỏ trống ở đâu)\n");
        sb.append("5. Gợi ý hướng ôn tập cụ thể nếu có dữ liệu\n");
        sb.append("6. KHÔNG dùng các cụm từ như \"có vẻ như em không hiểu\" - dùng \"câu trả lời chưa chính xác ở phần...\"\n");
        sb.append("7. Nếu trên 50% câu bỏ trống → nhấn mạnh vấn đề bỏ trống\n");
        sb.append("8. KHÔNG bịa nguyên nhân tâm lý (\"em có vẻ lo lắng\", \"em không tập trung\")\n\n");
        sb.append("Format: plain text, không markdown, không bullet dài\n");

        return sb.toString();
    }

    private String nullSafe(String s) {
        return s != null ? s : "(không có thông tin)";
    }

    // =========================================================================
    // Raw AI call (direct prompt)
    // =========================================================================

    /**
     * Gọi AI trực tiếp với một chuỗi prompt đã build hoàn chỉnh.
     *
     * @param prompt Nội dung prompt đầy đủ
     * @return Văn bản phản hồi từ AI
     */
    public String callAi(String prompt) {
        enforceRateLimit();
        log.debug("[AI] callAi direct prompt");
        return callAIProvider(prompt);
    }

    // =========================================================================
    // Internal helpers
    // =========================================================================

    /**
     * Gọi Gemini API với prompt và parse kết quả thành danh sách QuestionDTO.
     */
    private List<QuestionDTO> callGeminiAndParse(
            String prompt,
            String subject,
            String topic,
            Question.Difficulty difficulty,
            Question.QuestionType type) {

        log.debug("[AI] callGeminiAndParse → callAIProvider");
        String rawResponse = callAIProvider(prompt);

        log.debug("[AI] Raw response: {}", rawResponse);
        String cleanedJson = cleanJsonResponse(rawResponse);

        List<Map<String, Object>> rawQuestions;
        try {
            rawQuestions = objectMapper.readValue(cleanedJson, new TypeReference<List<Map<String, Object>>>() {});
        } catch (Exception e) {
            log.error("[AI] Failed to parse JSON response: {}", cleanedJson, e);
            throw new AIServiceException("AI returned invalid JSON. Please try again.");
        }

        return rawQuestions.stream()
                .map(raw -> mapRawToDTO(raw, subject, topic, difficulty, type))
                .collect(Collectors.toList());
    }

    /**
     * Loại bỏ markdown code fence (```json ... ```) nếu Gemini thêm vào.
     * Dùng regex để xử lý chính xác hơn.
     */
    private String cleanJsonResponse(String raw) {
        if (raw == null) return "[]";

        String cleaned = raw.trim();

        // Regex: tìm JSON array/object bên trong optional markdown code fences
        Pattern pattern = Pattern.compile("```(?:json)?\\s*([\\[\\{].*?[\\]\\}])\\s*```", Pattern.DOTALL);
        Matcher matcher = pattern.matcher(cleaned);
        if (matcher.find()) {
            return matcher.group(1).trim();
        }

        // Fallback: strip markers thủ công
        return cleaned.replaceAll("```json|```", "").trim();
    }

    @SuppressWarnings("unchecked")
    private QuestionDTO mapRawToDTO(
            Map<String, Object> raw,
            String subject,
            String topic,
            Question.Difficulty difficulty,
            Question.QuestionType type) {

        String content = getStr(raw, "content", "");
        String correctAnswer = getStr(raw, "correctAnswer", "");
        String explanation = getStr(raw, "explanation", "");
        String topicVal = getStr(raw, "topic", topic);

        Question.QuestionType parsedType = parseEnum(
                Question.QuestionType.class,
                getStr(raw, "type", type.name()),
                type
        );

        Question.Difficulty parsedDifficulty = parseEnum(
                Question.Difficulty.class,
                getStr(raw, "difficulty", difficulty.name()),
                difficulty
        );

        List<Map<String, Object>> options = null;
        Object rawOptions = raw.get("options");

        if (rawOptions instanceof List<?>) {
            List<?> list = (List<?>) rawOptions;
            if (!list.isEmpty()) {
                options = new ArrayList<Map<String, Object>>();
                for (Object item : list) {
                    if (item instanceof Map<?, ?>) {
                        options.add((Map<String, Object>) item);
                    }
                }
            }
        }

        return QuestionDTO.builder()
                .content(content)
                .type(parsedType.name())
                .difficulty(parsedDifficulty.name())
                .topic(topicVal)
                .options(options)
                .correctAnswer(correctAnswer)
                .explanation(explanation)
                .aiGenerated(true)
                .isApproved(false)
                .build();
    }

    private LessonPlanDTO mapRawToLessonPlan(Map<String, Object> raw) {
        return LessonPlanDTO.builder()
                .title(getStr(raw, "title", ""))
                .gradeLevel(getStr(raw, "grade_level", ""))
                .subject(getStr(raw, "subject", ""))
                .topic(getStr(raw, "topic", ""))
                .durationMinutes(getInt(raw, "duration_minutes", 0))
                .lessonObjectives(getStrList(raw, "objectives"))
                .materialItems(getStrList(raw, "materials"))
                .lessonFlow(getLessonPhases(raw.get("lesson_flow")))
                .assessmentDetail(getAssessment(raw.get("assessment")))
                .homework(getStr(raw, "homework", ""))
                .notes(getStr(raw, "notes", ""))
                .aiGenerated(true)
                .status(LessonPlan.LessonPlanStatus.DRAFT)
                .build();
    }

    @SuppressWarnings("unchecked")
    private List<LessonPlanDTO.LessonPhase> getLessonPhases(Object raw) {
        if (!(raw instanceof List<?>)) {
            return Collections.emptyList();
        }

        List<?> list = (List<?>) raw;

        return list.stream()
                .filter(item -> item instanceof Map)
                .map(item -> (Map<String, Object>) item)
                .map(map -> LessonPlanDTO.LessonPhase.builder()
                        .phase(getStr(map, "phase", ""))
                        .timeMinutes(getInt(map, "time_minutes", 0))
                        .activities(getStr(map, "activities", ""))
                        .teacherActions(getStr(map, "teacher_actions", ""))
                        .studentActions(getStr(map, "student_actions", ""))
                        .build())
                .collect(Collectors.toList());
    }

    @SuppressWarnings("unchecked")
    private LessonPlanDTO.AssessmentDetail getAssessment(Object raw) {
        if (!(raw instanceof Map<?, ?>)) {
            return LessonPlanDTO.AssessmentDetail.builder()
                    .methods(Collections.emptyList())
                    .criteria("")
                    .build();
        }

        Map<String, Object> map = (Map<String, Object>) raw;

        return LessonPlanDTO.AssessmentDetail.builder()
                .methods(getStrList(map, "methods"))
                .criteria(getStr(map, "criteria", ""))
                .build();
    }

    private String getStr(Map<String, Object> map, String key, String defaultVal) {
        Object val = map.get(key);
        return val != null ? val.toString() : defaultVal;
    }

    private List<String> getStrList(Map<String, Object> raw, String key) {
        Object val = raw.get(key);
        if (val instanceof List<?>) {
            List<?> list = (List<?>) val;
            return list.stream()
                    .filter(v -> v != null)
                    .map(Object::toString)
                    .collect(Collectors.toList());
        }
        return Collections.emptyList();
    }

    private int getInt(Map<String, Object> raw, String key, int defaultVal) {
        Object val = raw.get(key);

        if (val instanceof Number) {
            return ((Number) val).intValue();
        }

        if (val instanceof String) {
            try {
                return Integer.parseInt((String) val);
            } catch (Exception ignored) {
            }
        }

        return defaultVal;
    }

    private <T extends Enum<T>> T parseEnum(Class<T> enumClass, String value, T defaultVal) {
        try {
            return Enum.valueOf(enumClass, value.toUpperCase(Locale.ROOT));
        } catch (Exception e) {
            return defaultVal;
        }
    }
}
