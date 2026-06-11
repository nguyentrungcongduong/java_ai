package com.planbookai.backend.service;

import com.planbookai.backend.dto.AIGenerateExamRequest;
import com.planbookai.backend.dto.ExamDTO;
import com.planbookai.backend.dto.QuestionDTO;
import com.planbookai.backend.exception.ForbiddenOperationException;
import com.planbookai.backend.exception.ResourceNotFoundException;
import com.planbookai.backend.model.entity.*;
import com.planbookai.backend.repository.ExamQuestionRepository;
import com.planbookai.backend.repository.ExamRepository;
import com.planbookai.backend.repository.QuestionBankRepository;
import com.planbookai.backend.repository.QuestionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * ExamService – Xử lý nghiệp vụ tạo, quản lý và sinh đề thi bằng AI.
 *
 * <h2>Luồng aiGenerateExam() (KAN-23)</h2>
 * <ol>
 *   <li><b>difficulty_mix mode:</b> Với mỗi mức độ khó (EASY/MEDIUM/HARD) trong map:
 *       <ul>
 *         <li>Lấy câu từ bank lọc theo bank_id + difficulty + topic.</li>
 *         <li>Tính gap per-difficulty → gọi AI sinh bù.</li>
 *       </ul>
 *   </li>
 *   <li><b>single difficulty mode:</b> Hành vi cũ – lấy từ bank theo difficulty đơn, AI fill gap.</li>
 *   <li><b>Tạo Exam entity:</b> Gắn tất cả câu theo thứ tự (BANK trước, AI sau mỗi nhóm).</li>
 *   <li><b>Trả về ExamDTO</b> kèm metadata source (BANK | AI) trên từng câu.</li>
 * </ol>
 */
@Service
public class ExamService {

    private static final Logger log = LoggerFactory.getLogger(ExamService.class);

    private final ExamRepository examRepository;
    private final ExamQuestionRepository examQuestionRepository;
    private final QuestionRepository questionRepository;
    private final QuestionBankRepository questionBankRepository;
    private final QuestionService questionService;
    private final GeminiAIService geminiAIService;

    public ExamService(
            ExamRepository examRepository,
            ExamQuestionRepository examQuestionRepository,
            QuestionRepository questionRepository,
            QuestionBankRepository questionBankRepository,
            QuestionService questionService,
            GeminiAIService geminiAIService) {
        this.examRepository = examRepository;
        this.examQuestionRepository = examQuestionRepository;
        this.questionRepository = questionRepository;
        this.questionBankRepository = questionBankRepository;
        this.questionService = questionService;
        this.geminiAIService = geminiAIService;
    }

    // =========================================================================
    // READ
    // =========================================================================

    /**
     * Lấy danh sách đề của một teacher (phân trang, lọc theo môn + status).
     */
    public com.planbookai.backend.dto.PageResponse<ExamDTO> getMyExams(
            User teacher,
            int page,
            int size,
            String subject,
            String status) {

        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Exam.ExamStatus examStatus = parseStatus(status);

        Page<Exam> examPage = examRepository.findByTeacherWithFilters(
                teacher.getId(), subject, examStatus, pageable);

        return com.planbookai.backend.dto.PageResponse.from(examPage.map(this::toSummaryDTO));
    }

    /**
     * Xem chi tiết một đề thi (kèm danh sách câu hỏi đầy đủ).
     */
    public ExamDTO getExamDetail(Long examId, User teacher) {
        Exam exam = findExamOrThrow(examId);
        assertOwner(exam, teacher);
        return toDetailDTO(exam);
    }

    // =========================================================================
    // AI GENERATE EXAM  (KAN-23)
    // POST /api/v1/exams/ai-generate
    // =========================================================================

