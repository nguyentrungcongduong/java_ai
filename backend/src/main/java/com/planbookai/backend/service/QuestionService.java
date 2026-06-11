package com.planbookai.backend.service;

import com.planbookai.backend.dto.AIGenerateQuestionsRequest;
import com.planbookai.backend.dto.PageResponse;
import com.planbookai.backend.dto.QuestionBankRequest;
import com.planbookai.backend.dto.QuestionCreateRequest;
import com.planbookai.backend.dto.QuestionDTO;
import com.planbookai.backend.dto.QuestionUpdateRequest;
import com.planbookai.backend.exception.ForbiddenOperationException;
import com.planbookai.backend.exception.ResourceNotFoundException;
import com.planbookai.backend.model.entity.Question;
import com.planbookai.backend.model.entity.QuestionBank;
import com.planbookai.backend.model.entity.Role;
import com.planbookai.backend.model.entity.Role.RoleName;
import com.planbookai.backend.model.entity.User;
import com.planbookai.backend.repository.QuestionBankRepository;
import com.planbookai.backend.repository.QuestionRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

@Service
public class QuestionService {

    private final QuestionBankRepository bankRepository;
    private final QuestionRepository questionRepository;
    private final GeminiAIService geminiAIService;

    public QuestionService(
            QuestionBankRepository bankRepository,
            QuestionRepository questionRepository,
            GeminiAIService geminiAIService) {
        this.bankRepository = bankRepository;
        this.questionRepository = questionRepository;
        this.geminiAIService = geminiAIService;
    }

    public List<QuestionDTO.QuestionBankDTO> getMyBanks(User user) {
        if (hasRole(user, Role.RoleName.ADMIN) || hasRole(user, Role.RoleName.MANAGER)) {
            return getAllBanks();
        }
        // Lấy bank của chính mình
        List<QuestionBank> ownBanks = bankRepository.findByCreatedById(user.getId());
        // Lấy bank công khai của người khác
        List<QuestionBank> publicBanks = bankRepository.findByIsPublishedTrue().stream()
                .filter(b -> b.getCreatedBy() == null || !b.getCreatedBy().getId().equals(user.getId()))
                .toList();

        return java.util.stream.Stream.concat(ownBanks.stream(), publicBanks.stream())
                .map(b -> mapToBankDTOWithOwner(b, user.getId()))
                .toList();
    }


    public QuestionDTO.QuestionBankDTO getBank(Integer id, User user) {
        QuestionBank bank = findBankOrThrow(id);
        assertCanReadBank(bank, user);
        return mapToBankDTO(bank);
    }

    public List<QuestionDTO.QuestionBankDTO> getAllBanks() {
        return bankRepository.findAll().stream()
                .map(this::mapToBankDTO)
                .toList();
    }

    @Transactional
    public QuestionDTO.QuestionBankDTO createBank(QuestionBankRequest request, User user) {
        assertCanCreateBank(user);

        QuestionBank bank = new QuestionBank();
        bank.setName(request.getName());
        bank.setSubject(request.getSubject());
        bank.setGradeLevel(request.getGradeLevel());
        bank.setDescription(request.getDescription());
        bank.setCreatedBy(user);
        bank.setIsPublished(Boolean.TRUE.equals(request.getIsPublished()));

        return mapToBankDTO(bankRepository.save(bank));
    }

    @Transactional
    public QuestionDTO.QuestionBankDTO updateBank(Integer id, QuestionBankRequest request, User user) {
        QuestionBank bank = findBankOrThrow(id);
        assertCanManageBank(bank, user);

        bank.setName(request.getName());
        bank.setSubject(request.getSubject());
        bank.setGradeLevel(request.getGradeLevel());
        bank.setDescription(request.getDescription());
        if (request.getIsPublished() != null) {
            bank.setIsPublished(request.getIsPublished());
        }

        return mapToBankDTO(bankRepository.save(bank));
    }

    @Transactional
    public void deleteBank(Integer id, User user) {
        QuestionBank bank = findBankOrThrow(id);
        assertCanManageBank(bank, user);
        bankRepository.delete(bank);
    }

    /**
     * Lấy danh sách câu hỏi lọc theo trạng thái phê duyệt.
     *
     * @param approved null = tất cả, true = đã duyệt, false = chờ duyệt
     * @return Danh sách QuestionDTO
     */
    public List<QuestionDTO> getQuestionsByApprovalStatus(Boolean approved) {
        List<Question> questions;
        if (approved == null) {
            questions = questionRepository.findAll();
        } else {
            questions = questionRepository.findByIsApproved(approved);
        }
        return questions.stream().map(this::mapToQuestionDTO).toList();
    }

