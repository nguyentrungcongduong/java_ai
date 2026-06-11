import api from './api'

/**
 * answerSheetApi – Gọi các endpoint /api/v1/answer-sheets
 */
export const answerSheetApi = {
  /**
   * Lấy danh sách bài làm đã upload (có phân trang).
   * @param {object} params - { exam_id?, page?, size? }
   */
  getAnswerSheets: (params = {}) =>
    api.get('/answer-sheets', { params }),

  /**
   * Upload nhiều file bài làm cho một đề thi.
   * @param {number|string} examId - ID đề thi
   * @param {File[]} files - Mảng file ảnh / PDF
   */
  uploadAnswerSheets: (examId, files) => {
    const formData = new FormData()
    formData.append('exam_id', examId)
    files.forEach((file) => formData.append('files', file))
    return api.post('/answer-sheets/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  /**
   * Xem chi tiết một bài làm (bao gồm ocrRawData nếu đã xử lý).
   * @param {number} id
   */
  getAnswerSheet: (id) =>
    api.get(`/answer-sheets/${id}`),

  /**
   * Kích hoạt OCR cho một bài làm.
   * @param {number} id
   */
  processAnswerSheet: (id) =>
    api.post(`/answer-sheets/${id}/process`),

  /**
   * Lưu đáp án đã chỉnh sửa thủ công của giáo viên.
   * @param {number} id - Answer sheet ID
   * @param {{ answers: Array<{question_number: string, answer: string|null}> }} body
   */
  saveOcrAnswers: (id, body) =>
    api.patch(`/answer-sheets/${id}/ocr-answers`, body),
}

export default answerSheetApi
