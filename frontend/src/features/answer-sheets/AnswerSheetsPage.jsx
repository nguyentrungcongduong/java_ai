import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  Upload,
  FileText,
  ImageIcon,
  X,
  Loader2,
  CheckCircle2,
  Clock,
  Eye,
  Play,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  CloudUpload,
  BookOpen,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  fetchAnswerSheets,
  uploadAnswerSheets,
  triggerOcr,
  clearUploadStatus,
} from './answerSheetSlice'
import OcrResultModal from './OcrResultModal'
import { examApi } from '@/services/examApi'

const PAGE_SIZE = 20

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatFileSize(bytes) {
  if (!bytes) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return String(dateStr)
  }
}

// ── OCR Status Badge ───────────────────────────────────────────────────────────

function OcrStatusBadge({ status, spinning = false }) {
  if (spinning || status === 'PROCESSING') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
        <Loader2 className="size-3 animate-spin" />
        PROCESSING
      </span>
    )
  }
  if (status === 'COMPLETED' || status === 'DONE') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
        <CheckCircle2 className="size-3" />
        HOÀN THÀNH
      </span>
    )
  }
  if (status === 'FAILED') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
        <AlertTriangle className="size-3" />
        THẤT BẠI
      </span>
    )
  }
  // PENDING (default)
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
      <Clock className="size-3" />
      PENDING
    </span>
  )
}

// ── Drop Zone ─────────────────────────────────────────────────────────────────