    public PageResponse<QuestionDTO> getQuestionsByBank(
            Integer bankId,
            User user,
            Integer page,
            Integer size,
            String topic,
            String difficulty,
            String type) {
        QuestionBank bank = findBankOrThrow(bankId);
        assertCanReadBank(bank, user);

        validatePageRequest(page, size);

        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Question> questionsPage = questionRepository.findByBankIdWithFilters(
                bankId,
                normalizeFilter(topic),
                parseDifficulty(difficulty),
                parseQuestionType(type),
                pageable);

        return PageResponse.from(questionsPage.map(this::mapToQuestionDTO));
    }

    @Transactional
    public QuestionDTO createQuestion(QuestionCreateRequest request, User user) {
        QuestionBank bank = findBankOrThrow(request.getBankId());
        assertCanManageBank(bank, user);

        Question question = new Question();
        question.setBank(bank);
        question.setCreatedBy(user);
        question.setAiGenerated(false);
        question.setIsApproved(false);
        applyCreateRequest(question, request);

        return mapToQuestionDTO(questionRepository.save(question));
    }

    public QuestionDTO getQuestionById(Long id, User user) {
        Question question = findQuestionOrThrow(id);
        assertCanReadQuestion(question, user);
        return mapToQuestionDTO(question);
    }

    @Transactional
    public QuestionDTO updateQuestion(Long id, QuestionUpdateRequest request, User user) {
        Question question = findQuestionOrThrow(id);
        assertCanManageQuestion(question, user);

        question.setContent(request.getContent());
        question.setType(request.getType());

        if (request.getDifficulty() != null) {
            question.setDifficulty(request.getDifficulty());
        }
        if (request.getTopic() != null) {
            question.setTopic(request.getTopic());
        }
        if (request.getOptions() != null || request.getType() != Question.QuestionType.MULTIPLE_CHOICE) {
            question.setOptions(request.getType() == Question.QuestionType.MULTIPLE_CHOICE ? request.getOptions() : null);
        }
        if (request.getCorrectAnswer() != null) {
            question.setCorrectAnswer(request.getCorrectAnswer());
        }
        if (request.getExplanation() != null) {
            question.setExplanation(request.getExplanation());
        }

        return mapToQuestionDTO(questionRepository.save(question));
    }

    @Transactional
    public void deleteQuestion(Long id, User user) {
        Question question = findQuestionOrThrow(id);
        assertCanManageQuestion(question, user);
        questionRepository.delete(question);
    }

    @Transactional
    public List<QuestionDTO> aiGenerateQuestions(AIGenerateQuestionsRequest request, User user) {
        QuestionBank bank = findBankOrThrow(request.getBankId());
        assertCanManageBank(bank, user);

        List<QuestionDTO> generated = geminiAIService.generateQuestions(
                request.getSubject(),
                request.getTopic(),
                request.getDifficulty(),
                request.getType(),
                request.getCount());

        if (!request.isSaveToDb()) {
            generated.forEach(dto -> {
                dto.setBankId(bank.getId());
                dto.setBankName(bank.getName());
            });
            return generated;
        }

        List<Question> toSave = generated.stream()
                .map(dto -> buildQuestionEntity(dto, bank, user))
                .toList();
        
        // Đánh dấu là AI Generated cho chắc chắn trước khi lưu
        toSave.forEach(q -> q.setAiGenerated(true));

        List<Question> saved = questionRepository.saveAll(toSave);
        return saved.stream().map(this::mapToQuestionDTO).toList();
    }

    @Transactional
    public List<QuestionDTO> savePreviewedQuestions(Integer bankId, List<QuestionDTO> questions, User user) {
        validatePreviewSaveRequest(bankId, questions);

        QuestionBank bank = findBankOrThrow(bankId);
        assertCanManageBank(bank, user);

        List<Question> toSave = questions.stream()
                .map(dto -> buildQuestionEntity(dto, bank, user))
                .toList();

        List<Question> saved = questionRepository.saveAll(toSave);
        return saved.stream().map(this::mapToQuestionDTO).toList();
    }

    private QuestionBank findBankOrThrow(Integer id) {
        return bankRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Question bank not found: " + id));
    }

    private Question findQuestionOrThrow(Long id) {
        return questionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Question not found: " + id));
    }

