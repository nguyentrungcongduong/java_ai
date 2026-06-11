import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Brain, Loader2, Pencil, PlusCircle, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { clearFilter, deleteBank, fetchMyBanks, setFilter } from './questionBankSlice'
import QuestionBankFormModal from './QuestionBankFormModal'
import AIQuestionGenerator from './AIQuestionGenerator'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

const GRADES = ['10', '11', '12']


function BankCard({ bank, deleting, onDelete, onEdit, onAI, onClick }) {
  const isOwn = bank.isOwnBank !== false  // default true nếu không có field (admin/cũ)

  return (
    <div
      className="group relative flex cursor-pointer flex-col gap-4 rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="rounded-lg bg-accent p-2.5 text-accent-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
          <BookOpen className="size-5" />
        </div>
        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={onAI}
            title="Sinh cau hoi AI"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
          >
            <Brain className="size-3.5" />
          </button>
          {isOwn && (
            <>
              <button
                onClick={onEdit}
                title="Chinh sua"
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Pencil className="size-3.5" />
              </button>
              <button
                onClick={onDelete}
                disabled={deleting}
                title="Xoa"
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
              >
                <Trash2 className="size-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
          {bank.name}
        </h3>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {bank.subject && <Badge variant="secondary" className="text-[10px]">{bank.subject}</Badge>}
          {bank.gradeLevel && <Badge variant="outline" className="text-[10px]">Lop {bank.gradeLevel}</Badge>}
          {bank.isPublished && (
            <span className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700">
              Cong khai
            </span>
          )}
          {!isOwn && (
            <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">
              Chia se
            </span>
          )}
        </div>
      </div>

      <div className="border-t border-border pt-3">
        {!isOwn && bank.createdByName && (
          <p className="mb-1 text-[10px] text-muted-foreground">👤 {bank.createdByName}</p>
        )}
        <p className="line-clamp-1 text-xs text-muted-foreground">
          {bank.description || 'Nhan de xem danh sach cau hoi ->'}
        </p>
      </div>
    </div>
  )
}


function EmptyState({ hasFilter, onClear, onCreate }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card px-4 py-20 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Search className="size-7" />
      </div>
      {hasFilter ? (
        <>
          <h3 className="text-base font-semibold">Khong tim thay ket qua</h3>
          <p className="mt-1 text-sm text-muted-foreground">Thu thay doi bo loc hoac xoa bo loc hien tai.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={onClear}>Xoa bo loc</Button>
        </>
      ) : (
        <>
          <h3 className="text-base font-semibold">Chua co ngan hang cau hoi</h3>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">Tao ngan hang dau tien hoac dung AI de bat dau.</p>
          <Button className="mt-4" onClick={onCreate}>
            <PlusCircle className="size-4" /> Tao ngan hang
          </Button>
        </>
      )}
    </div>
  )
}

export default function QuestionBankPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { list, status, deletingId, filter } = useSelector((state) => state.questionBank)

  const [formModal, setFormModal] = useState({ open: false, bank: null })
  const [generator, setGenerator] = useState({ open: false, bankId: null })

  useEffect(() => {
    dispatch(fetchMyBanks())
  }, [dispatch])

  const filteredBanks = list.filter((bank) => {
    const okSubject = !filter.subject || bank.subject?.toLowerCase().includes(filter.subject.toLowerCase())
    const okGrade = !filter.gradeLevel || String(bank.gradeLevel) === String(filter.gradeLevel)
    return okSubject && okGrade
  })

  const handleDelete = (id, event) => {
    event.stopPropagation()
    if (!window.confirm('Ban co chac muon xoa ngan hang nay? Tat ca cau hoi ben trong se bi mat!')) return

    dispatch(deleteBank(id)).then((result) => {
      if (!result.error) toast.success('Da xoa ngan hang!')
      else toast.error(result.payload || 'Khong the xoa ngan hang.')
    })
  }

  if (generator.open) {
    return (
      <AIQuestionGenerator
        banks={list}
        initialBankId={generator.bankId}
        onClose={() => {
          setGenerator({ open: false, bankId: null })
          dispatch(fetchMyBanks())
        }}
      />
    )
  }

  const hasFilter = Boolean(filter.subject || filter.gradeLevel)

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="page-header">Ngan hang cau hoi</h1>
          <p className="page-subheader">Quan ly va to chuc cac cau hoi cua ban.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setFormModal({ open: true, bank: null })}>
            <PlusCircle className="size-4" /> Tao ngan hang
          </Button>
          <Button onClick={() => setGenerator({ open: true, bankId: null })}>
            <Brain className="size-4" /> Sinh cau hoi AI
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
        <Input
          className="min-w-[160px] flex-1"
          placeholder="Loc theo mon hoc..."
          value={filter.subject}
          onChange={(event) => dispatch(setFilter({ subject: event.target.value }))}
        />
        <select
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none transition-colors focus:border-ring"
          value={filter.gradeLevel}
          onChange={(event) => dispatch(setFilter({ gradeLevel: event.target.value }))}
        >
          <option value="">Tat ca lop</option>
          {GRADES.map((grade) => <option key={grade} value={grade}>Lop {grade}</option>)}
        </select>
        {hasFilter && (
          <Button variant="ghost" size="sm" onClick={() => dispatch(clearFilter())}>Xoa bo loc</Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">{filteredBanks.length} ngan hang</span>
      </div>

      {status === 'loading' ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <Loader2 className="size-9 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Dang tai ngan hang cau hoi...</p>
        </div>
      ) : filteredBanks.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredBanks.map((bank) => (
            <BankCard
              key={bank.id}
              bank={bank}
              deleting={deletingId === bank.id}
              onDelete={(event) => handleDelete(bank.id, event)}
              onEdit={(event) => {
                event.stopPropagation()
                setFormModal({ open: true, bank })
              }}
              onAI={(event) => {
                event.stopPropagation()
                setGenerator({ open: true, bankId: bank.id })
              }}
              onClick={() => navigate(`/question-bank/${bank.id}`)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          hasFilter={hasFilter}
          onClear={() => dispatch(clearFilter())}
          onCreate={() => setFormModal({ open: true, bank: null })}
        />
      )}

      {formModal.open && (
        <QuestionBankFormModal
          initialData={formModal.bank}
          onClose={() => setFormModal({ open: false, bank: null })}
          onSuccess={() => setFormModal({ open: false, bank: null })}
        />
      )}
    </div>
  )
}
