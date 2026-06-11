import React, { useEffect, useMemo, useState, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  X, Loader2, ImageOff, FileText, AlertTriangle,
  CheckCircle2, XCircle, HelpCircle, Pencil, RotateCcw, Save,
} from 'lucide-react'
import { toast } from 'sonner'
import { clearDetailSheet, fetchSheetDetail } from './answerSheetSlice'
import examApi from '@/services/examApi'
import answerSheetApi from '@/services/answerSheetApi'

function parseOcrData(raw) {
  if (!raw) return null
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch {
    return { extracted_text: raw }
  }
}

// ── AnswerPicker popup ─────────────────────────────────────────────────────────
function AnswerPicker({ value, onSelect, onClose }) {
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const options = ['A', 'B', 'C', 'D']
  return (
    <div
      ref={ref}
      className="absolute z-50 mt-1 flex gap-1 rounded-lg border border-border bg-background p-1.5 shadow-xl"
    >
      {options.map(opt => (
        <button
          key={opt}
          onClick={() => { onSelect(opt); onClose() }}
          className={`h-8 w-8 rounded-md text-sm font-bold transition-colors
            ${value === opt
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted text-foreground'}`}
        >
          {opt}
        </button>
      ))}
      <button
        onClick={() => { onSelect(null); onClose() }}
        title="Xóa lựa chọn"
        className="h-8 w-8 rounded-md text-xs text-muted-foreground hover:bg-muted"
      >
        —
      </button>
    </div>
  )
}

