package com.planbookai.backend.controller;

import com.planbookai.backend.dto.LessonPlanDTO;
import com.planbookai.backend.dto.LessonPlanGenerateRequest;
import com.planbookai.backend.dto.LessonPlanListItemDTO;
import com.planbookai.backend.dto.LessonPlanRequest;
import com.planbookai.backend.dto.PageResponse;
import com.planbookai.backend.dto.SaveLessonPlanRequest;
import com.planbookai.backend.model.entity.User;
import com.planbookai.backend.service.LessonPlanService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
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

import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@Tag(name = "Lesson Plans", description = "Teacher lesson plan management")
public class LessonPlanController {

    private final LessonPlanService lessonPlanService;

    @GetMapping("/lesson-plans")
    @PreAuthorize("hasRole('TEACHER')")
    @Operation(
            summary = "List current teacher lesson plans",
            description = """
                    Returns the current teacher's lesson plans with pagination and lightweight filters.

                    Supported filters:
                    - `status`: DRAFT or PUBLISHED
                    - `subject`
                    - `gradeLevel`
                    - `keyword`: searches in title and topic
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Lesson plans fetched successfully"),
            @ApiResponse(responseCode = "400", description = "Invalid query parameters", content = @Content),
            @ApiResponse(responseCode = "401", description = "Authentication required", content = @Content),
            @ApiResponse(responseCode = "403", description = "Only teacher can access this endpoint", content = @Content),
    })
    public ResponseEntity<PageResponse<LessonPlanListItemDTO>> getMyLessonPlans(
            @Parameter(description = "Zero-based page index", example = "0")
            @RequestParam(defaultValue = "0") Integer page,
            @Parameter(description = "Page size, maximum 100", example = "10")
            @RequestParam(defaultValue = "10") Integer size,
            @Parameter(description = "Filter by lesson plan status", example = "DRAFT")
            @RequestParam(required = false) String status,
            @Parameter(description = "Filter by subject keyword", example = "Chemistry")
            @RequestParam(required = false) String subject,
            @Parameter(description = "Filter by grade level keyword", example = "10")
            @RequestParam(required = false) String gradeLevel,
            @Parameter(description = "Search keyword in title or topic", example = "Atomic")
            @RequestParam(required = false) String keyword,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(
                lessonPlanService.getMyLessonPlans(user, page, size, status, subject, gradeLevel, keyword));
    }

    @PostMapping("/lesson-plans")
    @PreAuthorize("hasAnyRole('TEACHER','STAFF')")
    @Operation(summary = "Create lesson plan", description = "Creates a new manual lesson plan for the current teacher.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Lesson plan created successfully"),
            @ApiResponse(responseCode = "400", description = "Invalid request payload", content = @Content),
            @ApiResponse(responseCode = "401", description = "Authentication required", content = @Content),
            @ApiResponse(responseCode = "403", description = "Only teacher can access this endpoint", content = @Content),
    })
    public ResponseEntity<LessonPlanDTO> createLessonPlan(
            @Valid @RequestBody LessonPlanRequest request,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.status(201).body(lessonPlanService.createLessonPlan(request, user));
    }

    @GetMapping("/lesson-plans/{id}")
    @PreAuthorize("hasRole('TEACHER')")
    @Operation(summary = "Get lesson plan detail", description = "Returns the full detail of a lesson plan owned by the current teacher.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Lesson plan fetched successfully"),
            @ApiResponse(responseCode = "401", description = "Authentication required", content = @Content),
            @ApiResponse(responseCode = "403", description = "Only owner teacher can access this lesson plan", content = @Content),
            @ApiResponse(responseCode = "404", description = "Lesson plan not found", content = @Content),
    })
    public ResponseEntity<LessonPlanDTO> getLessonPlan(
            @PathVariable Long id,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(lessonPlanService.getLessonPlan(id, user));
    }

    @PutMapping("/lesson-plans/{id}")
    @PreAuthorize("hasAnyRole('TEACHER','STAFF')")
    @Operation(summary = "Update lesson plan", description = "Updates the editable content of a lesson plan owned by the current teacher.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Lesson plan updated successfully"),
            @ApiResponse(responseCode = "400", description = "Invalid request payload", content = @Content),
            @ApiResponse(responseCode = "401", description = "Authentication required", content = @Content),
            @ApiResponse(responseCode = "403", description = "Only owner teacher can update this lesson plan", content = @Content),
            @ApiResponse(responseCode = "404", description = "Lesson plan not found", content = @Content),
    })
    public ResponseEntity<LessonPlanDTO> updateLessonPlan(
            @PathVariable Long id,
            @Valid @RequestBody LessonPlanRequest request,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(lessonPlanService.updateLessonPlan(id, request, user));
    }

    @DeleteMapping("/lesson-plans/{id}")
    @PreAuthorize("hasAnyRole('TEACHER','STAFF')")
    @Operation(summary = "Delete lesson plan", description = "Deletes a lesson plan owned by the current teacher.")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Lesson plan deleted successfully"),
            @ApiResponse(responseCode = "401", description = "Authentication required", content = @Content),
            @ApiResponse(responseCode = "403", description = "Only owner teacher can delete this lesson plan", content = @Content),
            @ApiResponse(responseCode = "404", description = "Lesson plan not found", content = @Content),
    })
    public ResponseEntity<Void> deleteLessonPlan(
            @PathVariable Long id,
            @AuthenticationPrincipal User user) {
        lessonPlanService.deleteLessonPlan(id, user);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/lesson-plans/{id}/publish")
    @PreAuthorize("hasAnyRole('TEACHER','STAFF')")
    @Operation(summary = "Publish lesson plan", description = "Publishes a lesson plan owned by the current teacher.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Lesson plan published successfully"),
            @ApiResponse(responseCode = "401", description = "Authentication required", content = @Content),
            @ApiResponse(responseCode = "403", description = "Only owner teacher can publish this lesson plan", content = @Content),
            @ApiResponse(responseCode = "404", description = "Lesson plan not found", content = @Content),
    })
    public ResponseEntity<LessonPlanDTO> publishLessonPlan(
            @PathVariable Long id,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(lessonPlanService.publishLessonPlan(id, user));
    }

    @PostMapping("/ai/lesson-plans/generate")
    @PreAuthorize("hasAnyRole('TEACHER','STAFF')")
    @Operation(summary = "Generate lesson plan with AI")
    public ResponseEntity<LessonPlanDTO> generate(@Valid @RequestBody LessonPlanGenerateRequest request) {
        return ResponseEntity.ok(lessonPlanService.generateLessonPlan(request));
    }

    @PostMapping(value = "/ai/lesson-plans/generate-from-file", consumes = "multipart/form-data")
    @PreAuthorize("hasAnyRole('TEACHER','STAFF')")
    @Operation(summary = "Generate lesson plan from uploaded PDF or DOCX file")
    public ResponseEntity<LessonPlanDTO> generateFromFile(
            @RequestPart("file") MultipartFile file,
            @RequestParam(defaultValue = "Lớp 10") String gradeLevel,
            @RequestParam(defaultValue = "45") int durationMinutes,
            @RequestParam(defaultValue = "E5") String framework,
            @RequestParam(required = false) String objectives) throws java.io.IOException {

        String mimeType = file.getContentType();
        if (mimeType == null ||
            (!mimeType.equals("application/pdf") &&
             !mimeType.equals("application/vnd.openxmlformats-officedocument.wordprocessingml.document") &&
             !mimeType.equals("application/msword"))) {
            return ResponseEntity.badRequest().build();
        }

        LessonPlanDTO result = lessonPlanService.generateLessonPlanFromFile(
                file.getBytes(), mimeType, gradeLevel, durationMinutes, framework, objectives);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/ai/lesson-plans/save")
    @PreAuthorize("hasAnyRole('TEACHER','STAFF')")
    @Operation(summary = "Save edited AI lesson plan")
    public ResponseEntity<LessonPlanDTO> save(@Valid @RequestBody SaveLessonPlanRequest request) {
        return ResponseEntity.ok(lessonPlanService.saveEditedLessonPlan(request));
    }

    @GetMapping("/ai/lesson-plans")
    @PreAuthorize("hasRole('TEACHER')")
    @Operation(summary = "List current teacher AI lesson plans")
    public ResponseEntity<List<LessonPlanDTO>> getAllAiLessonPlans() {
        return ResponseEntity.ok(lessonPlanService.getAllLessonPlans());
    }

    @GetMapping("/ai/lesson-plans/{id}")
    @PreAuthorize("hasRole('TEACHER')")
    @Operation(summary = "Get AI lesson plan detail")
    public ResponseEntity<LessonPlanDTO> getAiLessonPlanById(@PathVariable Long id) {
        return lessonPlanService.getLessonPlanById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