function DropZone({ onFilesAdded, disabled }) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)

  const handleDragOver = useCallback(
    (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (!disabled) setIsDragging(true)
    },
    [disabled]
  )

  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      if (disabled) return
      const dropped = Array.from(e.dataTransfer.files).filter(
        (f) => f.type.startsWith('image/') || f.type === 'application/pdf'
      )
      if (dropped.length === 0) {
        toast.error('Chỉ chấp nhận file ảnh (PNG, JPG...) hoặc PDF.')
        return
      }
      onFilesAdded(dropped)
    },
    [disabled, onFilesAdded]
  )

  const handleInputChange = (e) => {
    const files = Array.from(e.target.files)
    if (files.length > 0) onFilesAdded(files)
    e.target.value = ''
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label="Khu vực kéo & thả file"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !disabled && fileInputRef.current?.click()}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          fileInputRef.current?.click()
        }
      }}
      className={[
        'relative flex cursor-pointer select-none flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring',
        isDragging
          ? 'scale-[1.01] border-primary bg-accent/50'
          : 'border-border bg-muted/20 hover:border-primary/50 hover:bg-accent/20',
        disabled ? 'cursor-not-allowed opacity-50' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        className={`flex size-14 items-center justify-center rounded-xl transition-colors ${
          isDragging ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
        }`}
      >
        <CloudUpload className="size-7" />
      </div>

      <div>
        <p className="text-sm font-semibold text-foreground">
          {isDragging ? 'Thả file để tải lên' : 'Kéo & thả file vào đây'}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Hoặc nhấn để chọn. Hỗ trợ: PNG, JPG, JPEG, PDF (nhiều file)
        </p>
        {disabled && (
          <p className="mt-2 text-xs font-semibold text-amber-600">
            ⚠ Vui lòng chọn đề thi trước khi tải lên
          </p>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,application/pdf"
        className="hidden"
        onChange={handleInputChange}
        disabled={disabled}
        aria-hidden="true"
      />
    </div>
  )
}

// ── Staged File Item ──────────────────────────────────────────────────────────

function StagedFileItem({ file, onRemove }) {
  const isPdf = file.type === 'application/pdf'
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
        {isPdf ? <FileText className="size-3.5" /> : <ImageIcon className="size-3.5" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-foreground" title={file.name}>
          {file.name}
        </p>
        <p className="text-[10px] text-muted-foreground">{formatFileSize(file.size)}</p>
      </div>
      <button
        onClick={onRemove}
        aria-label={`Xóa ${file.name}`}
        className="shrink-0 rounded-md p-0.5 text-muted-foreground transition-colors hover:text-destructive focus:outline-none focus:ring-1 focus:ring-destructive"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({ hasExam }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <FileText className="size-7" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">Chưa có bài nào</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {hasExam
            ? 'Tải lên bài làm cho đề thi này ở khu vực bên trên.'
            : 'Chọn đề thi và kéo thả bài làm vào khu vực tải lên.'}
        </p>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function AnswerSheetsPage() {
  const dispatch = useDispatch()
  const { list, totalPages, totalElements, status, uploadStatus, processingIds } =
    useSelector((state) => state.answerSheets)

  const [exams, setExams] = useState([])
  const [examsLoading, setExamsLoading] = useState(false)
  const [selectedExamId, setSelectedExamId] = useState('')
  const [stagedFiles, setStagedFiles] = useState([])
  const [currentPage, setCurrentPage] = useState(0)
  const [ocrModalId, setOcrModalId] = useState(null)

  // ── Load exam list ────────────────────────────────────────────────────────
  useEffect(() => {
    setExamsLoading(true)
    examApi
      .getMyExams({ page: 0, size: 100 })
      .then((res) => setExams(res.data?.content ?? []))
      .catch(() => toast.error('Không thể tải danh sách đề thi.'))
      .finally(() => setExamsLoading(false))
  }, [])

  // ── Load answer sheets ────────────────────────────────────────────────────
  useEffect(() => {
    dispatch(
      fetchAnswerSheets({
        examId: selectedExamId || undefined,
        page: currentPage,
        size: PAGE_SIZE,
      })
    )
  }, [dispatch, selectedExamId, currentPage])

  // ── Upload status feedback ────────────────────────────────────────────────
  useEffect(() => {
    if (uploadStatus === 'succeeded') {
      toast.success('Tải lên thành công!')
      setStagedFiles([])
      dispatch(clearUploadStatus())
    } else if (uploadStatus === 'failed') {
      toast.error('Tải lên thất bại. Vui lòng thử lại.')
      dispatch(clearUploadStatus())
    }
  }, [uploadStatus, dispatch])

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleFilesAdded = useCallback((files) => {
    setStagedFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name))
      const unique = files.filter((f) => !existing.has(f.name))
      return [...prev, ...unique]
    })
  }, [])

  const handleRemoveStaged = (index) => {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUpload = () => {
    if (!selectedExamId) {
      toast.error('Vui lòng chọn đề thi trước khi tải lên.')
      return
    }
    if (stagedFiles.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 file bài làm.')
      return
    }
    dispatch(uploadAnswerSheets({ examId: selectedExamId, files: stagedFiles }))
  }

  const handleStartGrading = (id) => {
    dispatch(triggerOcr(id)).then((result) => {
      if (!result.error) toast.success('Đã kích hoạt OCR! Bài đang được xử lý.')
      else toast.error(result.payload || 'Không thể xử lý OCR.')
    })
  }

  const handleRefresh = () => {
    dispatch(
      fetchAnswerSheets({
        examId: selectedExamId || undefined,
        page: currentPage,
        size: PAGE_SIZE,
      })
    )
  }

  const handleExamChange = (e) => {
    setSelectedExamId(e.target.value)
    setCurrentPage(0)
  }

  // ── Derived stats ─────────────────────────────────────────────────────────
  const pendingCount = list.filter((s) => s.ocrStatus === 'PENDING').length
  const processingCount = list.filter((s) => s.ocrStatus === 'PROCESSING').length
  const doneCount = list.filter((s) => s.ocrStatus === 'DONE').length

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* ── Page Header ── */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="page-header">OCR Grading</h1>
          <p className="page-subheader">
            Tải lên bài làm và chấm tự động bằng nhận dạng văn bản (OCR).
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={status === 'loading'}
        >
          <RefreshCw className={`size-4 ${status === 'loading' ? 'animate-spin' : ''}`} />
          Làm mới
        </Button>
      </div>

      {/* ── Exam Selector + Summary ── */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex shrink-0 items-center gap-2 text-sm font-medium text-foreground">
            <BookOpen className="size-4 text-muted-foreground" />
            Đề thi:
          </div>
          <div className="relative flex flex-1 items-center gap-2 min-w-[200px]">
            <select
              className="h-8 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-ring disabled:cursor-not-allowed disabled:opacity-60"
              value={selectedExamId}
              onChange={handleExamChange}
              disabled={examsLoading}
            >
              <option value="">— Tất cả đề thi —</option>
              {exams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.title || `Exam #${exam.id}`}
                  {exam.subject ? ` – ${exam.subject}` : ''}
                  {exam.gradeLevel ? ` (Lớp ${exam.gradeLevel})` : ''}
                </option>
              ))}
            </select>
            {examsLoading && (
              <Loader2 className="absolute right-2.5 size-3.5 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Status summary pills */}
        {totalElements > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {totalElements} bài tổng
            </span>
            {pendingCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                <Clock className="size-3" />
                {pendingCount} chờ chấm
              </span>
            )}
            {processingCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                <Loader2 className="size-3 animate-spin" />
                {processingCount} đang xử lý
              </span>
            )}
            {doneCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                <CheckCircle2 className="size-3" />
                {doneCount} đã xong
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Upload Section ── */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">
          Tải lên bài làm
        </h2>

        <DropZone onFilesAdded={handleFilesAdded} disabled={!selectedExamId} />

        {stagedFiles.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">
                {stagedFiles.length} file đã chọn
              </p>
              <button
                onClick={() => setStagedFiles([])}
                className="text-xs text-destructive transition-colors hover:underline focus:outline-none"
              >
                Xóa tất cả
              </button>
            </div>

            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {stagedFiles.map((file, i) => (
                <StagedFileItem
                  key={`${file.name}-${i}`}
                  file={file}
                  onRemove={() => handleRemoveStaged(i)}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={handleUpload}
                disabled={uploadStatus === 'loading' || !selectedExamId}
              >
                {uploadStatus === 'loading' ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Đang tải lên...
                  </>
                ) : (
                  <>
                    <Upload className="size-4" />
                    Tải lên {stagedFiles.length} file
                  </>
                )}
              </Button>
              {!selectedExamId && (
                <p className="flex items-center gap-1 text-xs text-amber-600">
                  <AlertTriangle className="size-3.5" />
                  Chưa chọn đề thi
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Answer Sheets Table ── */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-semibold text-foreground">
            Danh sách bài đã tải lên
          </h2>
          {status === 'loading' && list.length > 0 && (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Loading skeleton */}
        {status === 'loading' && list.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Đang tải danh sách bài làm...</p>
          </div>
        ) : list.length === 0 ? (
          <EmptyState hasExam={Boolean(selectedExamId)} />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 pl-5">#</TableHead>
                  <TableHead>Trạng thái OCR</TableHead>
                  <TableHead>Thời gian tải</TableHead>
                  <TableHead className="pr-5 text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((sheet, index) => {
                  const isProcessing = processingIds.includes(sheet.id)
                  return (
                    <TableRow key={sheet.id}>
                      {/* Row number */}
                      <TableCell className="pl-5 text-xs text-muted-foreground">
                        {currentPage * PAGE_SIZE + index + 1}
                      </TableCell>

                      {/* OCR Status */}
                      <TableCell>
                        <OcrStatusBadge status={sheet.ocrStatus} spinning={isProcessing} />
                      </TableCell>


                      {/* Uploaded at */}
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(sheet.uploadedAt)}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="pr-5">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View OCR result */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setOcrModalId(sheet.id)}
                            title="Xem kết quả OCR"
                          >
                            <Eye className="size-3.5" />
                            <span className="hidden sm:inline">Xem</span>
                          </Button>

                          {/* Start Grading – only for PENDING sheets */}
                          {(sheet.ocrStatus === 'PENDING' || sheet.ocrStatus === 'FAILED') && (
                            <Button
                              size="sm"
                              onClick={() => handleStartGrading(sheet.id)}
                              disabled={isProcessing}
                              title="Bắt đầu chấm OCR"
                            >
                              {isProcessing ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Play className="size-3.5" />
                              )}
                              <span>Bắt đầu chấm</span>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-5 py-3">
                <p className="text-xs text-muted-foreground">
                  Trang {currentPage + 1} / {totalPages} · {totalElements} bài
                </p>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Trang trước"
                    onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                    disabled={currentPage === 0}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Trang sau"
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages - 1, p + 1))
                    }
                    disabled={currentPage >= totalPages - 1}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── OCR Result Modal ── */}
      {ocrModalId !== null && (
        <OcrResultModal sheetId={ocrModalId} onClose={() => setOcrModalId(null)} />
      )}
    </div>
  )
}
