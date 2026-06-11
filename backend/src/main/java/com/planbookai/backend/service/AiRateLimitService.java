package com.planbookai.backend.service;

import com.planbookai.backend.exception.AiRateLimitException;
import com.planbookai.backend.model.entity.AiUsageDaily;
import com.planbookai.backend.model.entity.Role;
import com.planbookai.backend.model.entity.User;
import com.planbookai.backend.repository.AiUsageDailyRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Optional;

/**
 * Quản lý rate limit lượt dùng AI theo user/ngày.
 *
 * <p>Logic ưu tiên:
 * <ol>
 *   <li>ADMIN → không bị giới hạn bao giờ</li>
 *   <li>User thường → tối đa {@code ai.rate-limit.free-user-daily} lần/ngày</li>
 * </ol>
 *
 * <p>Quota reset lúc 00:00 UTC mỗi ngày (dựa vào cột {@code usage_date}).
 */
@Service
@RequiredArgsConstructor
public class AiRateLimitService {

    private static final Logger log = LoggerFactory.getLogger(AiRateLimitService.class);

    private final AiUsageDailyRepository usageRepo;

    @Value("${ai.rate-limit.free-user-daily:10}")
    private int freeUserDailyLimit;

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Kiểm tra quota rồi tăng counter.
     * Gọi trước mỗi lần invoke AI provider.
     *
     * @param user User hiện tại (từ SecurityContext)
     * @throws AiRateLimitException nếu đã hết quota hôm nay
     */
    @Transactional
    public void checkAndIncrement(User user) {
        if (isExempt(user)) {
            log.debug("[RateLimit] User {} (ADMIN) exempt from AI rate limit", user.getId());
            return;
        }

        LocalDate today = LocalDate.now();
        int currentCount = getCurrentCount(user.getId(), today);

        if (currentCount >= freeUserDailyLimit) {
            log.warn("[RateLimit] User {} exceeded AI quota: {}/{}", user.getId(), currentCount, freeUserDailyLimit);
            throw new AiRateLimitException(currentCount, freeUserDailyLimit);
        }

        // Tăng counter (upsert)
        usageRepo.incrementCount(user.getId(), today);
        log.debug("[RateLimit] User {} AI usage: {}/{}", user.getId(), currentCount + 1, freeUserDailyLimit);
    }

    /**
     * Trả về thông tin quota hiện tại của user (dùng cho endpoint /me/ai-quota).
     */
    public AiQuotaInfo getQuota(User user) {
        if (isExempt(user)) {
            return new AiQuotaInfo(0, -1, freeUserDailyLimit, true);
        }
        LocalDate today = LocalDate.now();
        int used = getCurrentCount(user.getId(), today);
        int remaining = Math.max(0, freeUserDailyLimit - used);
        return new AiQuotaInfo(used, remaining, freeUserDailyLimit, false);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private boolean isExempt(User user) {
        if (user.getRole() == null) return false;
        Role.RoleName roleName = user.getRole().getName();
        return roleName == Role.RoleName.ADMIN;
    }

    private int getCurrentCount(Long userId, LocalDate date) {
        Optional<AiUsageDaily> record = usageRepo.findByUserIdAndUsageDate(userId, date);
        return record.map(AiUsageDaily::getCount).orElse(0);
    }

    // -------------------------------------------------------------------------
    // DTO nội bộ
    // -------------------------------------------------------------------------

    public record AiQuotaInfo(int used, int remaining, int limit, boolean unlimited) {}
}
