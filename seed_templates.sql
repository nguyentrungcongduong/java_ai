-- Admin user id = 1 (admin@planbookai.com)
SET @admin_id = 1;


-- Tạo 11 template cho 11 môn THPT, status APPROVED
INSERT INTO ai_prompt_templates (title, purpose, prompt_text, variables, status, created_by, created_at, updated_at)
VALUES

('Soạn giáo án Toán học THPT', 'LESSON_PLAN_GEN',
'Bạn là chuyên gia giáo dục Toán học THPT. Hãy soạn một giáo án chi tiết theo các yêu cầu sau:\n- Môn học: {{subject}}\n- Khối lớp: {{grade}}\n- Chủ đề / Bài học: {{topic}}\n- Mục tiêu: {{objectives}}\n- Thời lượng: {{duration}}\n- Khung chương trình: {{framework}}\n\nGiáo án phải có đầy đủ các phần theo cấu trúc: {{framework_structure}}\n\nYêu cầu:\n1. Mục tiêu bài học rõ ràng (kiến thức, kỹ năng, thái độ)\n2. Hoạt động khởi động tạo hứng thú với các bài toán thực tế\n3. Nội dung kiến thức có ví dụ minh hoạ cụ thể, bài tập từ cơ bản đến nâng cao\n4. Phương pháp dạy học tích cực (thảo luận nhóm, giải quyết vấn đề)\n5. Kiểm tra đánh giá phù hợp\nViết bằng tiếng Việt, chi tiết và có thể sử dụng ngay.',
'["subject","grade","topic","objectives","duration","framework","framework_structure"]',
'APPROVED', @admin_id, NOW(), NOW()),

('Soạn giáo án Ngữ văn THPT', 'LESSON_PLAN_GEN',
'Bạn là chuyên gia giáo dục Ngữ văn THPT. Hãy soạn một giáo án chi tiết theo các yêu cầu sau:\n- Môn học: {{subject}}\n- Khối lớp: {{grade}}\n- Chủ đề / Bài học: {{topic}}\n- Mục tiêu: {{objectives}}\n- Thời lượng: {{duration}}\n- Khung chương trình: {{framework}}\n\nGiáo án phải có đầy đủ các phần: {{framework_structure}}\n\nYêu cầu:\n1. Mục tiêu: đọc hiểu, viết, nói nghe\n2. Hoạt động khởi động liên kết tác phẩm với cuộc sống\n3. Phân tích văn bản theo đặc trưng thể loại\n4. Câu hỏi gợi mở, thảo luận sáng tạo\n5. Đánh giá năng lực ngôn ngữ và văn học\nViết bằng tiếng Việt, chi tiết và có thể sử dụng ngay.',
'["subject","grade","topic","objectives","duration","framework","framework_structure"]',
'APPROVED', @admin_id, NOW(), NOW()),

('Soạn giáo án Tiếng Anh THPT', 'LESSON_PLAN_GEN',
'You are an expert English teacher for Vietnamese high school. Create a detailed lesson plan:\n- Subject: {{subject}}\n- Grade: {{grade}}\n- Topic/Unit: {{topic}}\n- Objectives: {{objectives}}\n- Duration: {{duration}}\n- Framework: {{framework}}\n\nLesson plan must follow this structure: {{framework_structure}}\n\nRequirements:\n1. Clear learning objectives (listening, speaking, reading, writing skills)\n2. Warm-up activity related to real-life context\n3. Main activities with communicative language teaching approach\n4. Practice exercises (controlled → freer practice)\n5. Assessment rubrics for speaking/writing\nWrite in Vietnamese, detailed and ready to use.',
'["subject","grade","topic","objectives","duration","framework","framework_structure"]',
'APPROVED', @admin_id, NOW(), NOW()),

('Soạn giáo án Vật lý THPT', 'LESSON_PLAN_GEN',
'Bạn là chuyên gia giáo dục Vật lý THPT. Hãy soạn một giáo án chi tiết:\n- Môn học: {{subject}}\n- Khối lớp: {{grade}}\n- Chủ đề / Bài học: {{topic}}\n- Mục tiêu: {{objectives}}\n- Thời lượng: {{duration}}\n- Khung chương trình: {{framework}}\n\nCấu trúc giáo án: {{framework_structure}}\n\nYêu cầu:\n1. Mục tiêu gắn với hiện tượng vật lý thực tế\n2. Thí nghiệm/video minh hoạ trực quan\n3. Xây dựng kiến thức từ hiện tượng → lý thuyết → công thức\n4. Bài tập định tính và định lượng\n5. Liên hệ ứng dụng kỹ thuật và đời sống\nViết bằng tiếng Việt, chi tiết và có thể sử dụng ngay.',
'["subject","grade","topic","objectives","duration","framework","framework_structure"]',
'APPROVED', @admin_id, NOW(), NOW()),