    /**
     * Sinh đề thi tự động bằng cách kết hợp câu hỏi từ bank và AI.
     *
     * <p>Hỗ trợ hai chế độ:
     * <ul>
     *   <li><b>difficulty_mix mode</b> (ưu tiên): Phân bổ câu theo từng mức độ khó.</li>
     *   <li><b>single difficulty mode</b>: Toàn đề cùng một mức độ khó.</li>
     * </ul>
     *
     * @param request Tham số sinh đề (subject, grade_level, topic, total_questions,
     *                difficulty_mix, bank_id)
     * @param teacher Giáo viên yêu cầu
     * @return ExamDTO đầy đủ với danh sách câu hỏi (nguồn gốc BANK + AI)
     */
    @Transactional
    public ExamDTO aiGenerateExam(AIGenerateExamRequest request, User teacher) {

        List<Question> bankQuestions;
        List<Question> aiQuestions;

        if (request.hasDifficultyMix()) {
            // ----------------------------------------------------------------
            // MODE A: difficulty_mix – sinh theo từng mức độ khó
            // ----------------------------------------------------------------
            DifficultyMixResult result = processWithDifficultyMix(request, teacher);
            bankQuestions = result.bankQuestions();
            aiQuestions   = result.aiQuestions();
        } else {
            // ----------------------------------------------------------------
            // MODE B: single difficulty – hành vi cũ
            // ----------------------------------------------------------------
            SingleDifficultyResult result = processWithSingleDifficulty(request, teacher);
            bankQuestions = result.bankQuestions();
            aiQuestions   = result.aiQuestions();
        }

        // ----------------------------------------------------------------
        // Tạo Exam entity + gắn câu hỏi
        // ----------------------------------------------------------------
        Exam exam = buildExam(request, teacher);
        exam = examRepository.save(exam);

        List<ExamQuestion> examQList = buildExamQuestions(exam, bankQuestions, aiQuestions);
        examQuestionRepository.saveAll(examQList);

        exam.setTotalQuestions(examQList.size());
        exam.setUpdatedAt(LocalDateTime.now());
        exam = examRepository.save(exam);

        log.info("[ExamService][aiGenerateExam] Exam #{} created: {} from bank, {} from AI",
                exam.getId(), bankQuestions.size(), aiQuestions.size());

        return toDetailDTO(exam);
    }

    // =========================================================================
    // Private – Mode A: difficulty_mix
    // =========================================================================

    /**
     * Xử lý sinh đề theo difficulty_mix:
     * với mỗi cặp (difficulty, count) trong map, lấy câu từ bank rồi AI fill gap.
     */
    private DifficultyMixResult processWithDifficultyMix(AIGenerateExamRequest request, User teacher) {
        List<Question> allBankSelected = new ArrayList<>();
        List<Question> allAiGenerated  = new ArrayList<>();

        // Fetch toàn bộ câu ứng cử từ bank (nếu có bank_id)
        List<Question> poolFromBank = fetchFromBankById(request);

        for (Map.Entry<String, Integer> entry : request.getDifficultyMix().entrySet()) {
            Question.Difficulty diff = parseDifficulty(entry.getKey());
            int needed = (entry.getValue() != null && entry.getValue() > 0) ? entry.getValue() : 0;

            if (needed == 0) continue;

            if (diff == null) {
                log.warn("[ExamService][difficultyMix] Unknown difficulty key '{}' – skipping", entry.getKey());
                continue;
            }

            // Lọc pool theo difficulty
            final Question.Difficulty finalDiff = diff;
            List<Question> poolForDiff = poolFromBank.stream()
                    .filter(q -> finalDiff.equals(q.getDifficulty()))
                    .collect(Collectors.toList());

            Collections.shuffle(poolForDiff);
            List<Question> selected = poolForDiff.stream().limit(needed).toList();
            allBankSelected.addAll(selected);

            int gap = needed - selected.size();
            log.info("[ExamService][difficultyMix] difficulty={} needed={} bank={} gap={}",
                    diff, needed, selected.size(), gap);

            if (gap > 0) {
                List<String> existingContents = selected.stream()
                        .map(Question::getContent)
                        .toList();

                List<QuestionDTO> aiDTOs = geminiAIService.generateExamGapQuestions(
                        request.getSubject(),
                        request.getTopic(),
                        diff,
                        request.getQuestionType(),
                        gap,
                        existingContents);

                List<Question> saved = persistAIQuestions(aiDTOs, request.getBankId(), teacher);
                allAiGenerated.addAll(saved);
            }
        }

        return new DifficultyMixResult(allBankSelected, allAiGenerated);
    }

    /**
     * Internal record – kết quả của processWithDifficultyMix.
     */
    private record DifficultyMixResult(List<Question> bankQuestions, List<Question> aiQuestions) {}

    // =========================================================================
    // Private – Mode B: single difficulty
    // =========================================================================

