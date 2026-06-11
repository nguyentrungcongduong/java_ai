import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2, PlusCircle, Printer } from 'lucide-react'
import { toast } from 'sonner'
import questionApi from '@/services/questionApi'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import QuestionsTable from './QuestionsTable'
import QuestionFormModal from './QuestionFormModal'

const PAGE_SIZE = 10

const TYPE_OPTIONS = [
  { value: '', label: 'Tat ca loai' },
  { value: 'MULTIPLE_CHOICE', label: 'Trac nghiem' },
  { value: 'SHORT_ANSWER', label: 'Tra loi ngan' },
  { value: 'FILL_IN_BLANK', label: 'Dien khuyet' },
]

const DIFF_OPTIONS = [
  { value: '', label: 'Tat ca do kho' },
  { value: 'EASY', label: 'De' },
  { value: 'MEDIUM', label: 'Trung binh' },
  { value: 'HARD', label: 'Kho' },
]

const selectCls =
  'h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none transition-colors focus:border-ring'

const DIFF_LABELS = { EASY: 'D\u1ec5', MEDIUM: 'Trung b\u00ecnh', HARD: 'Kh\u00f3' }
const TYPE_LABELS = { MULTIPLE_CHOICE: 'Tr\u1eafc nghi\u1ec7m', SHORT_ANSWER: 'Tr\u1ea3 l\u1eddi ng\u1eafn', FILL_IN_BLANK: '\u0110i\u1ec1n khuy\u1ebft' }
const OPT_LABELS = ['A', 'B', 'C', 'D', 'E']

