package com.planbookai.backend.config;

import com.google.genai.Client;
import com.google.genai.types.HttpOptions;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * GeminiAIConfig – Cấu hình Google Gemini AI client.
 *
 * <p>Đọc API key từ property {@code gemini.api-key} (inject từ biến môi trường GEMINI_API_KEY).
 * Tạo một bean {@link Client} singleton dùng chung cho toàn bộ ứng dụng.
 *
 * <p>Nếu {@code apiKey} trống, bean vẫn được tạo nhưng sẽ ném lỗi khi gọi API.
 * Hãy set biến môi trường {@code GEMINI_API_KEY} trước khi chạy.
 */
@Configuration
public class GeminiAIConfig {

    private static final Logger log = LoggerFactory.getLogger(GeminiAIConfig.class);

    @Value("${gemini.api-key:}")
    private String apiKey;

    @Bean
    public Client geminiClient() {
        // Loại bỏ placeholder "dummy" hoặc chuỗi mẫu ban đầu để tránh lỗi 400
        String effectiveKey = (apiKey != null &&
                               !apiKey.isBlank() &&
                               !apiKey.equalsIgnoreCase("dummy") &&
                               !apiKey.startsWith("AIzaSyA..."))
                               ? apiKey : null;
        String source = "application.yml";

        // Fallback sang biến môi trường hệ thống nếu config trống
        if (effectiveKey == null) {
            effectiveKey = System.getenv("GEMINI_API_KEY");
            source = "System Environment (GEMINI_API_KEY)";
        }

        if (effectiveKey == null) {
            effectiveKey = System.getenv("GOOGLE_API_KEY");
            source = "System Environment (GOOGLE_API_KEY)";
        }

        if (effectiveKey == null) {
            log.error("[GeminiAI] CONFIG ERROR: API Key not found. AI features are DISABLED.");
            return null;
        }

        // Clean the key: remove quotes and whitespace
        effectiveKey = effectiveKey.trim().replaceAll("[\"']", "");

        log.info("[GeminiAI] Client initialized successfully using source: {}", source);

        // Dùng v1 (stable) thay vì v1beta để tương thích với free tier accounts
        return new Client.Builder()
                .apiKey(effectiveKey)
                .httpOptions(HttpOptions.builder().apiVersion("v1").build())
                .build();
    }
}