    private QuestionDTO.QuestionBankDTO mapToBankDTO(QuestionBank bank) {
        return mapToBankDTOWithOwner(bank, null);
    }

    private QuestionDTO.QuestionBankDTO mapToBankDTOWithOwner(QuestionBank bank, Long currentUserId) {
        Long ownerId = bank.getCreatedBy() != null ? bank.getCreatedBy().getId() : null;
        boolean isOwn = currentUserId != null && currentUserId.equals(ownerId);
        return QuestionDTO.QuestionBankDTO.builder()
                .id(bank.getId())
                .name(bank.getName())
                .subject(bank.getSubject())
                .gradeLevel(bank.getGradeLevel())
                .description(bank.getDescription())
                .createdById(ownerId)
                .createdByName(bank.getCreatedBy() != null ? bank.getCreatedBy().getFullName() : null)
                .isPublished(bank.getIsPublished())
                .isOwnBank(isOwn)
                .createdAt(bank.getCreatedAt())
                .build();
    }

    private void assertCanCreateBank(User user) {
        requireAuthenticatedUser(user);
        if (hasRole(user, Role.RoleName.TEACHER) || hasRole(user, Role.RoleName.STAFF)) {
            return;
        }
        throw new ForbiddenOperationException("Only teacher or staff can create question banks");
    }

    private void assertCanReadBank(QuestionBank bank, User user) {
        requireAuthenticatedUser(user);
        if (canReadBank(bank, user)) {
            return;
        }
        throw new ForbiddenOperationException("You do not have permission to access this question bank");
    }

    private void assertCanManageBank(QuestionBank bank, User user) {
        requireAuthenticatedUser(user);
        if (canManageBank(bank, user)) {
            return;
        }
        throw new ForbiddenOperationException("You do not have permission to manage this question bank");
    }

    private void assertCanReadQuestion(Question question, User user) {
        assertCanReadBank(question.getBank(), user);
    }

    private void assertCanManageQuestion(Question question, User user) {
        assertCanManageBank(question.getBank(), user);
    }

    private boolean canReadBank(QuestionBank bank, User user) {
        return bank != null && (canManageBank(bank, user) || Boolean.TRUE.equals(bank.getIsPublished()));
    }

    private boolean canManageBank(QuestionBank bank, User user) {
        if (bank == null || user == null) {
            return false;
        }
        if (hasRole(user, Role.RoleName.ADMIN) || hasRole(user, Role.RoleName.MANAGER)) {
            return true;
        }
        Long ownerId = bank.getCreatedBy() != null ? bank.getCreatedBy().getId() : null;
        return ownerId != null && ownerId.equals(user.getId());
    }

    private boolean hasRole(User user, Role.RoleName roleName) {
        return user != null
                && user.getRole() != null
                && user.getRole().getName() == roleName;
    }

    private void requireAuthenticatedUser(User user) {
        if (user == null || user.getId() == null) {
            throw new ForbiddenOperationException("Authentication is required");
        }
    }

    private void validatePageRequest(Integer page, Integer size) {
        if (page == null || page < 0) {
            throw new IllegalArgumentException("page must be greater than or equal to 0");
        }
        if (size == null || size <= 0) {
            throw new IllegalArgumentException("size must be greater than 0");
        }
        if (size > 100) {
            throw new IllegalArgumentException("size must not exceed 100");
        }
    }

    private void validatePreviewSaveRequest(Integer bankId, List<QuestionDTO> questions) {
        if (bankId == null) {
            throw new IllegalArgumentException("bankId is required");
        }
        if (questions == null || questions.isEmpty()) {
            throw new IllegalArgumentException("questions must not be empty");
        }
        for (int i = 0; i < questions.size(); i++) {
            if (questions.get(i) == null) {
                throw new IllegalArgumentException("questions[" + i + "] must not be null");
            }
        }
    }

