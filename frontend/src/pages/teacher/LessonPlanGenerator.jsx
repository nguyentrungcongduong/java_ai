import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  BookOpen,
  Sparkles,
  Loader2,
  Save,
  RotateCw,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  Target,
  Package,
  Layout,
  ClipboardCheck,
  Home,
  StickyNote,
  FileEdit,
  FileUp,
  X,
  FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import lessonPlanApi from '../../services/lessonPlanApi'
import promptTemplateApi from '../../services/promptTemplateApi'
import frameworkApi from '../../services/frameworkApi'

/**
 * LessonPlanGenerator – Trang sinh giáo án bằng AI.
 *
 * Luồng state rõ ràng:
 * - form               → input form (subject, gradeLevel, topic, ...)
 * - aiGeneratedData    → raw AI response, không bind trực tiếp vào editor
 * - editorValue        → state dùng cho editor (clone của aiGeneratedData sau map)
 * - isGenerating       → đang gọi AI
 * - isSaving           → đang save
 * - isDirty            → user đã sửa khác với bản AI gần nhất
 * - generateError      → lỗi generate
 * - saveError          → lỗi save
 *
 * Luồng UX:
 * 1. User nhập form → bấm "Tạo với AI"
 * 2. AI sinh → hiện trong editor, user sửa được
 * 3. User bấm "Tạo lại" → confirm nếu dirty → gọi lại AI → cập nhật editor
 * 4. User bấm "Lưu" → lưu editorValue hiện tại (sau chỉnh sửa)
 */
