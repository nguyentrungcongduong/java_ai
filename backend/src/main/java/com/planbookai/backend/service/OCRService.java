package com.planbookai.backend.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.planbookai.backend.dto.AnswerSheetDTO;
import com.planbookai.backend.exception.AIServiceException;
import com.planbookai.backend.exception.ResourceNotFoundException;
import com.planbookai.backend.mapper.AnswerSheetMapper;
import com.planbookai.backend.model.entity.AnswerSheet;
import com.planbookai.backend.model.entity.User;
import com.planbookai.backend.repository.AnswerSheetRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class OCRService {

    private static final Pattern JSON_FENCE_PATTERN =
            Pattern.compile("```(?:json)?\\s*([\\[\\{].*?[\\]\\}])\\s*```", Pattern.DOTALL);

    private final AnswerSheetRepository answerSheetRepository;
    private final AnswerSheetFileLoader answerSheetFileLoader;
    private final GeminiVisionClient geminiVisionClient;
    private final ObjectMapper objectMapper;
    private final AnswerSheetAccessGuard accessGuard;

    @Autowired
    public OCRService(
            AnswerSheetRepository answerSheetRepository,
            AnswerSheetFileLoader answerSheetFileLoader,
            GeminiVisionClient geminiVisionClient,
            ObjectMapper objectMapper,
            AnswerSheetAccessGuard accessGuard) {
        this.answerSheetRepository = answerSheetRepository;
        this.answerSheetFileLoader = answerSheetFileLoader;
        this.geminiVisionClient = geminiVisionClient;
        this.objectMapper = objectMapper;
        this.accessGuard = accessGuard;
    }

    public OCRService(
            AnswerSheetRepository answerSheetRepository,
            AnswerSheetFileLoader answerSheetFileLoader,
            GeminiVisionClient geminiVisionClient,
            ObjectMapper objectMapper) {
        this(
                answerSheetRepository,
                answerSheetFileLoader,
                geminiVisionClient,
                objectMapper,
                new AnswerSheetAccessGuard());
    }

    @Transactional
    public AnswerSheetDTO processAnswerSheet(Long answerSheetId, User user) {
        accessGuard.requireTeacher(user, "Only teacher can process answer sheets");

        AnswerSheet answerSheet = answerSheetRepository.findByIdForUpdate(answerSheetId)
                .orElseThrow(() -> new ResourceNotFoundException("Answer sheet not found: " + answerSheetId));
        accessGuard.requireOwnedAnswerSheet(answerSheet, user, "You do not have permission to process this answer sheet");

        if (answerSheet.getOcrStatus() == AnswerSheet.OcrStatus.PROCESSING) {
            throw new IllegalArgumentException("Answer sheet is already being processed");
        }

        if (answerSheet.getOcrStatus() == AnswerSheet.OcrStatus.COMPLETED
                && hasText(answerSheet.getOcrRawData())) {
            return AnswerSheetMapper.toDTO(answerSheet);
        }

        answerSheet.setOcrStatus(AnswerSheet.OcrStatus.PROCESSING);
        answerSheetRepository.save(answerSheet);

        try {
            AnswerSheetFileLoader.LoadedAnswerSheetFile loadedFile =
                    answerSheetFileLoader.load(answerSheet.getFileUrl());
            String rawJson = geminiVisionClient.extractAnswerSheetJson(
                    loadedFile.getContent(),
                    loadedFile.getMimeType(),
                    buildOcrPrompt());

            applyOcrResult(answerSheet, rawJson);
            answerSheet.setOcrStatus(AnswerSheet.OcrStatus.COMPLETED);
            return AnswerSheetMapper.toDTO(answerSheetRepository.save(answerSheet));
        } catch (RuntimeException ex) {
            markFailed(answerSheet, ex.getMessage());
            if (ex instanceof AIServiceException) {
                throw ex;
            }
            throw new AIServiceException("OCR processing failed: " + ex.getMessage(), ex);
        }
    }

    private void applyOcrResult(AnswerSheet answerSheet, String rawJson) {
        Map<String, Object> parsed = parseOcrJson(rawJson);
        answerSheet.setOcrRawData(writeJson(parsed));

        String studentName = firstNonBlank(parsed, "student_name", "studentName");
        String studentCode = firstNonBlank(parsed, "student_code", "studentCode");

        answerSheet.setStudentName(studentName);
        answerSheet.setStudentCode(studentCode);
    }

    private Map<String, Object> parseOcrJson(String rawJson) {
        String cleanedJson = cleanJsonResponse(rawJson);

        try {
            Map<String, Object> parsed = objectMapper.readValue(
                    cleanedJson,
                    new TypeReference<Map<String, Object>>() {
                    });
            if (parsed == null || parsed.isEmpty()) {
                throw new AIServiceException("Gemini Vision returned empty OCR JSON");
            }
            return parsed;
        } catch (AIServiceException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new AIServiceException("Gemini Vision returned invalid OCR JSON", ex);
        }
    }

    private void markFailed(AnswerSheet answerSheet, String message) {
        answerSheet.setOcrStatus(AnswerSheet.OcrStatus.FAILED);
        answerSheet.setOcrRawData(writeJson(Map.of("error", message != null ? message : "OCR processing failed")));
        answerSheetRepository.save(answerSheet);
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to serialize OCR result", ex);
        }
    }

    private String cleanJsonResponse(String raw) {
        if (raw == null) {
            return "{}";
        }

        String cleaned = raw.trim();
        Matcher matcher = JSON_FENCE_PATTERN.matcher(cleaned);
        if (matcher.find()) {
            return matcher.group(1).trim();
        }

        return cleaned.replaceAll("```json|```", "").trim();
    }

    /**
     * Lưu đáp án đã được giáo viên chỉnh sửa thủ công vào DB.
     *
     * <p>Body request: {@code { "answers": [{"question_number":"3","answer":"A"}, ...] }}
     * <p>Logic: merge override vào answers list của ocrRawData hiện tại, ghi đè theo question_number.
     */
    @Transactional
    public AnswerSheetDTO saveOcrAnswers(Long answerSheetId, Map<String, Object> body, User user) {
        accessGuard.requireTeacher(user, "Only teacher can update answer sheets");

        AnswerSheet answerSheet = answerSheetRepository.findById(answerSheetId)
                .orElseThrow(() -> new ResourceNotFoundException("Answer sheet not found: " + answerSheetId));
        accessGuard.requireOwnedAnswerSheet(answerSheet, user, "You do not have permission to update this answer sheet");

        // Parse existing OCR data
        Map<String, Object> ocrMap;
        try {
            String raw = answerSheet.getOcrRawData();
            if (raw == null || raw.isBlank()) {
                ocrMap = new java.util.LinkedHashMap<>();
            } else {
                ocrMap = objectMapper.readValue(raw, new TypeReference<Map<String, Object>>() {});
            }
        } catch (Exception e) {
            ocrMap = new java.util.LinkedHashMap<>();
        }

        // Extract overrides from request body
        Object overridesObj = body.get("answers");
        if (overridesObj instanceof List<?> overrideList) {
            // Build map from existing answers keyed by question_number
            List<Map<String, Object>> existingAnswers;
            try {
                Object ex = ocrMap.get("answers");
                existingAnswers = ex != null
                        ? objectMapper.convertValue(ex, new TypeReference<List<Map<String, Object>>>() {})
                        : new ArrayList<>();
            } catch (Exception e) {
                existingAnswers = new ArrayList<>();
            }

            // Merge: override by question_number
            Map<String, Map<String, Object>> answerMapByNum = new java.util.LinkedHashMap<>();
            for (Map<String, Object> a : existingAnswers) {
                answerMapByNum.put(String.valueOf(a.get("question_number")), a);
            }
            for (Object o : overrideList) {
                if (o instanceof Map<?, ?> ov) {
                    String num = String.valueOf(ov.get("question_number"));
                    Object ans = ov.get("answer");
                    Map<String, Object> entry = answerMapByNum.getOrDefault(num, new java.util.LinkedHashMap<>());
                    entry.put("question_number", num);
                    entry.put("answer", ans);
                    entry.put("manually_corrected", true);
                    answerMapByNum.put(num, entry);
                }
            }

            ocrMap.put("answers", new ArrayList<>(answerMapByNum.values()));
        }

        // Serialize and save
        try {
            answerSheet.setOcrRawData(objectMapper.writeValueAsString(ocrMap));
        } catch (Exception e) {
            throw new AIServiceException("Failed to serialize corrected OCR data: " + e.getMessage(), e);
        }

        return AnswerSheetMapper.toDTO(answerSheetRepository.save(answerSheet));
    }

    private String buildOcrPrompt() {
        return """
                You are an expert OCR engine specialized in reading Vietnamese multiple-choice exam answer sheets.
                Your ONLY task: for each question number, identify EXACTLY which letter (A, B, C, or D) the student has CIRCLED or MARKED.

                LAYOUT OF VIETNAMESE MULTIPLE-CHOICE EXAM:
                Each question typically has 4 options arranged in ONE of these layouts:
                  Layout 1 (2-column): A and B are on the LEFT column, C and D are on the RIGHT column.
                     A. [text]          C. [text]
                     B. [text]          D. [text]
                  Layout 2 (single column): A, B, C, D are stacked vertically.
                  Layout 3 (2-row): A and C on top row, B and D on bottom row (or any variation).
                  
                IMPORTANT: Do NOT assume A=top-left, B=top-right, C=bottom-left, D=bottom-right.
                Instead, read the LETTER LABEL next to the circled option directly from the paper.

                STRICT RULES:
                1. Scan each question number (1, 2, 3, ...) from top to bottom, left column first, then right column.
                2. For each question, find the option where the student has drawn a circle, oval, or ink mark AROUND or THROUGH the letter label or its text.
                3. Read the LETTER (A/B/C/D) that appears directly at the marked option — do NOT infer from position alone.
                4. Return only a single uppercase letter: "A", "B", "C", or "D".
                   If a question is blank or truly unreadable, set "answer" to null.
                5. Do NOT guess from question content or context. Only look at the physical circle/mark on paper.
                6. A larger circle or scribble = student's choice. A printed bubble without ink = not chosen.
                7. If the exam sheet has two columns of questions, process LEFT column first top-to-bottom, then RIGHT column top-to-bottom.

                Return ONLY a raw JSON object. No markdown, no text outside JSON:
                {
                  "student_name": "string or null",
                  "student_code": "string or null",
                  "answers": [
                    { "question_number": "1", "answer": "A" },
                    { "question_number": "2", "answer": "B" }
                  ],
                  "notes": ["note any uncertain questions here, or empty array"]
                }
                """;
    }

    private String firstNonBlank(Map<String, Object> values, String... keys) {
        for (String key : keys) {
            Object value = values.get(key);
            if (value == null) {
                continue;
            }
            String text = value.toString().trim();
            if (!text.isEmpty() && !"null".equalsIgnoreCase(text)) {
                return text;
            }
        }
        return null;
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
