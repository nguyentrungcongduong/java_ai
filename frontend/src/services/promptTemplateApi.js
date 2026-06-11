import api from './api';

const promptTemplateApi = {
  // Lấy danh sách template đã APPROVED theo mục đích (dùng cho Teacher)
  getApproved: (purpose) =>
    api.get('/prompt-templates/approved', { params: purpose ? { purpose } : {} }),

  // Sinh nội dung từ template (gọi AI với biến đã điền)
  generate: (templateId, inputs) =>
    api.post('/prompt-templates/generate', { templateId, inputs }),
};

export default promptTemplateApi;