    private SingleDifficultyResult processWithSingleDifficulty(AIGenerateExamRequest request, User teacher) {
        int total = request.getTotalQuestions();

        List<Question> bankPool = fetchFromBankById(request);

        // Lọc theo difficulty đơn
        Question.Difficulty diff = request.getDifficulty();
        if (diff != null) {
            bankPool = bankPool.stream()
                    .filter(q -> diff.equals(q.getDifficulty()))
                    .collect(Collectors.toList());
        }

        Collections.shuffle(bankPool);
        List<Question> selected = bankPool.stream().limit(total).toList();

        int gap = total - selected.size();
        log.info("[ExamService][single] Bank={} gap={}", selected.size(), gap);

        List<Question> aiQuestions = new ArrayList<>();
        if (gap > 0) {
            List<String> existingContents = selected.stream().map(Question::getContent).toList();
            List<QuestionDTO> aiDTOs = geminiAIService.generateExamGapQuestions(
                    request.getSubject(),
                    request.getTopic(),
                    request.getDifficulty(),
                    request.getQuestionType(),
                    gap,
                    existingContents);
            aiQuestions = persistAIQuestions(aiDTOs, request.getBankId(), teacher);
        }

        return new SingleDifficultyResult(selected, aiQuestions);
    }

    private record SingleDifficultyResult(List<Question> bankQuestions, List<Question> aiQuestions) {}

    // =========================================================================
    // Private helpers – Bank fetching
    // =========================================================================

