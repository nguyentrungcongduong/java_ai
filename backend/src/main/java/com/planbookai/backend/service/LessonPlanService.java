package com.planbookai.backend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.planbookai.backend.dto.LessonPlanDTO;
import com.planbookai.backend.dto.LessonPlanGenerateRequest;
import com.planbookai.backend.dto.LessonPlanListItemDTO;
import com.planbookai.backend.dto.LessonPlanRequest;
import com.planbookai.backend.dto.PageResponse;
import com.planbookai.backend.dto.SaveLessonPlanRequest;
import com.planbookai.backend.exception.ForbiddenOperationException;
import com.planbookai.backend.exception.ResourceNotFoundException;
import com.planbookai.backend.model.entity.LessonPlan;
import com.planbookai.backend.model.entity.Role;
import com.planbookai.backend.model.entity.User;
import com.planbookai.backend.repository.LessonPlanRepository;
import com.planbookai.backend.util.PromptBuilder;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class LessonPlanService {

    private final LessonPlanRepository lessonPlanRepository;
    private final LessonPlanFrameworkValidator lessonPlanFrameworkValidator;
    private final GeminiAIService geminiAIService;
    private final CurrentUserService currentUserService;
    private final ObjectMapper objectMapper;

    public LessonPlanService(LessonPlanRepository lessonPlanRepository) {
        this(
                lessonPlanRepository,
                frameworkId -> {
                },
                (GeminiAIService) null,
                (CurrentUserService) null);
    }

    public LessonPlanService(
            LessonPlanRepository lessonPlanRepository,
            LessonPlanFrameworkValidator lessonPlanFrameworkValidator) {
        this(
                lessonPlanRepository,
                lessonPlanFrameworkValidator,
                (GeminiAIService) null,
                (CurrentUserService) null);
    }

    @Autowired
    public LessonPlanService(
            LessonPlanRepository lessonPlanRepository,
            LessonPlanFrameworkValidator lessonPlanFrameworkValidator,
            ObjectProvider<GeminiAIService> geminiAIServiceProvider,
            ObjectProvider<CurrentUserService> currentUserServiceProvider) {
        this(
                lessonPlanRepository,
                lessonPlanFrameworkValidator,
                geminiAIServiceProvider.getIfAvailable(),
                currentUserServiceProvider.getIfAvailable());
    }

    private LessonPlanService(
            LessonPlanRepository lessonPlanRepository,
            LessonPlanFrameworkValidator lessonPlanFrameworkValidator,
            GeminiAIService geminiAIService,
            CurrentUserService currentUserService) {
        this.lessonPlanRepository = lessonPlanRepository;
        this.lessonPlanFrameworkValidator = lessonPlanFrameworkValidator;
        this.geminiAIService = geminiAIService;
        this.currentUserService = currentUserService;
        this.objectMapper = new ObjectMapper();
    }

    @Transactional(readOnly = true)
    public PageResponse<LessonPlanListItemDTO> getMyLessonPlans(
            User user,
            Integer page,
            Integer size,
            String status,
            String subject,
            String gradeLevel,
            String keyword) {
        assertCanViewOwnLessonPlans(user);
        validatePageRequest(page, size);

        Pageable pageable = PageRequest.of(
                page,
                size,
                Sort.by(Sort.Direction.DESC, "updatedAt").and(Sort.by(Sort.Direction.DESC, "id")));

        Page<LessonPlanListItemDTO> lessonPlans = lessonPlanRepository.findByTeacherIdWithFilters(
                user.getId(),
                parseStatus(status),
                normalizeFilter(subject),
                normalizeFilter(gradeLevel),
                normalizeFilter(keyword),
                pageable);

        return PageResponse.from(lessonPlans);
    }

    @Transactional
    public LessonPlanDTO createLessonPlan(LessonPlanRequest request, User user) {
        assertCanViewOwnLessonPlans(user);
        lessonPlanFrameworkValidator.validateFrameworkIdIfAvailable(request.getFrameworkId());

        LessonPlan lessonPlan = LessonPlan.builder()
                .teacher(user)
                .frameworkId(request.getFrameworkId())
                .title(normalizeRequiredText(request.getTitle(), "title"))
                .subject(normalizeOptionalText(request.getSubject()))
                .gradeLevel(normalizeOptionalText(request.getGradeLevel()))
                .topic(normalizeOptionalText(request.getTopic()))
                .objectives(normalizeOptionalText(request.getObjectives()))
                .activities(normalizeOptionalText(request.getActivities()))
                .assessment(normalizeOptionalText(request.getAssessment()))
                .materials(normalizeOptionalText(request.getMaterials()))
                .durationMinutes(request.getDurationMinutes())
                .aiGenerated(false)
                .status(LessonPlan.LessonPlanStatus.DRAFT)
                .build();

        return mapToDTO(lessonPlanRepository.save(lessonPlan));
    }

    @Transactional(readOnly = true)
    public LessonPlanDTO getLessonPlan(Long id, User user) {
        LessonPlan lessonPlan = findLessonPlanOrThrow(id);
        assertOwnsLessonPlan(lessonPlan, user);
        return mapToDTO(lessonPlan);
    }

    @Transactional
    public LessonPlanDTO updateLessonPlan(Long id, LessonPlanRequest request, User user) {
        LessonPlan lessonPlan = findLessonPlanOrThrow(id);
        assertOwnsLessonPlan(lessonPlan, user);
        lessonPlanFrameworkValidator.validateFrameworkIdIfAvailable(request.getFrameworkId());

        lessonPlan.setFrameworkId(request.getFrameworkId());
        lessonPlan.setTitle(normalizeRequiredText(request.getTitle(), "title"));
        lessonPlan.setSubject(normalizeOptionalText(request.getSubject()));
        lessonPlan.setGradeLevel(normalizeOptionalText(request.getGradeLevel()));
        lessonPlan.setTopic(normalizeOptionalText(request.getTopic()));
        lessonPlan.setObjectives(normalizeOptionalText(request.getObjectives()));
        lessonPlan.setActivities(normalizeOptionalText(request.getActivities()));
        lessonPlan.setAssessment(normalizeOptionalText(request.getAssessment()));
        lessonPlan.setMaterials(normalizeOptionalText(request.getMaterials()));
        lessonPlan.setDurationMinutes(request.getDurationMinutes());

        return mapToDTO(lessonPlanRepository.save(lessonPlan));
    }

    @Transactional
    public void deleteLessonPlan(Long id, User user) {
        LessonPlan lessonPlan = findLessonPlanOrThrow(id);
        assertOwnsLessonPlan(lessonPlan, user);
        lessonPlanRepository.delete(lessonPlan);
    }

    @Transactional
    public LessonPlanDTO publishLessonPlan(Long id, User user) {
        LessonPlan lessonPlan = findLessonPlanOrThrow(id);
        assertOwnsLessonPlan(lessonPlan, user);

        if (lessonPlan.getStatus() == LessonPlan.LessonPlanStatus.PUBLISHED) {
            return mapToDTO(lessonPlan);
        }

        lessonPlanFrameworkValidator.validateFrameworkIdIfAvailable(lessonPlan.getFrameworkId());
        assertCanPublishLessonPlan(lessonPlan);
        lessonPlan.setStatus(LessonPlan.LessonPlanStatus.PUBLISHED);
        return mapToDTO(lessonPlanRepository.save(lessonPlan));
    }

    @Transactional
    public LessonPlanDTO generateLessonPlan(LessonPlanGenerateRequest request) {
        ensureAiGenerationAvailable();

        PromptBuilder.LessonFramework framework = parseAiFramework(request.getFramework());
        LessonPlanDTO generated = geminiAIService.generateLessonPlan(
                normalizeRequiredText(request.getSubject(), "subject"),
                normalizeRequiredText(request.getTopic(), "topic"),
                normalizeRequiredText(request.getGradeLevel(), "gradeLevel"),
                request.getDurationMinutes(),
                framework,
                normalizeOptionalText(request.getObjectives()));

        generated.setFramework(framework.name());
        generated.setAiGenerated(true);
        generated.setStatus(LessonPlan.LessonPlanStatus.DRAFT);
        enrichPlainTextFieldsFromStructuredContent(generated);

        if (!request.isSaveToDb()) {
            return generated;
        }

        User teacher = getCurrentTeacher();
        LessonPlan saved = lessonPlanRepository.save(mapAiDtoToEntity(generated, teacher));
        return mapToDTO(saved);
    }

    @Transactional
    public LessonPlanDTO generateLessonPlanFromFile(
            byte[] fileBytes,
            String mimeType,
            String gradeLevel,
            int durationMinutes,
            String frameworkCode,
            String objectives) {

        ensureAiGenerationAvailable();

        PromptBuilder.LessonFramework framework = parseAiFramework(frameworkCode);
        LessonPlanDTO generated = geminiAIService.generateLessonPlanFromFileContent(
                fileBytes,
                mimeType,
                normalizeRequiredText(gradeLevel, "gradeLevel"),
                durationMinutes,
                framework,
                normalizeOptionalText(objectives));

        generated.setFramework(framework.name());
        generated.setAiGenerated(true);
        generated.setStatus(LessonPlan.LessonPlanStatus.DRAFT);
        enrichPlainTextFieldsFromStructuredContent(generated);
        return generated;
    }

    @Transactional
    public LessonPlanDTO saveEditedLessonPlan(SaveLessonPlanRequest request) {
        ensureCurrentUserSupportAvailable();
        User teacher = getCurrentTeacher();
        LessonPlanDTO dto = mapSaveRequestToAiDto(request);
        LessonPlan saved = lessonPlanRepository.save(mapAiDtoToEntity(dto, teacher));
        return mapToDTO(saved);
    }

    @Transactional(readOnly = true)
    public List<LessonPlanDTO> getAllLessonPlans() {
        ensureCurrentUserSupportAvailable();
        User teacher = getCurrentTeacher();
        return lessonPlanRepository.findByTeacher_IdOrderByUpdatedAtDesc(teacher.getId())
                .stream()
                .map(this::mapToDTO)
                .toList();
    }

    @Transactional(readOnly = true)
    public Optional<LessonPlanDTO> getLessonPlanById(Long id) {
        ensureCurrentUserSupportAvailable();
        User teacher = getCurrentTeacher();
        return lessonPlanRepository.findById(id)
                .filter(lessonPlan -> isOwnedByUser(lessonPlan, teacher))
                .map(this::mapToDTO);
    }

    private void assertCanViewOwnLessonPlans(User user) {
        requireAuthenticatedUser(user);
        if (hasRole(user, Role.RoleName.TEACHER)) {
            return;
        }
        throw new ForbiddenOperationException("Only teacher can view lesson plans");
    }

    private void assertOwnsLessonPlan(LessonPlan lessonPlan, User user) {
        assertCanViewOwnLessonPlans(user);
        if (isOwnedByUser(lessonPlan, user)) {
            return;
        }
        throw new ForbiddenOperationException("You do not have permission to access this lesson plan");
    }

    private boolean isOwnedByUser(LessonPlan lessonPlan, User user) {
        Long teacherId = lessonPlan.getTeacher() != null ? lessonPlan.getTeacher().getId() : null;
        return teacherId != null && teacherId.equals(user.getId());
    }

    private LessonPlan findLessonPlanOrThrow(Long id) {
        return lessonPlanRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Lesson plan not found: " + id));
    }

    private void assertCanPublishLessonPlan(LessonPlan lessonPlan) {
        List<String> missingFields = new ArrayList<>();

        if (!StringUtils.hasText(lessonPlan.getTitle())) {
            missingFields.add("title");
        }
        if (!StringUtils.hasText(lessonPlan.getSubject())) {
            missingFields.add("subject");
        }
        if (!StringUtils.hasText(lessonPlan.getGradeLevel())) {
            missingFields.add("gradeLevel");
        }
        if (!StringUtils.hasText(lessonPlan.getTopic())) {
            missingFields.add("topic");
        }
        if (!StringUtils.hasText(lessonPlan.getObjectives())) {
            missingFields.add("objectives");
        }
        if (!StringUtils.hasText(lessonPlan.getActivities())) {
            missingFields.add("activities");
        }
        if (!StringUtils.hasText(lessonPlan.getAssessment())) {
            missingFields.add("assessment");
        }
        if (!StringUtils.hasText(lessonPlan.getMaterials())) {
            missingFields.add("materials");
        }
        if (lessonPlan.getDurationMinutes() == null || lessonPlan.getDurationMinutes() <= 0) {
            missingFields.add("durationMinutes");
        }

        if (!missingFields.isEmpty()) {
            throw new IllegalArgumentException(
                    "Lesson plan is not ready to publish. Missing required fields: "
                            + String.join(", ", missingFields));
        }
    }

    private void requireAuthenticatedUser(User user) {
        if (user == null || user.getId() == null) {
            throw new ForbiddenOperationException("Authentication is required");
        }
    }

    private boolean hasRole(User user, Role.RoleName roleName) {
        return user != null
                && user.getRole() != null
                && user.getRole().getName() == roleName;
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

    private String normalizeFilter(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private String normalizeOptionalText(String value) {
        String normalized = normalizeFilter(value);
        return normalized != null ? normalized : null;
    }

    private String normalizeRequiredText(String value, String fieldName) {
        String normalized = normalizeFilter(value);
        if (normalized != null) {
            return normalized;
        }
        throw new IllegalArgumentException(fieldName + " is required");
    }

    private LessonPlan.LessonPlanStatus parseStatus(String value) {
        String normalizedValue = normalizeFilter(value);
        if (normalizedValue == null) {
            return null;
        }
        try {
            return LessonPlan.LessonPlanStatus.valueOf(normalizedValue.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            String allowedValues = Arrays.stream(LessonPlan.LessonPlanStatus.values())
                    .map(Enum::name)
                    .collect(Collectors.joining(", "));
            throw new IllegalArgumentException(
                    "Invalid status: " + value + ". Allowed values: " + allowedValues);
        }
    }

    private LessonPlanDTO mapSaveRequestToAiDto(SaveLessonPlanRequest request) {
        List<LessonPlanDTO.LessonPhase> lessonFlow = request.getLessonFlow() == null
                ? List.of()
                : request.getLessonFlow().stream()
                        .map(phase -> LessonPlanDTO.LessonPhase.builder()
                                .phase(normalizeOptionalText(phase.getPhase()))
                                .timeMinutes(phase.getTimeMinutes())
                                .activities(normalizeOptionalText(phase.getActivities()))
                                .teacherActions(normalizeOptionalText(phase.getTeacherActions()))
                                .studentActions(normalizeOptionalText(phase.getStudentActions()))
                                .build())
                        .toList();

        LessonPlanDTO.AssessmentDetail assessmentDetail = request.getAssessment() == null
                ? null
                : LessonPlanDTO.AssessmentDetail.builder()
                        .methods(normalizeStringList(request.getAssessment().getMethods()))
                        .criteria(normalizeOptionalText(request.getAssessment().getCriteria()))
                        .build();

        LessonPlanDTO dto = LessonPlanDTO.builder()
                .title(resolveAiTitle(request.getTitle(), request.getTopic()))
                .subject(normalizeRequiredText(request.getSubject(), "subject"))
                .gradeLevel(normalizeRequiredText(request.getGradeLevel(), "gradeLevel"))
                .topic(normalizeRequiredText(request.getTopic(), "topic"))
                .durationMinutes(request.getDurationMinutes())
                .framework(normalizeAiFrameworkCode(request.getFramework()))
                .lessonObjectives(normalizeStringList(request.getLessonPlanObjectives()))
                .materialItems(normalizeStringList(request.getMaterials()))
                .lessonFlow(lessonFlow)
                .assessmentDetail(assessmentDetail)
                .homework(normalizeOptionalText(request.getHomework()))
                .notes(normalizeOptionalText(request.getNotes()))
                .aiGenerated(true)
                .status(LessonPlan.LessonPlanStatus.DRAFT)
                .build();

        enrichPlainTextFieldsFromStructuredContent(dto);
        return dto;
    }

    private LessonPlan mapAiDtoToEntity(LessonPlanDTO dto, User teacher) {
        enrichPlainTextFieldsFromStructuredContent(dto);

        return LessonPlan.builder()
                .teacher(teacher)
                .frameworkId(dto.getFrameworkId())
                .frameworkCode(normalizeOptionalText(dto.getFramework()))
                .title(resolveAiTitle(dto.getTitle(), dto.getTopic()))
                .subject(normalizeOptionalText(dto.getSubject()))
                .gradeLevel(normalizeOptionalText(dto.getGradeLevel()))
                .topic(normalizeOptionalText(dto.getTopic()))
                .objectives(normalizeOptionalText(dto.getObjectives()))
                .activities(normalizeOptionalText(dto.getActivities()))
                .assessment(normalizeOptionalText(dto.getAssessment()))
                .materials(normalizeOptionalText(dto.getMaterials()))
                .durationMinutes(dto.getDurationMinutes())
                .aiObjectivesJson(writeJson(dto.getLessonObjectives()))
                .aiMaterialsJson(writeJson(dto.getMaterialItems()))
                .lessonFlowJson(writeJson(dto.getLessonFlow()))
                .assessmentJson(writeJson(dto.getAssessmentDetail()))
                .homework(normalizeOptionalText(dto.getHomework()))
                .notes(normalizeOptionalText(dto.getNotes()))
                .aiGenerated(Boolean.TRUE.equals(dto.getAiGenerated()))
                .status(dto.getStatus() != null ? dto.getStatus() : LessonPlan.LessonPlanStatus.DRAFT)
                .build();
    }

    private LessonPlanDTO mapToDTO(LessonPlan lessonPlan) {
        LessonPlanDTO dto = LessonPlanDTO.builder()
                .id(lessonPlan.getId())
                .teacherId(lessonPlan.getTeacher() != null ? lessonPlan.getTeacher().getId() : null)
                .frameworkId(lessonPlan.getFrameworkId())
                .title(lessonPlan.getTitle())
                .subject(lessonPlan.getSubject())
                .gradeLevel(lessonPlan.getGradeLevel())
                .topic(lessonPlan.getTopic())
                .objectives(lessonPlan.getObjectives())
                .activities(lessonPlan.getActivities())
                .assessment(lessonPlan.getAssessment())
                .materials(lessonPlan.getMaterials())
                .durationMinutes(lessonPlan.getDurationMinutes())
                .framework(lessonPlan.getFrameworkCode())
                .lessonObjectives(readStringList(lessonPlan.getAiObjectivesJson()))
                .materialItems(readStringList(lessonPlan.getAiMaterialsJson()))
                .lessonFlow(readLessonFlow(lessonPlan.getLessonFlowJson()))
                .assessmentDetail(readAssessmentDetail(lessonPlan.getAssessmentJson()))
                .homework(lessonPlan.getHomework())
                .notes(lessonPlan.getNotes())
                .aiGenerated(lessonPlan.getAiGenerated())
                .status(lessonPlan.getStatus())
                .createdAt(lessonPlan.getCreatedAt())
                .updatedAt(lessonPlan.getUpdatedAt())
                .build();

        enrichPlainTextFieldsFromStructuredContent(dto);
        return dto;
    }

    private void enrichPlainTextFieldsFromStructuredContent(LessonPlanDTO dto) {
        List<String> lessonObjectives = dto.getLessonObjectives() != null ? dto.getLessonObjectives() : List.of();
        List<String> materialItems = dto.getMaterialItems() != null ? dto.getMaterialItems() : List.of();
        List<LessonPlanDTO.LessonPhase> lessonFlow = dto.getLessonFlow() != null ? dto.getLessonFlow() : List.of();

        if (!StringUtils.hasText(dto.getObjectives()) && !lessonObjectives.isEmpty()) {
            dto.setObjectives(String.join("\n", lessonObjectives));
        }

        if (!StringUtils.hasText(dto.getMaterials()) && !materialItems.isEmpty()) {
            dto.setMaterials(String.join("\n", materialItems));
        }

        if (!StringUtils.hasText(dto.getActivities()) && !lessonFlow.isEmpty()) {
            dto.setActivities(formatLessonFlow(lessonFlow));
        }

        if (!StringUtils.hasText(dto.getAssessment()) && dto.getAssessmentDetail() != null) {
            dto.setAssessment(formatAssessment(dto.getAssessmentDetail()));
        }
    }

    private String formatLessonFlow(List<LessonPlanDTO.LessonPhase> lessonFlow) {
        return lessonFlow.stream()
                .map(phase -> {
                    List<String> lines = new ArrayList<>();
                    String header = StringUtils.hasText(phase.getPhase()) ? phase.getPhase().trim() : "Phase";
                    if (phase.getTimeMinutes() != null && phase.getTimeMinutes() > 0) {
                        header = header + " (" + phase.getTimeMinutes() + " min)";
                    }
                    lines.add(header);

                    if (StringUtils.hasText(phase.getActivities())) {
                        lines.add("Activities: " + phase.getActivities().trim());
                    }
                    if (StringUtils.hasText(phase.getTeacherActions())) {
                        lines.add("Teacher: " + phase.getTeacherActions().trim());
                    }
                    if (StringUtils.hasText(phase.getStudentActions())) {
                        lines.add("Students: " + phase.getStudentActions().trim());
                    }

                    return String.join("\n", lines);
                })
                .collect(Collectors.joining("\n\n"));
    }

    private String formatAssessment(LessonPlanDTO.AssessmentDetail assessmentDetail) {
        List<String> lines = new ArrayList<>();
        List<String> methods = normalizeStringList(assessmentDetail.getMethods());

        if (!methods.isEmpty()) {
            lines.add("Methods: " + String.join(", ", methods));
        }
        if (StringUtils.hasText(assessmentDetail.getCriteria())) {
            lines.add("Criteria: " + assessmentDetail.getCriteria().trim());
        }

        return lines.isEmpty() ? null : String.join("\n", lines);
    }

    private List<String> normalizeStringList(List<String> values) {
        if (values == null) {
            return List.of();
        }
        return values.stream()
                .map(this::normalizeOptionalText)
                .filter(StringUtils::hasText)
                .toList();
    }

    private List<String> readStringList(String rawJson) {
        if (!StringUtils.hasText(rawJson)) {
            return List.of();
        }

        try {
            List<String> values = objectMapper.readValue(rawJson, new TypeReference<List<String>>() {
            });
            return normalizeStringList(values);
        } catch (JsonProcessingException ex) {
            return List.of();
        }
    }

    private List<LessonPlanDTO.LessonPhase> readLessonFlow(String rawJson) {
        if (!StringUtils.hasText(rawJson)) {
            return List.of();
        }

        try {
            List<LessonPlanDTO.LessonPhase> lessonFlow = objectMapper.readValue(
                    rawJson,
                    new TypeReference<List<LessonPlanDTO.LessonPhase>>() {
                    });
            return lessonFlow != null ? lessonFlow : List.of();
        } catch (JsonProcessingException ex) {
            return List.of();
        }
    }

    private LessonPlanDTO.AssessmentDetail readAssessmentDetail(String rawJson) {
        if (!StringUtils.hasText(rawJson)) {
            return null;
        }

        try {
            return objectMapper.readValue(rawJson, LessonPlanDTO.AssessmentDetail.class);
        } catch (JsonProcessingException ex) {
            return null;
        }
    }

    private String writeJson(Object value) {
        if (value == null) {
            return null;
        }

        if (value instanceof Collection<?> collection && collection.isEmpty()) {
            return null;
        }

        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Unable to serialize lesson plan content", ex);
        }
    }

    private PromptBuilder.LessonFramework parseAiFramework(String frameworkCode) {
        if (!StringUtils.hasText(frameworkCode)) {
            return PromptBuilder.LessonFramework.E5;
        }

        try {
            return PromptBuilder.LessonFramework.valueOf(frameworkCode.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            return PromptBuilder.LessonFramework.E5;
        }
    }

    private String normalizeAiFrameworkCode(String frameworkCode) {
        if (!StringUtils.hasText(frameworkCode)) {
            return null;
        }
        return frameworkCode.trim().toUpperCase(Locale.ROOT);
    }

    private String resolveAiTitle(String title, String topic) {
        String normalizedTitle = normalizeOptionalText(title);
        if (normalizedTitle != null) {
            return normalizedTitle;
        }

        String normalizedTopic = normalizeOptionalText(topic);
        return normalizedTopic != null ? normalizedTopic : "Untitled lesson plan";
    }

    private User getCurrentTeacher() {
        User user = currentUserService.getCurrentUserEntity()
                .orElseThrow(() -> new ForbiddenOperationException("Authentication is required"));
        assertCanViewOwnLessonPlans(user);
        return user;
    }

    private void ensureAiGenerationAvailable() {
        if (geminiAIService == null) {
            throw new IllegalStateException("AI lesson plan generation is not configured");
        }
    }

    private void ensureCurrentUserSupportAvailable() {
        if (currentUserService == null) {
            throw new IllegalStateException("Current user service is not configured");
        }
    }
}
