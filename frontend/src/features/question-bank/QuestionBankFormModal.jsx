import React, { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useForm } from 'react-hook-form'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { clearSubmitStatus, createBank, updateBank } from './questionBankSlice'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const SUBJECTS = [
  'Toan', 'Ngu van', 'Tieng Anh', 'Vat ly', 'Hoa hoc',
  'Sinh hoc', 'Lich su', 'Dia ly', 'GDCD', 'Tin hoc', 'Cong nghe',
]
const GRADES = ['10', '11', '12']

const selectCls =
  'h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none transition-colors focus:border-ring'

export default function QuestionBankFormModal({ initialData, onClose, onSuccess }) {
  const dispatch = useDispatch()
  const { submitStatus, submitError } = useSelector((state) => state.questionBank)
  const isEdit = Boolean(initialData)

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: initialData
      ? {
          name: initialData.name ?? '',
          subject: initialData.subject ?? '',
          gradeLevel: initialData.gradeLevel ?? '',
          description: initialData.description ?? '',
          isPublished: initialData.isPublished ?? false,
        }
      : { name: '', subject: '', gradeLevel: '', description: '', isPublished: false },
  })

  useEffect(() => {
    if (submitStatus === 'succeeded') {
      toast.success(isEdit ? 'Da cap nhat ngan hang!' : 'Da tao ngan hang moi!')
      dispatch(clearSubmitStatus())
      onSuccess()
    }
    if (submitStatus === 'failed' && submitError) {
      toast.error(submitError)
      dispatch(clearSubmitStatus())
    }
  }, [dispatch, isEdit, onSuccess, submitError, submitStatus])

  const onSubmit = (data) => {
    if (isEdit) dispatch(updateBank({ id: initialData.id, data }))
    else dispatch(createBank(data))
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">{isEdit ? 'Chinh sua ngan hang' : 'Tao ngan hang moi'}</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Dong"
          >
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-5">
          <div className="space-y-1.5">
            <Label htmlFor="name">Ten ngan hang <span className="text-destructive">*</span></Label>
            <Input
              id="name"
              placeholder="VD: Toan 10 - Chuong 1: Dai so"
              aria-invalid={Boolean(errors.name)}
              {...register('name', { required: 'Ten la bat buoc' })}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="subject">Mon hoc</Label>
              <select id="subject" className={selectCls} {...register('subject')}>
                <option value="">-- Chon mon --</option>
                {SUBJECTS.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gradeLevel">Lop</Label>
              <select id="gradeLevel" className={selectCls} {...register('gradeLevel')}>
                <option value="">-- Chon lop --</option>
                {GRADES.map((grade) => <option key={grade} value={grade}>Lop {grade}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Mo ta</Label>
            <textarea
              id="description"
              rows={3}
              placeholder="Mo ta noi dung hoac pham vi kien thuc..."
              className="w-full resize-none rounded-lg border border-input bg-background px-2.5 py-2 text-sm outline-none transition-colors focus:border-ring"
              {...register('description')}
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="size-4 rounded border-input accent-primary"
              {...register('isPublished')}
            />
            <span className="text-sm">Cong khai ngan hang nay</span>
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Huy</Button>
            <Button type="submit" disabled={submitStatus === 'loading'}>
              {submitStatus === 'loading' ? 'Dang luu...' : isEdit ? 'Cap nhat' : 'Tao moi'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
