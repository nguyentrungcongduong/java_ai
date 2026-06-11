import api from './api';

const analyticsApi = {
  /** [KAN-26] Thống kê kết quả một đề thi */
  getExamResults: (examId) =>
    api.get(`/analytics/exams/${examId}/results`).then((r) => r.data),

  /** [KAN-26] Tổng quan nhóm học sinh – Teacher */
  getStudentAnalytics: () =>
    api.get('/analytics/students').then((r) => r.data),

  /** [KAN-26] Báo cáo doanh thu – Manager/Admin */
  getRevenueAnalytics: () =>
    api.get('/analytics/revenue').then((r) => r.data),

  /** [KAN-26] Báo cáo người dùng – Admin only */
  getUserAnalytics: () =>
    api.get('/analytics/users').then((r) => r.data),
};

export default analyticsApi;