export default function OcrResultModal({ sheetId, onClose }) {
  const dispatch = useDispatch()
  const { detailSheet, detailStatus, detailError } = useSelector(
    (state) => state.answerSheets
  )
  const [examQuestions, setExamQuestions] = useState([])
  const [overrides, setOverrides] = useState({})
  const [openPickerNum, setOpenPickerNum] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (sheetId) dispatch(fetchSheetDetail(sheetId))
    return () => { dispatch(clearDetailSheet()) }
  }, [sheetId, dispatch])

  // Reset overrides khi đổi sheet
  useEffect(() => { setOverrides({}) }, [sheetId])

  useEffect(() => {
    if (!detailSheet?.examId) return
    examApi.getExamDetail(detailSheet.examId)
      .then(res => {
        const questions = res.data?.questions ?? res.data?.examQuestions ?? []
        setExamQuestions(questions)
      })
      .catch(() => setExamQuestions([]))
  }, [detailSheet?.examId])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const isPdf = detailSheet?.fileUrl?.toLowerCase().endsWith('.pdf')
  const ocrData = useMemo(() => parseOcrData(detailSheet?.ocrRawData), [detailSheet?.ocrRawData])
  const studentAnswers = ocrData?.answers ?? []

  // Build correct answer map
  const correctAnswerMap = useMemo(() => {
    const map = {}
    examQuestions.forEach((eq, idx) => {
      const num = String(eq.orderIndex ?? eq.order_index ?? idx + 1)
      const q = eq.question ?? eq
      let correct = (q.correctAnswer ?? q.correct_answer ?? '').trim()
      if (correct.length > 1) {
        const byOption = (q.options ?? []).find(o => o.isCorrect === true || o.is_correct === true)
        if (byOption?.label) {
          correct = byOption.label
        } else {
          const m = correct.match(/^([ABCD])[^a-z]?/i)
          correct = m ? m[1].toUpperCase() : correct.charAt(0).toUpperCase()
        }
      }
      map[num] = correct.toUpperCase()
    })
    return map
  }, [examQuestions])

  // Merge: ưu tiên override, fallback OCR
  const mergedAnswers = useMemo(() => {
    return studentAnswers.map(a => {
      const num = String(a.question_number)
      const ocrAnswer = (a.answer ?? '').toUpperCase() || null
      const isOverridden = num in overrides
      const student = isOverridden
        ? (overrides[num] ?? null)
        : ocrAnswer
      const correct = correctAnswerMap[num] ?? null
      const isCorrect = correct && student ? student === correct : null
      return { num, student, correct, isCorrect, ocrAnswer, isOverridden }
    })
  }, [studentAnswers, correctAnswerMap, overrides])

  const correctCount = mergedAnswers.filter(a => a.isCorrect === true).length
  const total = mergedAnswers.length
  const scorePercent = total > 0 ? Math.round((correctCount / total) * 100) : null
  const hasOverrides = Object.keys(overrides).length > 0

  function handleOverride(num, val) {
    setOverrides(prev => ({ ...prev, [num]: val }))
  }

  function resetOverrides() {
    setOverrides({})
  }

  async function handleSave() {
    if (!hasOverrides || !detailSheet?.id) return
    setSaving(true)
    try {
      // Build full merged list to send
      const answersToSave = mergedAnswers
        .filter(a => a.isOverridden)
        .map(a => ({ question_number: a.num, answer: a.student }))
      await answerSheetApi.saveOcrAnswers(detailSheet.id, { answers: answersToSave })
      toast.success(`Đã lưu ${answersToSave.length} đáp án đã chỉnh sửa!`)
      // Refresh detail & clear local overrides
      dispatch(fetchSheetDetail(detailSheet.id))
      setOverrides({})
    } catch (err) {
      toast.error('Lưu thất bại: ' + (err?.response?.data?.message ?? err.message))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div
        role="dialog" aria-modal="true" aria-label="Ket qua OCR"
        className="relative z-10 flex h-[90vh] w-full max-w-6xl flex-col rounded-2xl border border-border bg-card shadow-2xl"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Ket qua OCR Cham bai</h2>
            {detailSheet && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {detailSheet.studentName ? `Hoc sinh: ${detailSheet.studentName}` : `Bai #${detailSheet.id}`}
                {detailSheet.studentCode && ` - Ma: ${detailSheet.studentCode}`}
                {detailSheet.examId && ` - De #${detailSheet.examId}`}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasOverrides && (
              <>
                <button
                  onClick={resetOverrides}
                  disabled={saving}
                  title="Khoi phuc ve ket qua OCR goc"
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
                >
                  <RotateCcw className="size-3.5" />
                  Dat lai
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-70"
                >
                  {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                  {saving ? 'Dang luu...' : 'Luu ket qua'}
                </button>
              </>
            )}
            <button onClick={onClose} aria-label="Dong"
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {detailStatus === 'loading' && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3">
              <Loader2 className="size-9 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Dang tai du lieu...</p>
            </div>
          )}
          {detailStatus === 'failed' && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-destructive">
              <AlertTriangle className="size-10" />
              <p className="text-sm font-medium">{detailError || 'Khong the tai chi tiet bai lam.'}</p>
            </div>
          )}

          {detailStatus === 'succeeded' && detailSheet && (
            <>
              {/* Left: anh bai lam */}
              <div className="flex w-1/2 min-w-0 flex-col border-r border-border">
                <div className="shrink-0 border-b border-border bg-muted/20 px-5 py-2.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Anh bai lam</span>
                </div>
                <div className="flex flex-1 items-center justify-center overflow-auto bg-muted/10 p-4">
                  {detailSheet.fileUrl ? (
                    isPdf ? (
                      <div className="flex flex-col items-center gap-4 text-muted-foreground">
                        <FileText className="size-16 text-primary/40" />
                        <p className="text-sm font-medium">File PDF</p>
                        <a href={detailSheet.fileUrl} target="_blank" rel="noopener noreferrer"
                          className="rounded-lg border border-border bg-background px-4 py-2 text-xs font-medium text-primary hover:bg-muted">
                          Mo PDF trong tab moi
                        </a>
                      </div>
                    ) : (
                      <img src={detailSheet.fileUrl} alt="Answer sheet scan"
                        className="max-h-full max-w-full rounded-xl object-contain shadow-lg" />
                    )
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <ImageOff className="size-12 opacity-40" />
                      <p className="text-sm">Khong co anh</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: ket qua cham */}
              <div className="flex w-1/2 min-w-0 flex-col overflow-hidden">
                <div className="shrink-0 border-b border-border bg-muted/20 px-5 py-2.5 flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ket qua cham diem</span>
                  {hasOverrides && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                      <Pencil className="size-2.5" />
                      Da chinh sua {Object.keys(overrides).length} cau
                    </span>
                  )}
                </div>

                {detailSheet.ocrRawData ? (
                  <div className="flex flex-1 flex-col overflow-hidden p-4 gap-3">

                    {/* Diem tong */}
                    {(scorePercent !== null || total > 0) && (
                      <div className="flex items-center justify-end rounded-xl border border-border bg-muted/30 px-4 py-3">
                        {scorePercent !== null ? (
                          <div className="text-right">
                            <div className={`text-3xl font-bold ${scorePercent >= 50 ? 'text-green-600' : 'text-red-500'}`}>
                              {correctCount}/{total}
                            </div>
                            <div className="text-xs text-muted-foreground">{scorePercent}% dung</div>
                          </div>
                        ) : (
                          <div className="text-right">
                            <div className="text-2xl font-bold text-muted-foreground">{total} cau</div>
                            <div className="text-xs text-muted-foreground">Chua co dap an dung</div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Bang doi chieu */}
                    {mergedAnswers.length > 0 ? (
                      <div className="flex-1 overflow-auto">
                        {/* Header */}
                        <div className="grid grid-cols-4 gap-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border mb-1">
                          <span>Cau</span>
                          <span className="text-center">Chon <span className="normal-case font-normal">(click de sua)</span></span>
                          <span className="text-center">Dung</span>
                          <span className="text-center">Ket qua</span>
                        </div>
                        <div className="space-y-1">
                          {mergedAnswers.map((a) => {
                            const isCorrect = a.isCorrect === true
                            const isWrong = a.isCorrect === false
                            const isUnknown = a.isCorrect === null
                            const isOpen = openPickerNum === a.num

                            return (
                              <div key={a.num}
                                className={`grid grid-cols-4 gap-1 items-center rounded-lg border px-3 py-2 text-sm
                                  ${isCorrect ? 'border-green-200 bg-green-50'
                                    : isWrong ? 'border-red-200 bg-red-50'
                                    : 'border-border bg-muted/10'}`}>

                                {/* Cau so */}
                                <span className="font-medium text-foreground">Cau {a.num}</span>

                                {/* CHON – clickable */}
                                <div className="relative flex justify-center">
                                  <button
                                    onClick={() => setOpenPickerNum(isOpen ? null : a.num)}
                                    title="Click de sua dap an"
                                    className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-base font-bold transition-colors
                                      hover:bg-black/10 active:scale-95
                                      ${isCorrect ? 'text-green-700' : isWrong ? 'text-red-600' : 'text-foreground'}`}
                                  >
                                    {a.student || <span className="text-muted-foreground text-sm">?</span>}
                                    {a.isOverridden && (
                                      <Pencil className="size-2.5 text-amber-500" />
                                    )}
                                  </button>

                                  {isOpen && (
                                    <AnswerPicker
                                      value={a.student}
                                      onSelect={(val) => handleOverride(a.num, val)}
                                      onClose={() => setOpenPickerNum(null)}
                                    />
                                  )}
                                </div>

                                {/* DUNG */}
                                <span className="text-center text-base font-bold text-blue-600">
                                  {a.correct || <span className="text-muted-foreground text-xs">N/A</span>}
                                </span>

                                {/* KET QUA */}
                                <div className="flex justify-center">
                                  {isCorrect && <CheckCircle2 className="size-5 text-green-600" />}
                                  {isWrong && <XCircle className="size-5 text-red-500" />}
                                  {isUnknown && <HelpCircle className="size-5 text-muted-foreground" />}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-1 flex-col gap-1.5 overflow-hidden">
                        <span className="text-xs text-muted-foreground">Van ban nhan dang:</span>
                        <pre className="flex-1 overflow-auto rounded-lg border border-border bg-muted/30 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words">
                          {ocrData?.extracted_text || detailSheet.ocrRawData}
                        </pre>
                      </div>
                    )}

                    {/* Ghi chu OCR */}
                    {ocrData?.notes?.filter(n => n && n.toLowerCase() !== 'handwriting is clear and legible.').length > 0 && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                        <p className="text-xs font-medium text-amber-800 mb-1">Luu y tu OCR:</p>
                        {ocrData.notes.filter(Boolean).map((n, i) => (
                          <p key={i} className="text-xs text-amber-700">- {n}</p>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center p-6">
                    <FileText className="size-12 text-muted-foreground/40" />
                    <p className="text-sm font-medium text-muted-foreground">
                      {detailSheet.ocrStatus === 'PENDING' ? 'Chua xu ly OCR'
                        : detailSheet.ocrStatus === 'PROCESSING' ? 'Dang xu ly OCR...'
                        : 'Khong co du lieu OCR'}
                    </p>
                    <p className="text-xs text-muted-foreground/70">
                      {detailSheet.ocrStatus === 'PENDING' ? 'Nhan "Bat dau cham" de xu ly.'
                        : detailSheet.ocrStatus === 'PROCESSING' ? 'Vui long doi va thu lai.' : ''}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