('Soạn giáo án Hóa học THPT', 'LESSON_PLAN_GEN',
'Bạn là chuyên gia giáo dục Hóa học THPT. Hãy soạn một giáo án chi tiết:\n- Môn học: {{subject}}\n- Khối lớp: {{grade}}\n- Chủ đề / Bài học: {{topic}}\n- Mục tiêu: {{objectives}}\n- Thời lượng: {{duration}}\n- Khung chương trình: {{framework}}\n\nCấu trúc giáo án: {{framework_structure}}\n\nYêu cầu:\n1. Mục tiêu về kiến thức hóa học, kỹ năng thí nghiệm, tư duy khoa học\n2. Thí nghiệm minh họa an toàn (có thể thực tế hoặc video)\n3. Phương trình hóa học đầy đủ, giải thích cơ chế\n4. Bài tập từ nhận biết → thông hiểu → vận dụng\n5. Liên hệ hóa học với đời sống và môi trường\nViết bằng tiếng Việt, chi tiết và có thể sử dụng ngay.',
'["subject","grade","topic","objectives","duration","framework","framework_structure"]',
'APPROVED', @admin_id, NOW(), NOW()),

('Soạn giáo án Sinh học THPT', 'LESSON_PLAN_GEN',
'Bạn là chuyên gia giáo dục Sinh học THPT. Hãy soạn một giáo án chi tiết:\n- Môn học: {{subject}}\n- Khối lớp: {{grade}}\n- Chủ đề / Bài học: {{topic}}\n- Mục tiêu: {{objectives}}\n- Thời lượng: {{duration}}\n- Khung chương trình: {{framework}}\n\nCấu trúc giáo án: {{framework_structure}}\n\nYêu cầu:\n1. Mục tiêu về kiến thức sinh học, kỹ năng quan sát và tư duy khoa học\n2. Hình ảnh/sơ đồ minh hoạ cấu trúc sinh học\n3. Tích hợp kiến thức liên môn (hóa học, vật lý)\n4. Bài tập tình huống thực tế (y học, nông nghiệp, môi trường)\n5. Hoạt động thực hành quan sát mẫu vật\nViết bằng tiếng Việt, chi tiết và có thể sử dụng ngay.',
'["subject","grade","topic","objectives","duration","framework","framework_structure"]',
'APPROVED', @admin_id, NOW(), NOW()),

('Soạn giáo án Lịch sử THPT', 'LESSON_PLAN_GEN',
'Bạn là chuyên gia giáo dục Lịch sử THPT. Hãy soạn một giáo án chi tiết:\n- Môn học: {{subject}}\n- Khối lớp: {{grade}}\n- Chủ đề / Bài học: {{topic}}\n- Mục tiêu: {{objectives}}\n- Thời lượng: {{duration}}\n- Khung chương trình: {{framework}}\n\nCấu trúc giáo án: {{framework_structure}}\n\nYêu cầu:\n1. Mục tiêu về kiến thức lịch sử, kỹ năng phân tích sự kiện, thái độ yêu nước\n2. Sử dụng tư liệu, hình ảnh, bản đồ lịch sử\n3. Phương pháp kể chuyện, đóng vai, tranh luận\n4. Câu hỏi so sánh, đánh giá sự kiện lịch sử\n5. Liên hệ bài học lịch sử với hiện tại\nViết bằng tiếng Việt, chi tiết và có thể sử dụng ngay.',
'["subject","grade","topic","objectives","duration","framework","framework_structure"]',
'APPROVED', @admin_id, NOW(), NOW()),

