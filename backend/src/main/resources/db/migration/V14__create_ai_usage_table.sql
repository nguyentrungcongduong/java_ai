-- V14: Bảng theo dõi lượt dùng AI theo user/ngày (rate limiting)
CREATE TABLE ai_usage_daily (
    id          BIGINT          AUTO_INCREMENT PRIMARY KEY,
    user_id     BIGINT          NOT NULL,
    usage_date  DATE            NOT NULL,
    count       INT             NOT NULL DEFAULT 0,
    UNIQUE KEY uq_user_date (user_id, usage_date),
    CONSTRAINT fk_ai_usage_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_ai_usage_user_date ON ai_usage_daily (user_id, usage_date);
