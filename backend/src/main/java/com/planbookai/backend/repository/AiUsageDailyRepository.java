package com.planbookai.backend.repository;

import com.planbookai.backend.model.entity.AiUsageDaily;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Optional;

@Repository
public interface AiUsageDailyRepository extends JpaRepository<AiUsageDaily, Long> {

    Optional<AiUsageDaily> findByUserIdAndUsageDate(Long userId, LocalDate date);

    /**
     * Tăng counter +1 cho user/ngày, tạo mới nếu chưa tồn tại (upsert).
     */
    @Modifying
    @Query(value = """
            INSERT INTO ai_usage_daily (user_id, usage_date, count)
            VALUES (:userId, :date, 1)
            ON DUPLICATE KEY UPDATE count = count + 1
            """, nativeQuery = true)
    void incrementCount(@Param("userId") Long userId, @Param("date") LocalDate date);
}