    /**
     * Lấy tất cả câu hỏi đã duyệt từ bank theo {@code bank_id} + topic filter.
     *
     * <p>Nếu {@code bank_id} null, trả về danh sách rỗng (AI sinh toàn bộ).
     */
    private List<Question> fetchFromBankById(AIGenerateExamRequest request) {
        if (request.getBankId() == null) {
            log.info("[ExamService] No bank_id provided – AI will generate all questions");
            return new ArrayList<>();
        }

        // Validate: bank phải tồn tại
        QuestionBank bank = questionBankRepository.findById(request.getBankId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Ngân hàng câu hỏi không tồn tại: bank_id=" + request.getBankId()));

        // Validate: môn học của bank phải khớp với môn của đề thi
        // Dùng normalize để bỏ dấu tiếng Việt trước khi so sánh
        // VD: "Hoa hoc" == "Hóa học" sau normalize
        if (bank.getSubject() != null && request.getSubject() != null) {
            String bankSubjectNorm = java.text.Normalizer
                    .normalize(bank.getSubject(), java.text.Normalizer.Form.NFD)
                    .replaceAll("\\p{M}", "")
                    .replaceAll("đ", "d").replaceAll("Đ", "D")
                    .trim().toLowerCase();
            String reqSubjectNorm = java.text.Normalizer
                    .normalize(request.getSubject(), java.text.Normalizer.Form.NFD)
                    .replaceAll("\\p{M}", "")
                    .replaceAll("đ", "d").replaceAll("Đ", "D")
                    .trim().toLowerCase();
            if (!bankSubjectNorm.equals(reqSubjectNorm)) {
                throw new IllegalArgumentException(
                        "Môn học không khớp: ngân hàng câu hỏi \"" + bank.getName() +
                        "\" thuộc môn \"" + bank.getSubject() +
                        "\" nhưng đề thi yêu cầu môn \"" + request.getSubject() + "\". " +
                        "Vui lòng chọn đúng ngân hàng câu hỏi hoặc bỏ trống bank_id để AI sinh toàn bộ câu.");
            }
        }

        log.info("[ExamService] Fetching questions from bank id={} name='{}' subject='{}'",
                bank.getId(), bank.getName(), bank.getSubject());

        return questionRepository.findByBankId(request.getBankId())
                .stream()
                .filter(q -> q.getIsApproved() != null && q.getIsApproved())
                .filter(q -> matchesType(q, request.getQuestionType()))
                .filter(q -> matchesTopic(q, request.getTopic()))
                .collect(Collectors.toList()); // mutable list để shuffle
    }


    private boolean matchesType(Question q, Question.QuestionType type) {
        if (type == null) return true;
        return type.equals(q.getType());
    }

    private boolean matchesTopic(Question q, String topic) {
        if (topic == null || topic.isBlank()) return true;
        if (q.getTopic() == null) return false;
        return q.getTopic().toLowerCase().contains(topic.toLowerCase());
    }

    // =========================================================================
    // Private helpers – AI question persistence
    // =========================================================================

    /**
     * Lưu danh sách câu hỏi AI-generated vào ngân hàng câu hỏi.
     *
     * <p><b>Bank resolution (3 tầng):</b>
     * <ol>
     *   <li>Dùng {@code targetBankId} nếu cung cấp và tìm thấy trong DB.</li>
     *   <li>Fallback: bank đầu tiên của teacher ({@code findFirstByCreatedById}).</li>
     *   <li>Nếu teacher không có bank nào → throw {@link ResourceNotFoundException}.</li>
     * </ol>
     *
     * <p>AI questions <b>luôn phải được persist</b> trước khi tạo {@code exam_questions},
     * vì {@code exam_questions.question_id} là NOT NULL FK → transient Question sẽ gây lỗi.
     *
     * @param aiDTOs       Danh sách QuestionDTO từ Gemini
     * @param targetBankId ID ngân hàng muốn lưu (nullable)
     * @param teacher      Giáo viên tạo
     * @return Danh sách Question entity đã lưu vào DB
     * @throws ResourceNotFoundException nếu không resolve được bank nào
     */
    private List<Question> persistAIQuestions(
            List<QuestionDTO> aiDTOs,
            Integer targetBankId,
            User teacher) {

        if (aiDTOs == null || aiDTOs.isEmpty()) {
            return new ArrayList<>();
        }

        // Resolve target bank – MUST be non-null (questions.bank_id NOT NULL)
        QuestionBank bank = resolveTargetBank(targetBankId, teacher);

        List<Question> toSave = aiDTOs.stream()
                .filter(dto -> dto != null && dto.getContent() != null && !dto.getContent().isBlank())
                .map(dto -> buildPersistableQuestion(dto, bank, teacher))
                .collect(Collectors.toList());

        List<Question> saved = questionRepository.saveAll(toSave);
        log.info("[ExamService] Persisted {} AI questions to bank id={} name='{}'",
                saved.size(), bank.getId(), bank.getName());
        return saved;
    }

    /**
     * Resolve ngân hàng câu hỏi để lưu AI-generated questions.
     *
     * <p>Thứ tự ưu tiên:
     * <ol>
     *   <li>Bank theo {@code targetBankId} (nếu cung cấp và tồn tại).</li>
     *   <li>Bank đầu tiên của teacher.</li>
     *   <li>Throw exception nếu teacher không có bank nào.</li>
     * </ol>
     */
    private QuestionBank resolveTargetBank(Integer targetBankId, User teacher) {
        // Tier 1 – explicit bankId
        if (targetBankId != null) {
            Optional<QuestionBank> explicit = questionBankRepository.findById(targetBankId);
            if (explicit.isPresent()) {
                return explicit.get();
            }
            log.warn("[ExamService] bank_id={} not found, falling back to teacher's default bank", targetBankId);
        }

        // Tier 2 – teacher's first bank
        Optional<QuestionBank> teacherBank = questionBankRepository.findFirstByCreatedById(teacher.getId());
        if (teacherBank.isPresent()) {
            log.info("[ExamService] Using teacher's default bank id={} as fallback", teacherBank.get().getId());
            return teacherBank.get();
        }

        // Tier 3 – no bank available → fail fast
        throw new ResourceNotFoundException(
                "Không tìm thấy ngân hàng câu hỏi để lưu câu AI. " +
                "Vui lòng tạo hoặc chỉ định bank_id hợp lệ trước khi sinh đề.");
    }

    private Question buildTransientQuestion(QuestionDTO dto, User teacher) {
        Question.QuestionType type = parseQuestionType(dto.getType());
        Question.Difficulty difficulty = parseDifficulty(dto.getDifficulty());
        return Question.builder()
                .content(dto.getContent())
                .type(type != null ? type : Question.QuestionType.MULTIPLE_CHOICE)
                .difficulty(difficulty != null ? difficulty : Question.Difficulty.MEDIUM)
                .topic(dto.getTopic())
                .options(dto.getOptions())
                .correctAnswer(dto.getCorrectAnswer())
                .explanation(dto.getExplanation())
                .aiGenerated(true)
                .isApproved(false)
                .createdBy(teacher)
                .build();
    }

    private Question buildPersistableQuestion(
            QuestionDTO dto,
            QuestionBank bank,
            User teacher) {
        Question q = buildTransientQuestion(dto, teacher);
        q.setBank(bank);
        return q;
    }

    // =========================================================================
    // Private helpers – Entity building
    // =========================================================================

    private Exam buildExam(AIGenerateExamRequest request, User teacher) {
        return Exam.builder()
                .teacher(teacher)
                .title(request.resolvedTitle())
                .subject(request.getSubject())
                .gradeLevel(request.getGradeLevel())
                .topic(request.getTopic())
                .durationMins(request.getDurationMins())
                .randomized(request.isRandomized())
                .aiGenerated(true)
                .status(Exam.ExamStatus.DRAFT)
                .build();
    }

    /**
     * Xây dựng danh sách ExamQuestion (junction entities).
     *
     * <p>Thứ tự: câu từ bank trước, câu AI theo sau.
     */
    private List<ExamQuestion> buildExamQuestions(
            Exam exam,
            List<Question> bankQuestions,
            List<Question> aiQuestions) {

        List<ExamQuestion> result = new ArrayList<>();
        int idx = 1;

        for (Question q : bankQuestions) {
            result.add(ExamQuestion.builder()
                    .exam(exam)
                    .question(q)
                    .orderIndex(idx++)
                    .versionNumber(1)
                    .points(BigDecimal.ONE)
                    .build());
        }

        for (Question q : aiQuestions) {
            result.add(ExamQuestion.builder()
                    .exam(exam)
                    .question(q)
                    .orderIndex(idx++)
                    .versionNumber(1)
                    .points(BigDecimal.ONE)
                    .build());
        }

        return result;
    }

    // =========================================================================
    // Private helpers – DTO mapping
    // =========================================================================

    private ExamDTO toSummaryDTO(Exam exam) {
        return ExamDTO.builder()
                .id(exam.getId())
                .teacherId(exam.getTeacher() != null ? exam.getTeacher().getId() : null)
                .teacherName(exam.getTeacher() != null ? exam.getTeacher().getFullName() : null)
                .title(exam.getTitle())
                .subject(exam.getSubject())
                .gradeLevel(exam.getGradeLevel())
                .topic(exam.getTopic())
                .totalQuestions(exam.getTotalQuestions())
                .durationMins(exam.getDurationMins())
                .randomized(exam.getRandomized())
                .versionCount(exam.getVersionCount())
                .status(exam.getStatus() != null ? exam.getStatus().name() : null)
                .aiGenerated(exam.getAiGenerated())
                .createdAt(exam.getCreatedAt())
                .updatedAt(exam.getUpdatedAt())
                .build();
    }

    private ExamDTO toDetailDTO(Exam exam) {
        ExamDTO dto = toSummaryDTO(exam);

        List<ExamQuestion> examQs = examQuestionRepository.findByExamIdOrderByOrderIndex(exam.getId());
        List<ExamDTO.ExamQuestionDTO> qDTOs = examQs.stream()
                .map(this::toExamQuestionDTO)
                .toList();

        dto.setQuestions(qDTOs);
        return dto;
    }

    private ExamDTO.ExamQuestionDTO toExamQuestionDTO(ExamQuestion eq) {
        String source = Boolean.TRUE.equals(
                eq.getQuestion() != null ? eq.getQuestion().getAiGenerated() : false)
                ? "AI" : "BANK";

        QuestionDTO questionDTO = eq.getQuestion() != null
                ? questionService.mapToQuestionDTO(eq.getQuestion())
                : null;

        return ExamDTO.ExamQuestionDTO.builder()
                .examQuestionId(eq.getId())
                .orderIndex(eq.getOrderIndex())
                .versionNumber(eq.getVersionNumber())
                .points(eq.getPoints())
                .source(source)
                .question(questionDTO)
                .build();
    }

    // =========================================================================
    // PUBLISH / DELETE
    // =========================================================================

    /** Publish đề thi (DRAFT → PUBLISHED). */
    @Transactional
    public ExamDTO publishExam(Long examId, User teacher) {
        Exam exam = findExamOrThrow(examId);
        assertOwner(exam, teacher);
        exam.setStatus(Exam.ExamStatus.PUBLISHED);
        exam.setUpdatedAt(LocalDateTime.now());
        return toSummaryDTO(examRepository.save(exam));
    }

    /** Xóa đề thi (cascade xóa exam_questions). */
    @Transactional
    public void deleteExam(Long examId, User teacher) {
        Exam exam = findExamOrThrow(examId);
        assertOwner(exam, teacher);
        examRepository.delete(exam);
    }

    // =========================================================================
    // Private helpers – lookup / validation
    // =========================================================================

    private Exam findExamOrThrow(Long examId) {
        return examRepository.findById(examId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam not found: " + examId));
    }

    private void assertOwner(Exam exam, User user) {
        if (exam.getTeacher() == null || !exam.getTeacher().getId().equals(user.getId())) {
            if (user.getRole() != null &&
                    (user.getRole().getName() == Role.RoleName.ADMIN
                            || user.getRole().getName() == Role.RoleName.MANAGER)) {
                return;
            }
            throw new ForbiddenOperationException("You do not have access to this exam");
        }
    }

    private Exam.ExamStatus parseStatus(String status) {
        if (status == null || status.isBlank()) return null;
        try {
            return Exam.ExamStatus.valueOf(status.toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private Question.QuestionType parseQuestionType(String type) {
        if (type == null) return null;
        try {
            return Question.QuestionType.valueOf(type.toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private Question.Difficulty parseDifficulty(String difficulty) {
        if (difficulty == null) return null;
        try {
            return Question.Difficulty.valueOf(difficulty.toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
