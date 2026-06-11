export const GRADES = ['10', '11', '12']

// Temporary fallback options until curriculum frameworks are exposed by the backend.
export const FRAMEWORK_OPTIONS = [
  { value: '', label: '— Không chọn —' },
  { value: '1', label: 'Chương trình GDPT 2018 (Bộ GD&ĐT)' },
  { value: '2', label: 'Chương trình 2006 (Bộ GD&ĐT)' },
  { value: '3', label: 'Chương trình tích hợp' },
]

export const PUBLISH_REQUIREMENTS = [
  { field: 'title', label: 'Tiêu đề', tab: 'basic' },
  { field: 'subject', label: 'Môn học', tab: 'basic' },
  { field: 'gradeLevel', label: 'Khối lớp', tab: 'basic' },
  { field: 'topic', label: 'Chủ đề / Nội dung', tab: 'basic' },
  { field: 'durationMinutes', label: 'Thời lượng', tab: 'basic' },
  { field: 'objectives', label: 'Mục tiêu học tập', tab: 'objectives' },
  { field: 'activities', label: 'Hoạt động dạy học', tab: 'activities' },
  { field: 'assessment', label: 'Kiểm tra & Đánh giá', tab: 'assessment' },
  { field: 'materials', label: 'Tài liệu & Thiết bị', tab: 'materials' },
]

export function getFrameworkLabel(frameworkId) {
  if (frameworkId == null || frameworkId === '') return null

  const option = FRAMEWORK_OPTIONS.find(({ value }) => value === String(frameworkId))
  return option?.label || `Framework #${frameworkId}`
}

export function getPublishMissingFields(data) {
  return PUBLISH_REQUIREMENTS.filter(({ field }) => {
    if (field === 'durationMinutes') {
      return !(Number(data?.durationMinutes) > 0)
    }

    return !String(data?.[field] || '').trim()
  })
}

export function getFirstInvalidTab(missingFields = []) {
  return missingFields[0]?.tab || 'basic'
}