('Soạn giáo án Địa lý THPT', 'LESSON_PLAN_GEN',
'Bạn là chuyên gia giáo dục Địa lý THPT. Hãy soạn một giáo án chi tiết:\n- Môn học: {{subject}}\n- Khối lớp: {{grade}}\n- Chủ đề / Bài học: {{topic}}\n- Mục tiêu: {{objectives}}\n- Thời lượng: {{duration}}\n- Khung chương trình: {{framework}}\n\nCấu trúc giáo án: {{framework_structure}}\n\nYêu cầu:\n1. Mục tiêu về kiến thức địa lý tự nhiên/kinh tế-xã hội, kỹ năng đọc bản đồ\n2. Sử dụng bản đồ, biểu đồ, hình ảnh thực tế\n3. Phân tích mối quan hệ giữa tự nhiên và kinh tế-xã hội\n4. Bài tập nhận xét biểu đồ, phân tích số liệu\n5. Liên hệ địa lý Việt Nam và thế giới\nViết bằng tiếng Việt, chi tiết và có thể sử dụng ngay.',
'["subject","grade","topic","objectives","duration","framework","framework_structure"]',
'APPROVED', @admin_id, NOW(), NOW()),

('Soạn giáo án GDCD THPT', 'LESSON_PLAN_GEN',
'Bạn là chuyên gia giáo dục GDCD THPT. Hãy soạn một giáo án chi tiết:\n- Môn học: {{subject}}\n- Khối lớp: {{grade}}\n- Chủ đề / Bài học: {{topic}}\n- Mục tiêu: {{objectives}}\n- Thời lượng: {{duration}}\n- Khung chương trình: {{framework}}\n\nCấu trúc giáo án: {{framework_structure}}\n\nYêu cầu:\n1. Mục tiêu về nhận thức pháp luật/đạo đức, kỹ năng sống, hành vi tích cực\n2. Tình huống thực tế gắn với đời sống học sinh\n3. Phương pháp thảo luận nhóm, sắm vai, nghiên cứu tình huống\n4. Câu hỏi mở khuyến khích tư duy phản biện\n5. Liên hệ quyền và nghĩa vụ công dân\nViết bằng tiếng Việt, chi tiết và có thể sử dụng ngay.',
'["subject","grade","topic","objectives","duration","framework","framework_structure"]',
'APPROVED', @admin_id, NOW(), NOW()),

('Soạn giáo án Tin học THPT', 'LESSON_PLAN_GEN',
'Bạn là chuyên gia giáo dục Tin học THPT. Hãy soạn một giáo án chi tiết:\n- Môn học: {{subject}}\n- Khối lớp: {{grade}}\n- Chủ đề / Bài học: {{topic}}\n- Mục tiêu: {{objectives}}\n- Thời lượng: {{duration}}\n- Khung chương trình: {{framework}}\n\nCấu trúc giáo án: {{framework_structure}}\n\nYêu cầu:\n1. Mục tiêu về kiến thức lý thuyết và kỹ năng thực hành máy tính\n2. Kết hợp lý thuyết ngắn gọn và thực hành nhiều\n3. Bài tập thực hành từng bước rõ ràng\n4. Tích hợp an toàn thông tin và đạo đức số\n5. Sản phẩm cuối bài có thể kiểm tra được\nViết bằng tiếng Việt, chi tiết và có thể sử dụng ngay.',
'["subject","grade","topic","objectives","duration","framework","framework_structure"]',
'APPROVED', @admin_id, NOW(), NOW()),

('Soạn giáo án Công nghệ THPT', 'LESSON_PLAN_GEN',
'Bạn là chuyên gia giáo dục Công nghệ THPT. Hãy soạn một giáo án chi tiết:\n- Môn học: {{subject}}\n- Khối lớp: {{grade}}\n- Chủ đề / Bài học: {{topic}}\n- Mục tiêu: {{objectives}}\n- Thời lượng: {{duration}}\n- Khung chương trình: {{framework}}\n\nCấu trúc giáo án: {{framework_structure}}\n\nYêu cầu:\n1. Mục tiêu về kiến thức kỹ thuật và kỹ năng thực hành\n2. Quan sát mô hình, vật thật hoặc video kỹ thuật\n3. Quy trình thực hành an toàn từng bước\n4. Liên hệ ứng dụng công nghệ trong đời sống và sản xuất\n5. Đánh giá sản phẩm thực hành\nViết bằng tiếng Việt, chi tiết và có thể sử dụng ngay.',
'["subject","grade","topic","objectives","duration","framework","framework_structure"]',
'APPROVED', @admin_id, NOW(), NOW());
