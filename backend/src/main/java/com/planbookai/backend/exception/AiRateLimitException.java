package com.planbookai.backend.exception;

import java.time.LocalDate;

/**
 * Thrown khi user vượt quá giới hạn lượt dùng AI trong ngày.
 * Handler sẽ map exception này → HTTP 429 Too Many Requests.
 */
public class AiRateLimitException extends RuntimeException {

    private final int used;
    private final int limit;
    private final LocalDate resetDate;

    public AiRateLimitException(int used, int limit) {
        super(String.format(
            "Bạn đã dùng hết %d/%d lượt AI hôm nay. Quota sẽ reset lúc 00:00 UTC ngày mai.",
            used, limit
        ));
        this.used = used;
        this.limit = limit;
        this.resetDate = LocalDate.now().plusDays(1);
    }

    public int getUsed()           { return used; }
    public int getLimit()          { return limit; }
    public LocalDate getResetDate(){ return resetDate; }
}