const LessonPlanGenerator = ({ onBack }) => {
  const navigate = useNavigate()

  // --- Form State (input fields) ---
  const [form, setForm] = useState({
    subject: '',
    gradeLevel: '',
    topic: '',
    objectives: '',
    durationMinutes: 45,
    framework: 'E5',
  })

  // --- Template state ---
  const [lessonTemplates, setLessonTemplates] = useState([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')

  // --- Curriculum Framework state ---
  const [curriculumFrameworks, setCurriculumFrameworks] = useState([])
  const [selectedFrameworkId, setSelectedFrameworkId] = useState('')

  // --- File Upload State ---
  const [uploadedFile, setUploadedFile] = useState(null)
  const fileInputRef = useRef(null)

  // --- AI Generation State ---
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')

  // --- Raw AI response (không bind trực tiếp vào editor) ---
  const [aiGeneratedData, setAiGeneratedData] = useState(null)

  // --- Editor State (working state - what user edits) ---
  const [hasGenerated, setHasGenerated] = useState(false)
  const [editorValue, setEditorValue] = useState(null)

  // --- Save State ---
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // --- Dirty State ---
  const [isDirty, setIsDirty] = useState(false)

  // --- Confirm dialog state ---
  const [showRegenConfirm, setShowRegenConfirm] = useState(false)

  // --- Ref để so sánh deep compare editorValue vs AI response ---
  const lastAiDataRef = useRef(null)

  // --- Expanded sections in preview ---
  const [expandedSections, setExpandedSections] = useState({
    objectives: true,
    materials: true,
    lessonFlow: true,
    assessment: true,
    homework: false,
    notes: false,
  })

  // --- Map AI response → editor value (clone để editor không bind trực tiếp vào raw response) ---
  const mapAiToEditor = useCallback((data) => {
    if (!data) return null
    return {
      title: data.title || '',
      subject: data.subject || form.subject || '',
      gradeLevel: data.gradeLevel || form.gradeLevel || '',
      framework: data.framework || form.framework || 'E5',
      materials: Array.isArray(data.materialItems) ? [...data.materialItems] : [],
      objectives: Array.isArray(data.lessonObjectives) ? [...data.lessonObjectives] : [],
      lessonFlow: Array.isArray(data.lessonFlow)
        ? data.lessonFlow.map((p) => ({ ...p }))
        : [],
      assessment: {
        methods: Array.isArray(data.assessmentDetail?.methods) ? [...data.assessmentDetail.methods] : [],
        criteria: data.assessmentDetail?.criteria || '',
      },
      homework: data.homework || '',
      notes: data.notes || '',
    }
  }, [form.subject, form.gradeLevel, form.framework])

  // --- Sync editorValue khi AI generate thành công ---
  useEffect(() => {
    if (aiGeneratedData) {
      const mapped = mapAiToEditor(aiGeneratedData)
      setEditorValue(mapped)
      setHasGenerated(true)
      setIsDirty(false) // bản mới từ AI chưa sửa → không dirty
      lastAiDataRef.current = aiGeneratedData
    }
  }, [aiGeneratedData, mapAiToEditor])

  // --- Track dirty state khi user sửa editor ---
  useEffect(() => {
    if (!hasGenerated || !editorValue || !lastAiDataRef.current) return
    const currentEditorJson = JSON.stringify(editorValue)
    const lastAiJson = JSON.stringify(mapAiToEditor(lastAiDataRef.current))
    setIsDirty(currentEditorJson !== lastAiJson)
  }, [editorValue, hasGenerated, mapAiToEditor])

  // --- Warn khi user rời trang với dữ liệu chưa lưu ---
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  // --- Fetch approved LESSON_PLAN_GEN templates on mount ---
  useEffect(() => {
    promptTemplateApi.getApproved('LESSON_PLAN_GEN')
      .then(res => setLessonTemplates(res.data || []))
      .catch(() => {}) // silent fail
  }, [])

  // --- Fetch published Curriculum Frameworks on mount ---
  useEffect(() => {
    frameworkApi.getPublishedFrameworks()
      .then(res => setCurriculumFrameworks(res.data || []))
      .catch(() => {})
  }, [])

  // --- Update form field ---
  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  // --- Internal generate logic (dùng chung cho lần đầu và regenerate) ---
  const doGenerate = async () => {
    setIsGenerating(true)
    setGenerateError('')
    setAiGeneratedData(null)
    setEditorValue(null)
    setHasGenerated(false)
    setIsDirty(false)
    setSaveError('')

    try {
      // Lấy cấu trúc framework từ DB nếu Teacher đã chọn
      const selectedFw = curriculumFrameworks.find(f => String(f.id) === String(selectedFrameworkId))
      const frameworkStructure = selectedFw?.structure
        ? (typeof selectedFw.structure === 'string'
            ? selectedFw.structure
            : JSON.stringify(selectedFw.structure, null, 2))
        : form.framework // fallback về E5/E3...

      if (selectedTemplateId) {
        // ── Dùng Prompt Template đã duyệt ──
        const inputs = {
          subject: form.subject,
          grade: form.gradeLevel,
          topic: form.topic,
          objectives: form.objectives || '',
          duration: String(form.durationMinutes) + ' phút',
          framework: selectedFw ? selectedFw.title : form.framework,
          framework_structure: frameworkStructure,
        }
        const res = await promptTemplateApi.generate(Number(selectedTemplateId), inputs)
        const rawContent = res.data?.content || ''

        // Thử parse JSON từ AI response
        let parsedData = null
        try {
          // Tìm JSON block trong response (AI đôi khi trả về text + JSON)
          const jsonMatch = rawContent.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            parsedData = JSON.parse(jsonMatch[0])
          }
        } catch (e) {
          // Parse thất bại → dùng notes fallback
        }

        if (parsedData) {
          // ✅ Parse thành công → map đúng fields
          setAiGeneratedData({
            title: parsedData.title || `Giáo án: ${form.topic}`,
            subject: parsedData.subject || form.subject,
            gradeLevel: parsedData.gradeLevel || form.gradeLevel,
            framework: parsedData.framework || selectedFw?.title || form.framework,
            lessonObjectives: Array.isArray(parsedData.lessonObjectives) ? parsedData.lessonObjectives : [],
            materialItems: Array.isArray(parsedData.materialItems) ? parsedData.materialItems : [],
            lessonFlow: Array.isArray(parsedData.lessonFlow) ? parsedData.lessonFlow : [],
            assessmentDetail: parsedData.assessmentDetail || { methods: [], criteria: '' },
            homework: parsedData.homework || '',
            notes: parsedData.notes || '',
          })
          toast.success('AI đã sinh giáo án từ template!')
        } else {
          // ❌ Không parse được → hiển thị raw text trong notes
          setAiGeneratedData({
            title: `Giáo án: ${form.topic}`,
            subject: form.subject,
            gradeLevel: form.gradeLevel,
            framework: selectedFw?.title || form.framework,
            notes: rawContent,
            lessonObjectives: [],
            materialItems: [],
            lessonFlow: [],
            assessmentDetail: { methods: [], criteria: '' },
            homework: '',
          })
          toast.success('AI đã sinh giáo án (dạng văn bản) từ template!')
        }
      } else {
        // ── Dùng prompt mặc định ──
        const res = await lessonPlanApi.generatePreview({
          subject: form.subject,
          gradeLevel: form.gradeLevel,
          topic: form.topic,
          objectives: form.objectives || '',
          durationMinutes: form.durationMinutes,
          framework: selectedFw ? selectedFw.title : form.framework,
          frameworkStructure: frameworkStructure,
        })
        setAiGeneratedData(res.data)
        toast.success('AI đã sinh giáo án thành công!')
      }

    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Có lỗi xảy ra'
      setGenerateError(msg)
      toast.error(msg)
    } finally {
      setIsGenerating(false)
    }
  }

  // --- Generate lesson plan from file ---
  const doGenerateFromFile = async () => {
    if (!uploadedFile) return toast.error('Vui lòng chọn file PDF hoặc DOCX')
    if (!form.gradeLevel.trim()) return toast.error('Vui lòng nhập khối lớp')

    setIsGenerating(true)
    setGenerateError('')
    setAiGeneratedData(null)
    setEditorValue(null)
    setHasGenerated(false)
    setIsDirty(false)
    setSaveError('')

    try {
      const res = await lessonPlanApi.generateFromFile(uploadedFile, {
        gradeLevel: form.gradeLevel,
        durationMinutes: form.durationMinutes,
        framework: form.framework,
        objectives: form.objectives || '',
      })
      setAiGeneratedData(res.data)
      toast.success('AI đã sinh giáo án từ tài liệu thành công!')
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Có lỗi xảy ra'
      setGenerateError(msg)
      toast.error(msg)
    } finally {
      setIsGenerating(false)
    }
  }

  // --- Generate lesson plan (lần đầu) ---
  const handleGenerate = async () => {
    if (!form.subject.trim()) return toast.error('Vui lòng nhập môn học')
    if (!form.gradeLevel.trim()) return toast.error('Vui lòng nhập khối lớp')
    if (!form.topic.trim()) return toast.error('Vui lòng nhập chủ đề')
    await doGenerate()
  }

  // --- Regenerate với confirm nếu đang dirty ---
  const handleRegenerate = async () => {
    if (isDirty) {
      setShowRegenConfirm(true)
      return
    }
    await doGenerate()
  }

  // --- Confirm regenerate (đã có confirm modal) ---
  const handleConfirmRegenerate = async () => {
    setShowRegenConfirm(false)
    await doGenerate()
  }

  // --- Save lesson plan (lưu editorValue hiện tại, không phải form hay raw response) ---
  const handleSave = async () => {
    if (!editorValue) return

    setIsSaving(true)
    setSaveError('')

    try {
      // Lưu đúng nội dung user đang sửa trong editor – gọi API save riêng không qua generateAndSave
      const res = await lessonPlanApi.saveEdited({
        subject: editorValue.subject || form.subject,
        gradeLevel: editorValue.gradeLevel || form.gradeLevel,
        topic: form.topic,
        objectives: form.objectives || '',
        durationMinutes: form.durationMinutes,
        framework: editorValue.framework || form.framework,
        // Gửi lesson plan data từ editor state
        title: editorValue.title,
        materials: editorValue.materials,
        lessonPlanObjectives: editorValue.objectives,
        lessonFlow: editorValue.lessonFlow,
        assessment: editorValue.assessment,
        homework: editorValue.homework,
        notes: editorValue.notes,
      })
      setAiGeneratedData(res.data)
      toast.success('Giáo án đã được lưu thành công!')
      if (onBack) {
        onBack()
      } else {
        navigate('/lesson-plans')
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Có lỗi khi lưu giáo án'
      setSaveError(msg)
      toast.error(msg)
      // KHÔNG reset editorValue khi save thất bại → giữ nguyên dữ liệu user đã sửa
    } finally {
      setIsSaving(false)
    }
  }

  // --- Update editor field (editable) ---
  const handleEditorChange = (field, value) => {
    setEditorValue((prev) => ({ ...prev, [field]: value }))
  }

  // --- Update lesson phase (editable flow step) ---
  const handlePhaseChange = (phaseIndex, field, value) => {
    setEditorValue((prev) => {
      const newFlow = [...(prev.lessonFlow || [])]
      newFlow[phaseIndex] = { ...newFlow[phaseIndex], [field]: value }
      return { ...prev, lessonFlow: newFlow }
    })
  }

  // --- Toggle section expansion ---
  const toggleSection = (section) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  const handleBack = () => {
    if (onBack) {
      onBack()
      return
    }
    navigate('/lesson-plans')
  }

  // --- Render section header ---
  const renderSectionHeader = (icon, label, sectionKey, count) => (
    <button
      onClick={() => toggleSection(sectionKey)}
      className="w-full flex items-center justify-between px-4 py-3 bg-slate-100 hover:bg-slate-200 transition-colors rounded-xl text-left"
    >
      <div className="flex items-center gap-2 font-bold text-slate-700">
        {icon}
        <span>{label}</span>
        {count != null && (
          <span className="text-xs font-medium text-slate-400">({count})</span>
        )}
      </div>
      {expandedSections[sectionKey] ? (
        <ChevronUp size={16} className="text-slate-400" />
      ) : (
        <ChevronDown size={16} className="text-slate-400" />
      )}
    </button>
  )

  // --- Render editor for a single-line field ---
  const renderSimpleField = (label, value, fieldKey, icon) => (
    <div className="space-y-1">
      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
        {icon}
        {label}
      </label>
      <textarea
        rows={2}
        value={value || ''}
        onChange={(e) => handleEditorChange(fieldKey, e.target.value)}
        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none transition-all"
      />
    </div>
  )

  // --- Render objectives list ---
  const renderObjectives = () => {
    const list = editorValue?.objectives || []
    return (
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
          <Target size={12} />
          Mục tiêu bài học
        </label>
        {list.length === 0 ? (
          <p className="text-sm text-slate-400 italic">Chưa có mục tiêu.</p>
        ) : (
          list.map((obj, idx) => (
            <div key={idx} className="flex gap-2">
              <span className="text-xs font-bold text-indigo-500 mt-2">•</span>
              <input
                value={obj}
                onChange={(e) => {
                  const next = [...list]
                  next[idx] = e.target.value
                  handleEditorChange('objectives', next)
                }}
                className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          ))
        )}
      </div>
    )
  }

  // --- Render lesson flow phases ---
  const renderLessonFlow = () => {
    const phases = editorValue?.lessonFlow || []
    return (
      <div className="space-y-3">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
          <Layout size={12} />
          Các giai đoạn (Buổi học)
        </label>
        {phases.length === 0 ? (
          <p className="text-sm text-slate-400 italic">Chưa có dữ liệu các giai đoạn.</p>
        ) : (
          phases.map((phase, idx) => (
            <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <input
                  value={phase.phase || ''}
                  onChange={(e) => handlePhaseChange(idx, 'phase', e.target.value)}
                  className="font-bold text-slate-800 bg-transparent outline-none focus:ring-2 focus:ring-indigo-500 rounded px-2 py-1"
                  placeholder="Tên giai đoạn"
                />
                <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg flex items-center gap-1">
                  <Clock size={10} />
                  <input
                    type="number"
                    value={phase.timeMinutes || 0}
                    onChange={(e) => handlePhaseChange(idx, 'timeMinutes', parseInt(e.target.value) || 0)}
                    className="w-12 bg-transparent outline-none text-center"
                    min="0"
                  />
                  phút
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Hoạt động</label>
                  <textarea
                    rows={2}
                    value={phase.activities || ''}
                    onChange={(e) => handlePhaseChange(idx, 'activities', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    placeholder="Mô tả hoạt động..."
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Hành động GV</label>
                  <textarea
                    rows={2}
                    value={phase.teacherActions || ''}
                    onChange={(e) => handlePhaseChange(idx, 'teacherActions', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    placeholder="Hành động của giáo viên..."
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Hành động HS</label>
                  <textarea
                    rows={2}
                    value={phase.studentActions || ''}
                    onChange={(e) => handlePhaseChange(idx, 'studentActions', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    placeholder="Hành động của học sinh..."
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    )
  }

  // --- Render assessment section ---
  const renderAssessment = () => {
    const assessment = editorValue?.assessment || {}
    return (
      <div className="space-y-3">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
          <ClipboardCheck size={12} />
          Đánh giá
        </label>
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500">Phương pháp đánh giá</label>
            <textarea
              rows={2}
              value={assessment.methods?.join('\n') || ''}
              onChange={(e) =>
                handleEditorChange('assessment', {
                  ...assessment,
                  methods: e.target.value.split('\n').filter((s) => s.trim()),
                })
              }
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              placeholder="Mỗi phương pháp 1 dòng..."
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500">Tiêu chí đánh giá</label>
            <textarea
              rows={2}
              value={assessment.criteria || ''}
              onChange={(e) =>
                handleEditorChange('assessment', {
                  ...assessment,
                  criteria: e.target.value,
                })
              }
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              placeholder="Tiêu chí đánh giá..."
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Navbar */}
      <div className="h-16 flex items-center px-6 border-b bg-white border-slate-200 justify-between">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-slate-600 hover:text-indigo-600 font-bold transition-colors"
        >
          <ArrowLeft size={20} />
          Quay lại
        </button>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white">
            <BookOpen size={16} />
          </div>
          <span className="font-black text-slate-900 uppercase tracking-widest text-sm">
            Trợ lý soạn giáo án AI
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left: Input Form */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-6 space-y-5">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                  <Sparkles size={20} />
                </div>
                <h2 className="font-black text-slate-800 uppercase tracking-wider text-sm">
                  Cấu hình sinh giáo án
                </h2>
              </div>

              {/* Prompt Template Selector */}
              {lessonTemplates.length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1">
                    <FileText size={12} /> Prompt Template
                    <span className="normal-case font-normal text-slate-400 text-[10px]">(Tuỳ chọn)</span>
                  </label>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    disabled={isGenerating}
                    className="w-full px-3 py-3 bg-indigo-50 border border-indigo-200 rounded-xl text-sm font-bold text-indigo-800 outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 transition-all"
                  >
                    <option value="">-- Dùng prompt mặc định --</option>
                    {lessonTemplates.map(t => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>
                  {selectedTemplateId && (
                    <p className="text-[10px] text-indigo-500 font-semibold">
                      ✅ Sẽ dùng prompt template đã được Manager duyệt
                    </p>
                  )}
                </div>
              )}

              {/* Subject */}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Môn học
                </label>
                <input
                  type="text"
                  value={form.subject}
                  onChange={(e) => handleFormChange('subject', e.target.value)}
                  disabled={isGenerating}
                  placeholder="VD: Toán, Tiếng Việt, Khoa học..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 transition-all"
                />
              </div>


              {/* Grade Level */}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Khối lớp
                </label>
                <input
                  type="text"
                  value={form.gradeLevel}
                  onChange={(e) => handleFormChange('gradeLevel', e.target.value)}
                  disabled={isGenerating}
                  placeholder="VD: Lớp 4, Lớp 10, lớp 11..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 transition-all"
                />
              </div>

              {/* Topic */}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Chủ đề / Bài học
                </label>
                <input
                  type="text"
                  value={form.topic}
                  onChange={(e) => handleFormChange('topic', e.target.value)}
                  disabled={isGenerating}
                  placeholder="VD: Phép cộng phân số, Quang hợp..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 transition-all"
                />
              </div>

              {/* Objectives */}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Mục tiêu bài học (tùy chọn)
                </label>
                <textarea
                  rows={2}
                  value={form.objectives}
                  onChange={(e) => handleFormChange('objectives', e.target.value)}
                  disabled={isGenerating}
                  placeholder="VD: Hiểu khái niệm phân số, Cộng được hai phân số cùng mẫu..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 resize-none transition-all"
                />
              </div>

              {/* Duration & Framework row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Thời lượng
                  </label>
                  <select
                    value={form.durationMinutes}
                    onChange={(e) => handleFormChange('durationMinutes', parseInt(e.target.value))}
                    disabled={isGenerating}
                    className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 transition-all"
                  >
                    <option value={30}>30 phút</option>
                    <option value={45}>45 phút</option>
                    <option value={60}>60 phút</option>
                    <option value={90}>90 phút</option>
                    <option value={120}>120 phút</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Khung chương trình
                  </label>
                  {curriculumFrameworks.length > 0 ? (
                    <>
                      <select
                        value={selectedFrameworkId}
                        onChange={(e) => setSelectedFrameworkId(e.target.value)}
                        disabled={isGenerating}
                        className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 transition-all"
                      >
                        <option value="">-- Chọn khung --</option>
                        {curriculumFrameworks.map(fw => (
                          <option key={fw.id} value={fw.id}>{fw.title}</option>
                        ))}
                      </select>
                      {selectedFrameworkId && (
                        <p className="text-[10px] text-emerald-600 font-semibold">
                          ✅ AI sẽ tạo giáo án đúng cấu trúc khung này
                        </p>
                      )}
                    </>
                  ) : (
                    <select
                      value={form.framework}
                      onChange={(e) => handleFormChange('framework', e.target.value)}
                      disabled={isGenerating}
                      className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 transition-all"
                    >
                      <option value="E5">E5 (5 bước)</option>
                      <option value="E3">E3 (3 bước)</option>
                      <option value="E4">E4 (4 bước)</option>
                      <option value="BACKWARD_DESIGN">Backward Design</option>
                      <option value="TGAP">TGAP</option>
                    </select>
                  )}
                </div>

              </div>

              {/* Divider */}
              <div className="relative flex items-center">
                <div className="flex-1 border-t border-slate-200" />
                <span className="px-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Hoặc nhập từ tài liệu</span>
                <div className="flex-1 border-t border-slate-200" />
              </div>

              {/* File upload area */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <FileUp size={12} />
                  Upload PDF / DOCX (tùy chọn)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) setUploadedFile(f)
                  }}
                />
                {uploadedFile ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-xl">
                    <FileText size={16} className="text-indigo-500 flex-shrink-0" />
                    <span className="text-xs font-medium text-indigo-700 flex-1 truncate">{uploadedFile.name}</span>
                    <button
                      onClick={() => { setUploadedFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isGenerating}
                    className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-xs font-bold text-slate-400 hover:border-indigo-400 hover:text-indigo-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <FileUp size={16} />
                    Chọn file PDF hoặc DOCX
                  </button>
                )}
              </div>

              {/* Generate from file button */}
              {uploadedFile && (
                <button
                  onClick={doGenerateFromFile}
                  disabled={isGenerating}
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 shadow-lg hover:shadow-xl hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating ? (
                    <><Loader2 size={18} className="animate-spin" />AI đang đọc tài liệu...</>
                  ) : (
                    <><FileUp size={18} />Tạo từ tài liệu</>  
                  )}
                </button>
              )}

              {/* Generate button */}
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full py-4 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 shadow-lg hover:shadow-xl hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    AI đang tư duy...
                  </>
                ) : (
                  <>
                    <Sparkles size={20} />
                    Tạo với AI
                  </>
                )}
              </button>

              {/* Generate error */}
              {generateError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-600 font-medium">{generateError}</p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Editor Preview */}
          <div className="lg:col-span-8">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden min-h-[600px]">
              {/* Header bar */}
              <div className="px-6 py-4 border-b bg-slate-50/50 flex items-center justify-between">
                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">
                  {hasGenerated ? 'Giáo án – Đang chỉnh sửa' : 'Kết quả giáo án AI'}
                </span>
                {hasGenerated && (
                  <div className="flex items-center gap-2 text-xs text-green-600">
                    <CheckCircle2 size={14} />
                    Đã sinh thành công
                  </div>
                )}
              </div>

              {/* Content area */}
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50/10">
                {/* Empty state – chưa có kết quả AI */}
                {!hasGenerated && !isGenerating ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4 border-4 border-dashed border-slate-100 rounded-3xl">
                    <FileEdit size={48} className="opacity-15" />
                    <p className="font-bold uppercase tracking-widest text-sm">
                      Chưa có giáo án – Nhấn "Tạo với AI" để bắt đầu
                    </p>
                    <p className="text-xs text-slate-400 max-w-xs text-center">
                      Nội dung AI có thể chỉnh sửa trước khi lưu
                    </p>
                  </div>
                ) : isGenerating ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                    <Loader2 size={48} className="text-indigo-400 animate-spin" />
                    <p className="font-bold text-slate-700 animate-pulse text-lg">
                      AI đang tư duy và soạn giáo án cho bạn...
                    </p>
                    <p className="text-sm text-slate-400">
                      Vui lòng chờ trong giây lát
                    </p>
                  </div>
                ) : editorValue ? (
                  <div className="space-y-4 animate-in fade-in zoom-in-95 duration-500">
                    {/* Title */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                        <BookOpen size={12} />
                        Tiêu đề giáo án
                      </label>
                      <input
                        value={editorValue.title || ''}
                        onChange={(e) => handleEditorChange('title', e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-indigo-200 rounded-xl text-lg font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Tiêu đề giáo án..."
                      />
                    </div>

                    {/* Meta row */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Môn</label>
                        <input
                          value={editorValue.subject || ''}
                          onChange={(e) => handleEditorChange('subject', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Khối</label>
                        <input
                          value={editorValue.gradeLevel || ''}
                          onChange={(e) => handleEditorChange('gradeLevel', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Framework</label>
                        <input
                          value={editorValue.framework || ''}
                          onChange={(e) => handleEditorChange('framework', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    {/* Materials */}
                    {editorValue.materials && editorValue.materials.length > 0 && (
                      <div className="space-y-2">
                        {renderSectionHeader(
                          <Package size={14} />,
                          'Giảng dạy & Học liệu',
                          'materials',
                          null
                        )}
                        {expandedSections.materials && (
                          <div className="space-y-2 pl-2">
                            {(editorValue.materials || []).map((m, idx) => (
                              <div key={idx} className="flex gap-2">
                                <span className="text-xs font-bold text-indigo-400 mt-2">•</span>
                                <input
                                  value={m}
                                  onChange={(e) => {
                                    const next = [...(editorValue.materials || [])]
                                    next[idx] = e.target.value
                                    handleEditorChange('materials', next)
                                  }}
                                  className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Objectives */}
                    <div className="space-y-2">
                      {renderSectionHeader(
                        <Target size={14} />,
                        'Mục tiêu bài học',
                        'objectives',
                        null
                      )}
                      {expandedSections.objectives && renderObjectives()}
                    </div>

                    {/* Lesson Flow */}
                    <div className="space-y-2">
                      {renderSectionHeader(
                        <Layout size={14} />,
                        'Các giai đoạn buổi học',
                        'lessonFlow',
                        (editorValue.lessonFlow || []).length
                      )}
                      {expandedSections.lessonFlow && renderLessonFlow()}
                    </div>

                    {/* Assessment */}
                    <div className="space-y-2">
                      {renderSectionHeader(
                        <ClipboardCheck size={14} />,
                        'Đánh giá',
                        'assessment',
                        null
                      )}
                      {expandedSections.assessment && renderAssessment()}
                    </div>

                    {/* Homework */}
                    <div className="space-y-2">
                      {renderSectionHeader(
                        <Home size={14} />,
                        'Bài tập về nhà',
                        'homework',
                        null
                      )}
                      {expandedSections.homework && renderSimpleField(
                        'Bài tập về nhà',
                        editorValue.homework,
                        'homework',
                        <Home size={12} />
                      )}
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                      {renderSectionHeader(
                        <StickyNote size={14} />,
                        'Ghi chú',
                        'notes',
                        null
                      )}
                      {expandedSections.notes && renderSimpleField(
                        'Ghi chú',
                        editorValue.notes,
                        'notes',
                        <StickyNote size={12} />
                      )}
                    </div>

                    {/* Save error */}
                    {saveError && (
                      <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                        <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-red-600 font-medium">{saveError}</p>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              {/* Action bar – chỉ hiện sau khi có kết quả AI */}
              {hasGenerated && editorValue && (
                <div className="px-6 py-4 border-t bg-slate-50 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {isDirty ? (
                      <span className="flex items-center gap-1.5 text-xs text-amber-600">
                        <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                        Có thay đổi chưa lưu
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs text-green-600">
                        <CheckCircle2 size={14} />
                        Đã lưu bản AI gần nhất
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleRegenerate}
                      disabled={isGenerating || isSaving}
                      className="flex items-center gap-2 px-5 py-2.5 border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isGenerating ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <RotateCw size={16} />
                      )}
                      {isGenerating ? 'Đang tạo...' : 'Tạo lại'}
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={isGenerating || isSaving}
                      className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-lg shadow-green-100 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSaving ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Save size={16} />
                      )}
                      {isSaving ? 'Đang lưu...' : 'Lưu giáo án'}
                    </button>
                  </div>
                </div>
              )}

              {/* Confirm dialog – xác nhận ghi đè khi regenerate có dirty data */}
              {showRegenConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                  <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 space-y-4 animate-in zoom-in-95 duration-200">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-amber-100 rounded-xl text-amber-600">
                        <AlertCircle size={24} />
                      </div>
                      <div>
                        <h3 className="font-black text-slate-800 text-base">
                          Xác nhận tạo lại?
                        </h3>
                        <p className="text-sm text-slate-500 mt-0.5">
                          Bạn đã có thay đổi chưa lưu. Tạo lại sẽ mất hết nội dung đã chỉnh sửa.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowRegenConfirm(false)}
                        className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-all"
                      >
                        Hủy
                      </button>
                      <button
                        onClick={handleConfirmRegenerate}
                        className="flex-1 px-4 py-2.5 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 shadow transition-all"
                      >
                        Tạo lại
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LessonPlanGenerator
