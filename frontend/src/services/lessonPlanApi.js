import api from './api'

const lessonPlanApi = {
  getMyLessonPlans: (params = {}) => api.get('/lesson-plans', { params }),

  createLessonPlan: (data) => api.post('/lesson-plans', data),

  getLessonPlan: (id) => api.get(`/lesson-plans/${id}`),

  updateLessonPlan: (id, data) => api.put(`/lesson-plans/${id}`, data),

  deleteLessonPlan: (id) => api.delete(`/lesson-plans/${id}`),

  publishLessonPlan: (id) => api.put(`/lesson-plans/${id}/publish`),

  generatePreview: (data) =>
    api.post('/ai/lesson-plans/generate', { ...data, saveToDb: false }),

  generateFromFile: (file, params = {}) => {
    const formData = new FormData()
    formData.append('file', file)
    if (params.gradeLevel)      formData.append('gradeLevel', params.gradeLevel)
    if (params.durationMinutes) formData.append('durationMinutes', String(params.durationMinutes))
    if (params.framework)       formData.append('framework', params.framework)
    if (params.objectives)      formData.append('objectives', params.objectives)
    return api.post('/ai/lesson-plans/generate-from-file', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  saveEdited: (data) =>
    api.post('/ai/lesson-plans/save', data),

  generateAndSave: (data) =>
    api.post('/ai/lesson-plans/generate', { ...data, saveToDb: true }),

  getAll: () => api.get('/ai/lesson-plans'),

  getById: (id) => api.get(`/ai/lesson-plans/${id}`),
}

export default lessonPlanApi