    private String normalizeFilter(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private Question.Difficulty parseDifficulty(String value) {
        return parseEnum(value, Question.Difficulty.class, "difficulty");
    }

    private Question.QuestionType parseQuestionType(String value) {
        return parseEnum(value, Question.QuestionType.class, "type");
    }

    private <T extends Enum<T>> T parseRequiredEnum(String value, Class<T> enumClass, String fieldName) {
        T parsed = parseEnum(value, enumClass, fieldName);
        if (parsed != null) {
            return parsed;
        }
        throw new IllegalArgumentException(fieldName + " is required");
    }

    private <T extends Enum<T>> T parseEnum(String value, Class<T> enumClass, String fieldName) {
        String normalizedValue = normalizeFilter(value);
        if (normalizedValue == null) {
            return null;
        }
        try {
            return Enum.valueOf(enumClass, normalizedValue.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            String allowedValues = Arrays.stream(enumClass.getEnumConstants())
                    .map(Enum::name)
                    .collect(Collectors.joining(", "));
            throw new IllegalArgumentException(
                    "Invalid " + fieldName + ": " + value + ". Allowed values: " + allowedValues);
        }
    }

    public QuestionDTO mapToQuestionDTO(Question question) {
        QuestionDTO dto = new QuestionDTO();
        dto.setId(question.getId());
        dto.setBankId(question.getBank() != null ? question.getBank().getId() : null);
        dto.setBankName(question.getBank() != null ? question.getBank().getName() : null);
        dto.setCreatedById(question.getCreatedBy() != null ? question.getCreatedBy().getId() : null);
        dto.setCreatedByName(question.getCreatedBy() != null ? question.getCreatedBy().getFullName() : null);
        dto.setContent(question.getContent());
        dto.setType(question.getType() != null ? question.getType().name() : null);
        dto.setDifficulty(question.getDifficulty() != null ? question.getDifficulty().name() : null);
        dto.setTopic(question.getTopic());
        dto.setOptions(question.getOptions());
        dto.setCorrectAnswer(question.getCorrectAnswer());
        dto.setExplanation(question.getExplanation());
        dto.setAiGenerated(question.getAiGenerated());
        dto.setIsApproved(question.getIsApproved());
        dto.setApprovedById(question.getApprovedBy() != null ? question.getApprovedBy().getId() : null);
        dto.setApprovedByName(question.getApprovedBy() != null ? question.getApprovedBy().getFullName() : null);
        dto.setCreatedAt(question.getCreatedAt());
        return dto;
    }

    private Question buildQuestionEntity(QuestionDTO dto, QuestionBank bank, User user) {
        if (dto == null) {
            throw new IllegalArgumentException("Question payload must not be null");
        }
        if (!StringUtils.hasText(dto.getContent())) {
            throw new IllegalArgumentException("Question content is required");
        }

        Question.QuestionType questionType = parseRequiredEnum(dto.getType(), Question.QuestionType.class, "type");
        Question.Difficulty questionDifficulty = parseEnum(dto.getDifficulty(), Question.Difficulty.class, "difficulty");

        Question question = new Question();
        question.setBank(bank);
        question.setCreatedBy(user);
        question.setContent(dto.getContent());
        question.setType(questionType);
        question.setDifficulty(questionDifficulty != null ? questionDifficulty : Question.Difficulty.MEDIUM);
        question.setTopic(dto.getTopic());
        question.setOptions(dto.getOptions());
        question.setCorrectAnswer(dto.getCorrectAnswer());
        question.setExplanation(dto.getExplanation());
        question.setAiGenerated(dto.getAiGenerated() != null ? dto.getAiGenerated() : false);
        question.setIsApproved(false);
        return question;
    }

    private void applyCreateRequest(Question question, QuestionCreateRequest request) {
        question.setContent(request.getContent());
        question.setType(request.getType());
        question.setDifficulty(request.getDifficulty() != null ? request.getDifficulty() : Question.Difficulty.MEDIUM);
        question.setTopic(request.getTopic());
        question.setOptions(request.getType() == Question.QuestionType.MULTIPLE_CHOICE ? request.getOptions() : null);
        question.setCorrectAnswer(request.getCorrectAnswer());
        question.setExplanation(request.getExplanation());
    }

    // =====================================================================
    // APPROVAL
    // =====================================================================

    /**
     * Duyệt hoặc huỷ duyệt một câu hỏi.
     *
     * <p>Khi approve: đặt {@code isApproved = true} và lưu lại ngườị duyệt.
     * <p>Khi unapprove: đặt {@code isApproved = false} và xóa {@code approvedBy}.
     *
     * @param questionId ID câu hỏi cần duyệt
     * @param approve    true = duyệt, false = hủy duyệt
     * @param manager    Người thực hiện duyệt (Manager)
     * @return QuestionDTO sau khi cập nhật
     */
    @Transactional
    public QuestionDTO approveQuestion(Long questionId, boolean approve, User manager) {
        Question question = findQuestionOrThrow(questionId);

        question.setIsApproved(approve);
        question.setApprovedBy(approve ? manager : null);

        Question saved = questionRepository.save(question);
        return mapToQuestionDTO(saved);
    }

}
