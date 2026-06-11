package com.planbookai.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.genai.Client;
import com.google.genai.types.Content;
import com.google.genai.types.GenerateContentResponse;
import com.google.genai.types.Part;
import com.planbookai.backend.exception.AIServiceException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Vision client: dùng Groq Vision làm primary, Gemini làm fallback.
 *
 * <p>Groq hỗ trợ model llama-3.2-11b-vision-preview nhận ảnh qua base64 URL.
 * Nếu Groq không được cấu hình hoặc gặp lỗi, tự động chuyển sang Gemini.
 */
@Service
public class GeminiVisionClientAdapter implements GeminiVisionClient {

    private static final Logger log = LoggerFactory.getLogger(GeminiVisionClientAdapter.class);
    private static final String GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

    private final Client geminiClient;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    @Value("${gemini.model:gemini-2.0-flash}")
    private String geminiModel;

    @Value("${groq.api-key:}")
    private String groqApiKey;

    @Value("${groq.base-url:https://api.groq.com/openai/v1}")
    private String groqBaseUrl;

    public GeminiVisionClientAdapter(Optional<Client> geminiClient) {
        this.geminiClient = geminiClient.orElse(null);
        this.httpClient = HttpClient.newHttpClient();
        this.objectMapper = new ObjectMapper();
    }

    @Override
    public String extractAnswerSheetJson(byte[] fileContent, String mimeType, String prompt) {
        if (fileContent == null || fileContent.length == 0) {
            throw new IllegalArgumentException("fileContent is required");
        }
        if (mimeType == null || mimeType.isBlank()) {
            throw new IllegalArgumentException("mimeType is required");
        }
        if (prompt == null || prompt.isBlank()) {
            throw new IllegalArgumentException("prompt is required");
        }

        // 1. Thử Groq Vision trước
        if (groqApiKey != null && !groqApiKey.isBlank()) {
            try {
                log.info("[OCR] Dùng Groq Vision model: {}", GROQ_VISION_MODEL);
                return callGroqVision(fileContent, mimeType, prompt);
            } catch (Exception ex) {
                log.warn("[OCR] Groq Vision thất bại, chuyển sang Gemini: {}", ex.getMessage());
            }
        }

        // 2. Fallback: Gemini Vision
        if (geminiClient == null) {
            throw new AIServiceException(
                    "Không có AI Vision nào được cấu hình. Cần GROQ_API_KEY hoặc GEMINI_API_KEY.");
        }
        log.info("[OCR] Dùng Gemini Vision model: {}", geminiModel);
        return callGeminiVision(fileContent, mimeType, prompt);
    }

    // ── Groq Vision ────────────────────────────────────────────────────────────

    private String callGroqVision(byte[] fileContent, String mimeType, String prompt) {
        String base64Image = Base64.getEncoder().encodeToString(fileContent);
        String dataUrl = "data:" + mimeType + ";base64," + base64Image;

        Map<String, Object> imageUrlContent = Map.of(
                "type", "image_url",
                "image_url", Map.of("url", dataUrl));
        Map<String, Object> textContent = Map.of("type", "text", "text", prompt);

        Map<String, Object> userMessage = Map.of(
                "role", "user",
                "content", List.of(textContent, imageUrlContent));

        Map<String, Object> body = Map.of(
                "model", GROQ_VISION_MODEL,
                "messages", List.of(userMessage),
                "max_tokens", 4096,
                "temperature", 0.1);

        try {
            String requestBody = objectMapper.writeValueAsString(body);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(groqBaseUrl + "/chat/completions"))
                    .header("Authorization", "Bearer " + groqApiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                throw new AIServiceException("Groq Vision error " + response.statusCode() + ": " + response.body());
            }

            @SuppressWarnings("unchecked")
            Map<String, Object> responseMap = objectMapper.readValue(response.body(), Map.class);
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> choices = (List<Map<String, Object>>) responseMap.get("choices");
            if (choices == null || choices.isEmpty()) {
                throw new AIServiceException("Groq Vision trả về response rỗng");
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
            String content = (String) message.get("content");
            if (content == null || content.isBlank()) {
                throw new AIServiceException("Groq Vision trả về content rỗng");
            }
            return content;
        } catch (AIServiceException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new AIServiceException("Groq Vision request thất bại: " + ex.getMessage(), ex);
        }
    }

    // ── Gemini Vision ───────────────────────────────────────────────────────────

    private String callGeminiVision(byte[] fileContent, String mimeType, String prompt) {
        Content content = Content.fromParts(
                Part.fromText(prompt),
                Part.fromBytes(fileContent, mimeType));
        try {
            GenerateContentResponse response = geminiClient.models.generateContent(geminiModel, content, null);
            String rawJson = response != null ? response.text() : null;
            if (rawJson == null || rawJson.isBlank()) {
                throw new AIServiceException("Gemini Vision trả về response rỗng");
            }
            return rawJson;
        } catch (AIServiceException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new AIServiceException("Gemini Vision service is unavailable: " + ex.getMessage(), ex);
        }
    }
}