export default function BankQuestionsPage() {
  const { bankId } = useParams()
  const navigate = useNavigate()

  const [bank, setBank] = useState(null)
  const [bankLoading, setBankLoading] = useState(true)
  const [questions, setQuestions] = useState([])
  const [totalPages, setTotalPages] = useState(0)
  const [totalElements, setTotalElements] = useState(0)
  const [page, setPage] = useState(0)
  const [questionsLoading, setQuestionsLoading] = useState(false)
  const [filter, setFilter] = useState({ topic: '', type: '', difficulty: '' })
  const [formModal, setFormModal] = useState({ open: false, question: null })
  const [printing, setPrinting] = useState(false)

  useEffect(() => {
    setBankLoading(true)
    questionApi.getBank(bankId)
      .then((response) => setBank(response.data))
      .catch(() => toast.error('Khong the tai thong tin ngan hang.'))
      .finally(() => setBankLoading(false))
  }, [bankId])

  const fetchQuestions = useCallback(async (currentPage) => {
    setQuestionsLoading(true)
    try {
      const params = { page: currentPage, size: PAGE_SIZE }
      if (filter.topic) params.topic = filter.topic
      if (filter.type) params.type = filter.type
      if (filter.difficulty) params.difficulty = filter.difficulty

      const response = await questionApi.getBankQuestions(bankId, params)
      const data = response.data
      setQuestions(data.content ?? [])
      setTotalPages(data.totalPages ?? 0)
      setTotalElements(data.totalElements ?? 0)
    } catch {
      toast.error('Khong the tai danh sach cau hoi.')
    } finally {
      setQuestionsLoading(false)
    }
  }, [bankId, filter])

  useEffect(() => {
    setPage(0)
    fetchQuestions(0)
  }, [bankId, fetchQuestions, filter.difficulty, filter.topic, filter.type])

  const handlePageChange = (newPage) => {
    setPage(newPage)
    fetchQuestions(newPage)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Xoa cau hoi nay?')) return
    try {
      await questionApi.deleteQuestion(id)
      toast.success('Da xoa cau hoi!')
      fetchQuestions(page)
    } catch {
      toast.error('Khong the xoa cau hoi.')
    }
  }

  // ── In / Xuất PDF ─────────────────────────────────────────────────────────
  const handlePrint = async () => {
    setPrinting(true)
    try {
      // Backend giới hạn size <= 100, nên fetch từng trang rồi gộp lại
      const baseParams = { size: 100 }
      if (filter.topic) baseParams.topic = filter.topic
      if (filter.type) baseParams.type = filter.type
      if (filter.difficulty) baseParams.difficulty = filter.difficulty

      // Fetch trang đầu để biết tổng số trang
      const firstRes = await questionApi.getBankQuestions(bankId, { ...baseParams, page: 0 })
      const firstData = firstRes.data
      const allQuestions = [...(firstData.content ?? [])]
      const totalPagesCount = firstData.totalPages ?? 1

      // Fetch các trang còn lại song song
      if (totalPagesCount > 1) {
        const rest = await Promise.all(
          Array.from({ length: totalPagesCount - 1 }, (_, i) =>
            questionApi.getBankQuestions(bankId, { ...baseParams, page: i + 1 })
              .then(r => r.data?.content ?? [])
          )
        )
        rest.forEach(page => allQuestions.push(...page))
      }

      if (allQuestions.length === 0) {
        toast.error('Không có câu hỏi nào để in')
        return
      }

      const questionsHtml = allQuestions.map((q, idx) => {
        const opts = q.options || []
        const optsHtml = opts.length > 0
          ? `<div class="opts">${opts.map((o, i) => {
              const label = o.label || OPT_LABELS[i] || String(i + 1)
              return `<div class="opt"><span class="opt-label">${label}.</span> ${o.text || o}</div>`
            }).join('')}</div>`
          : q.correctAnswer
            ? `<div class="opt"><b>Đáp án:</b> ${q.correctAnswer}</div>`
            : ''

        return `
          <div class="question">
            <p class="q-content"><b>Câu ${idx + 1}.</b> ${q.content}</p>
            ${optsHtml}
          </div>`
      }).join('')

      const bankMeta = [
        bank?.subject && `Môn: ${bank.subject}`,
        bank?.gradeLevel && `Lớp: ${bank.gradeLevel}`,
        `${allQuestions.length} câu hỏi`,
      ].filter(Boolean).join('  |  ')

      const html = `<!DOCTYPE html><html lang="vi"><head>
        <meta charset="UTF-8"/>
        <title>${bank?.name || 'Ngân hàng câu hỏi'}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Times New Roman', serif; font-size: 13pt; line-height: 1.65;
                 padding: 18mm 18mm 18mm 22mm; color: #111; }
          .header { text-align: center; margin-bottom: 18px; }
          .bank-name { font-size: 17pt; font-weight: bold; text-transform: uppercase; margin-bottom: 4px; }
          .bank-meta { font-size: 11pt; color: #555; }
          .divider { border: none; border-top: 2px solid #000; margin: 14px 0; }
          .question { margin-bottom: 20px; page-break-inside: avoid; }
          .q-content { font-size: 13pt; margin-bottom: 6px; }
          .opts { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 28px;
                  padding-left: 16px; margin-top: 4px; }
          .opt { font-size: 12pt; }
          .opt-label { font-weight: bold; }
          .footer { margin-top: 24px; border-top: 1px dashed #aaa; padding-top: 10px;
                    text-align: center; font-size: 10pt; color: #777; }
          @media print { body { padding: 0; } }
        </style>
      </head><body>
        <div class="header">
          <div class="bank-name">${bank?.name || 'Ngân hàng câu hỏi'}</div>
          <div class="bank-meta">${bankMeta}</div>
        </div>
        <hr class="divider"/>
        ${questionsHtml}
        <div class="footer">
          PlanbookAI &nbsp;·&nbsp; In lúc ${new Date().toLocaleString('vi-VN')}
        </div>
      </body></html>`

      const win = window.open('', '_blank', 'width=950,height=750')
      win.document.write(html)
      win.document.close()
      win.focus()
      setTimeout(() => win.print(), 500)
    } catch {
      toast.error('Không thể tải dữ liệu để in')
    } finally {
      setPrinting(false)
    }
  }

  const hasFilter = Boolean(filter.topic || filter.type || filter.difficulty)
  const bankMeta = [
    bank?.subject && `Mon: ${bank.subject}`,
    bank?.gradeLevel && `Lop ${bank.gradeLevel}`,
    totalElements > 0 && `${totalElements} cau hoi`,
  ].filter(Boolean).join(' · ')

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/question-bank')}
            aria-label="Quay lai"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            {bankLoading ? (
              <div className="space-y-1.5">
                <div className="h-6 w-52 animate-pulse rounded bg-muted" />
                <div className="h-4 w-36 animate-pulse rounded bg-muted" />
              </div>
            ) : (
              <>
                <h1 className="page-header">{bank?.name ?? 'Ngan hang cau hoi'}</h1>
                {bankMeta && <p className="page-subheader">{bankMeta}</p>}
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handlePrint}
            disabled={printing || totalElements === 0}
            className="flex items-center gap-1.5"
          >
            {printing
              ? <Loader2 className="size-4 animate-spin" />
              : <Printer className="size-4" />}
            {printing ? 'Đang tải...' : 'In / Xuất PDF'}
          </Button>

          <Button onClick={() => setFormModal({ open: true, question: null })}>
            <PlusCircle className="size-4" /> Them cau hoi
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
        <Input
          className="min-w-[180px] flex-1"
          placeholder="Tim theo chu de..."
          value={filter.topic}
          onChange={(event) => setFilter((prev) => ({ ...prev, topic: event.target.value }))}
        />
        <select
          className={selectCls}
          value={filter.type}
          onChange={(event) => setFilter((prev) => ({ ...prev, type: event.target.value }))}
        >
          {TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <select
          className={selectCls}
          value={filter.difficulty}
          onChange={(event) => setFilter((prev) => ({ ...prev, difficulty: event.target.value }))}
        >
          {DIFF_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        {hasFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilter({ topic: '', type: '', difficulty: '' })}
          >
            Xoa bo loc
          </Button>
        )}
      </div>

      {questionsLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      ) : (
        <QuestionsTable
          questions={questions}
          page={page}
          totalPages={totalPages}
          pageSize={PAGE_SIZE}
          onPageChange={handlePageChange}
          onEdit={(question) => setFormModal({ open: true, question })}
          onDelete={handleDelete}
        />
      )}

      {formModal.open && (
        <QuestionFormModal
          bankId={Number(bankId)}
          initialData={formModal.question}
          onClose={() => setFormModal({ open: false, question: null })}
          onSuccess={() => {
            setFormModal({ open: false, question: null })
            fetchQuestions(page)
          }}
        />
      )}
    </div>
  )
}
