package com.planbookai.backend.controller;

import com.planbookai.backend.dto.AnswerSheetDTO;
import com.planbookai.backend.dto.PageResponse;
import com.planbookai.backend.dto.UploadAnswerSheetRequest;
import com.planbookai.backend.model.entity.User;
import com.planbookai.backend.service.AnswerSheetService;
import com.planbookai.backend.service.OCRService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/v1/answer-sheets")
@Tag(name = "Answer Sheets", description = "Teacher answer sheet upload management")
public class AnswerSheetController {

    private final AnswerSheetService answerSheetService;
    private final OCRService ocrService;

    public AnswerSheetController(AnswerSheetService answerSheetService, OCRService ocrService) {
        this.answerSheetService = answerSheetService;
        this.ocrService = ocrService;
    }

    @GetMapping
    @PreAuthorize("hasRole('TEACHER')")
    @Operation(
            summary = "List uploaded answer sheets",
            description = """
                    Returns the current teacher's uploaded answer sheets.

                    Supported query params:
                    - `exam_id`: preferred filter from SA contract
                    - `examId`: compatibility alias
                    - `page`, `size`: optional pagination for Postman and UI testing
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Answer sheets fetched successfully"),
            @ApiResponse(responseCode = "400", description = "Invalid query parameters", content = @Content),
            @ApiResponse(responseCode = "401", description = "Authentication required", content = @Content),
            @ApiResponse(responseCode = "403", description = "Only teacher can access this endpoint", content = @Content),
            @ApiResponse(responseCode = "404", description = "Exam not found", content = @Content),
    })
    public ResponseEntity<PageResponse<AnswerSheetDTO>> getAnswerSheets(
            @Parameter(description = "Zero-based page index", example = "0")
            @RequestParam(defaultValue = "0") Integer page,
            @Parameter(description = "Page size, maximum 100", example = "10")
            @RequestParam(defaultValue = "10") Integer size,
            @Parameter(description = "Exam identifier in snake_case", example = "12")
            @RequestParam(value = "exam_id", required = false) Long snakeCaseExamId,
            @Parameter(description = "Exam identifier in camelCase compatibility mode", example = "12")
            @RequestParam(value = "examId", required = false) Long camelCaseExamId,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(
                answerSheetService.getMyAnswerSheets(
                        user,
                        page,
                        size,
                        resolveExamId(snakeCaseExamId, camelCaseExamId)));
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('TEACHER')")
    @Operation(
            summary = "Upload scanned answer sheets",
            description = """
                    Uploads one or more scanned answer sheet files for an exam owned by the current teacher.

                    Supported multipart fields:
                    - `exam_id`: preferred exam identifier from SA contract
                    - `examId`: compatibility alias
                    - `files`: repeated multipart files
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Answer sheets uploaded successfully"),
            @ApiResponse(responseCode = "400", description = "Invalid multipart payload", content = @Content),
            @ApiResponse(responseCode = "401", description = "Authentication required", content = @Content),
            @ApiResponse(responseCode = "403", description = "Only owner teacher can upload answer sheets", content = @Content),
            @ApiResponse(responseCode = "404", description = "Exam not found", content = @Content),
    })
    public ResponseEntity<List<AnswerSheetDTO>> uploadAnswerSheets(
            @Parameter(description = "Exam identifier in snake_case", example = "12")
            @RequestParam(value = "exam_id", required = false) Long snakeCaseExamId,
            @Parameter(description = "Exam identifier in camelCase compatibility mode", example = "12")
            @RequestParam(value = "examId", required = false) Long camelCaseExamId,
            @RequestParam(value = "files", required = false) List<MultipartFile> files,
            @AuthenticationPrincipal User user) {

        UploadAnswerSheetRequest request = new UploadAnswerSheetRequest();
        request.setExamId(resolveExamId(snakeCaseExamId, camelCaseExamId));
        request.setFiles(files);

        return ResponseEntity.status(201).body(answerSheetService.uploadAnswerSheets(request, user));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('TEACHER')")
    @Operation(
            summary = "Get answer sheet detail",
            description = "Returns answer sheet detail for the current teacher, including OCR raw data when available.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Answer sheet fetched successfully"),
            @ApiResponse(responseCode = "401", description = "Authentication required", content = @Content),
            @ApiResponse(responseCode = "403", description = "Only owner teacher can access this answer sheet", content = @Content),
            @ApiResponse(responseCode = "404", description = "Answer sheet not found", content = @Content),
    })
    public ResponseEntity<AnswerSheetDTO> getAnswerSheet(
            @PathVariable Long id,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(answerSheetService.getAnswerSheet(id, user));
    }

    @PostMapping("/{id}/process")
    @PreAuthorize("hasRole('TEACHER')")
    @Operation(
            summary = "Trigger OCR processing",
            description = """
                    Triggers OCR for the selected answer sheet.

                    Postman note:
                    - send POST with no request body
                    - only Authorization header is required
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "OCR processed successfully"),
            @ApiResponse(responseCode = "400", description = "Answer sheet is already being processed", content = @Content),
            @ApiResponse(responseCode = "401", description = "Authentication required", content = @Content),
            @ApiResponse(responseCode = "403", description = "Only owner teacher can process this answer sheet", content = @Content),
            @ApiResponse(responseCode = "404", description = "Answer sheet not found", content = @Content),
            @ApiResponse(responseCode = "502", description = "OCR provider failed", content = @Content),
    })
    public ResponseEntity<AnswerSheetDTO> processAnswerSheet(
            @PathVariable Long id,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ocrService.processAnswerSheet(id, user));
    }

    @PatchMapping("/{id}/ocr-answers")
    @PreAuthorize("hasRole('TEACHER')")
    @Operation(
            summary = "Save corrected OCR answers",
            description = "Allows teacher to override OCR-detected answers and persist the corrected result to the database.")
    public ResponseEntity<AnswerSheetDTO> saveOcrAnswers(
            @PathVariable Long id,
            @RequestBody java.util.Map<String, Object> body,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ocrService.saveOcrAnswers(id, body, user));
    }

    private Long resolveExamId(Long snakeCaseExamId, Long camelCaseExamId) {
        if (snakeCaseExamId != null && camelCaseExamId != null && !snakeCaseExamId.equals(camelCaseExamId)) {
            throw new IllegalArgumentException("Provide either exam_id or examId with the same value");
        }
        return snakeCaseExamId != null ? snakeCaseExamId : camelCaseExamId;
    }
}
