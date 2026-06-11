package com.planbookai.backend.model.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

/**
 * Theo dõi số lần gọi AI của mỗi user trong ngày (rate limiting).
 */
@Entity
@Table(
    name = "ai_usage_daily",
    uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "usage_date"})
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiUsageDaily {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "usage_date", nullable = false)
    private LocalDate usageDate;

    @Column(nullable = false)
    @Builder.Default
    private int count = 0;
}
