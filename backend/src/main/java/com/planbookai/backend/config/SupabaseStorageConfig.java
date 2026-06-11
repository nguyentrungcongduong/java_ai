package com.planbookai.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import java.net.URI;

@Configuration
public class SupabaseStorageConfig {

    @Value("${supabase.s3.endpoint}")
    private String endpoint;

    @Value("${supabase.s3.region:ap-southeast-1}")
    private String region;

    @Value("${supabase.s3.accessKey}")
    private String accessKey;

    @Value("${supabase.s3.secretKey}")
    private String secretKey;

    @Bean
    public S3Client s3Client() {
        return S3Client.builder()
                .endpointOverride(URI.create(endpoint))
                .region(Region.of(region))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(accessKey, secretKey)))
                .serviceConfiguration(S3Configuration.builder()
                        .pathStyleAccessEnabled(true)   // Supabase yêu cầu path-style
                        .chunkedEncodingEnabled(false)  // Tắt chunked để tránh TLS issue
                        .build())
                .build();
    }
}
