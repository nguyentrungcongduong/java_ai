UPDATE ai_prompt_templates SET status = 'APPROVED' WHERE id BETWEEN 16 AND 26;
SELECT id, title, status FROM ai_prompt_templates WHERE id BETWEEN 16 AND 26;
