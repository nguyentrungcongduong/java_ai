import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Sparkles, Loader2, Trash2, Eye, Send,
  Search, Filter, RefreshCw, Clock, BookOpen,
  CheckCircle2, AlertCircle, FileEdit, Printer, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { examApi } from '../../services/examApi';

// ── Constants ─────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  DRAFT:     { label: 'Nháp',      color: 'bg-amber-100 text-amber-700 border-amber-200' },
  PUBLISHED: { label: 'Đã xuất bản', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  CLOSED:    { label: 'Đã đóng',   color: 'bg-slate-100 text-slate-500 border-slate-200' },
};

const SUBJECTS = ['', 'Toán', 'Vật lý', 'Hóa học', 'Sinh học', 'Ngữ văn',
  'Lịch sử', 'Địa lý', 'GDCD', 'Tiếng Anh', 'Tin học', 'Công nghệ', 'Khác'];

const STATUSES = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'DRAFT', label: 'Nháp' },
  { value: 'PUBLISHED', label: 'Đã xuất bản' },
  { value: 'CLOSED', label: 'Đã đóng' },
];

// ── ExamDetailModal ────────────────────────────────────────────────────────────
const ExamDetailModal = ({ examId, onClose }) => {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    examApi.getExamDetail(examId)
      .then(r => setDetail(r.data))
      .catch(() => toast.error('Không tải được chi tiết đề thi'))
      .finally(() => setLoading(false));
  }, [examId]);

  const handlePrint = () => {
    if (!detail?.questions?.length) return;
    const LABELS = ['A', 'B', 'C', 'D'];
    const questionsHtml = detail.questions.map((item, idx) => {
      const q = item.question || item;
      const opts = (q.options || []).map((o, i) =>
        `<div class="opt"><b>${o.label || LABELS[i]}.</b> ${o.text || o}</div>`
      ).join('');
      return `<div class="q"><p><b>Câu ${idx + 1}.</b> ${q.content}</p>${opts ? `<div class="opts">${opts}</div>` : ''}</div>`;
    }).join('');
    const answerKey = detail.questions.map((item, idx) => {
      const q = item.question || item;
      const correct = (q.options || []).find(o => o.isCorrect);
      const i = correct ? (q.options || []).indexOf(correct) : -1;
      return `<span>Câu ${idx + 1}: ${correct ? (correct.label || LABELS[i]) : q.correctAnswer || '?'}</span>`;
    }).join('  ');

    const win = window.open('', '_blank', 'width=900,height=700');
    win.document.write(`<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"/>
      <title>${detail.title}</title>
      <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Times New Roman',serif;font-size:13pt;line-height:1.6;padding:20mm 20mm 20mm 25mm}
      .header{text-align:center;margin-bottom:20px}.title{font-size:16pt;font-weight:bold;text-transform:uppercase;margin:6px 0}
      .meta{font-size:11pt;color:#333}.hr{border:none;border-top:2px solid #000;margin:14px 0}
      .q{margin-bottom:16px;page-break-inside:avoid}.opts{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;padding-left:16px;margin-top:4px}
      .opt{font-size:12pt}.ans-box{margin-top:28px;border-top:1px dashed #666;padding-top:14px}
      .ans-box h3{font-size:12pt;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px}
      .ans-box span{display:inline-block;margin:2px 14px 2px 0;font-size:11pt}</style>
      </head><body>
      <div class="header"><div class="title">${detail.title}</div>
      <div class="meta">Môn: ${detail.subject} &nbsp;|&nbsp; Lớp: ${detail.gradeLevel} &nbsp;|&nbsp; Thời gian: ${detail.durationMins} phút</div></div>
      <hr class="hr"/>${questionsHtml}
      <div class="ans-box"><h3>Đáp án</h3>${answerKey}</div>
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-black text-slate-800 text-lg">Chi tiết đề thi</h2>
          <div className="flex items-center gap-2">
            {!loading && detail && (
              <button onClick={handlePrint}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all">
                <Printer className="size-3.5" /> In đề
              </button>
            )}
            <button onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all text-lg font-bold">✕</button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="size-8 text-indigo-500 animate-spin" />
            </div>
          ) : !detail ? (
            <p className="text-center text-slate-400 py-12">Không tải được dữ liệu</p>
          ) : (
            <div className="space-y-5">
              {/* Meta */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Môn học', value: detail.subject },
                  { label: 'Khối lớp', value: `Lớp ${detail.gradeLevel}` },
                  { label: 'Số câu', value: detail.totalQuestions },
                  { label: 'Thời gian', value: `${detail.durationMins} phút` },
                ].map(item => (
                  <div key={item.label} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{item.label}</p>
                    <p className="text-sm font-black text-slate-700 mt-0.5">{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Questions */}
              <div className="space-y-3">
                <h3 className="text-sm font-black text-slate-600 uppercase tracking-wider">
                  Danh sách câu hỏi ({detail.questions?.length || 0})
                </h3>
                {(detail.questions || []).map((item, idx) => {
                  const q = item.question || item;
                  const diff = q.difficulty || 'MEDIUM';
                  const diffColors = { EASY: 'bg-emerald-100 text-emerald-700', MEDIUM: 'bg-amber-100 text-amber-700', HARD: 'bg-red-100 text-red-700' };
                  return (
                    <div key={idx} className="border border-slate-100 rounded-2xl p-4 hover:border-slate-200 transition-all">
                      <div className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-black flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${diffColors[diff] || diffColors.MEDIUM}`}>{diff}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.source === 'AI' ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'}`}>
                              {item.source === 'AI' ? '✨ AI' : '📚 Bank'}
                            </span>
                          </div>
                          <p className="text-sm text-slate-700 leading-relaxed">{q.content}</p>
                          {(q.options || []).length > 0 && (
                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {q.options.map((opt, i) => (
                                <div key={i} className={`text-xs px-2.5 py-1.5 rounded-lg border ${opt.isCorrect ? 'bg-emerald-50 border-emerald-200 text-emerald-700 font-semibold' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>
                                  <span className="font-bold">{opt.label || 'ABCD'[i]}.</span> {opt.text || opt}
                                  {opt.isCorrect && <span className="ml-1">✓</span>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── ExamCard ──────────────────────────────────────────────────────────────────
const ExamCard = ({ exam, onPublish, onDelete, onView }) => {
  const cfg = STATUS_CONFIG[exam.status] || STATUS_CONFIG.DRAFT;
  const date = exam.createdAt ? new Date(exam.createdAt).toLocaleDateString('vi-VN') : '—';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200 p-5 flex flex-col gap-4">
      {/* Top */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-black text-slate-800 text-sm leading-snug line-clamp-2">{exam.title}</h3>
          <p className="text-xs text-slate-400 mt-1">{exam.subject} · Lớp {exam.gradeLevel}</p>
        </div>
        <span className={`flex-shrink-0 text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${cfg.color}`}>
          {cfg.label}
        </span>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1"><BookOpen className="size-3.5" />{exam.totalQuestions} câu</span>
        <span className="flex items-center gap-1"><Clock className="size-3.5" />{exam.durationMins} phút</span>
        {exam.aiGenerated && <span className="flex items-center gap-1 text-violet-600"><Sparkles className="size-3.5" />AI</span>}
        <span className="ml-auto">{date}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
        <button onClick={() => onView(exam.id)}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-all">
          <Eye className="size-3.5" /> Xem
        </button>
        {exam.status === 'DRAFT' && (
          <button onClick={() => onPublish(exam.id)}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-all">
            <Send className="size-3.5" /> Xuất bản
          </button>
        )}
        <button onClick={() => onDelete(exam.id, exam.title)}
          className="flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition-all">
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
const ExamListPage = () => {
  const navigate = useNavigate();

  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  const [page, setPage] = useState(0);
  const [subject, setSubject] = useState('');
  const [status, setStatus] = useState('');

  const [viewingId, setViewingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const fetchExams = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, size: 12 };
      if (subject) params.subject = subject;
      if (status)  params.status  = status;
      const res = await examApi.getMyExams(params);
      const data = res.data;
      setExams(data.content || []);
      setTotalPages(data.totalPages || 0);
      setTotalElements(data.totalElements || 0);
    } catch {
      toast.error('Không thể tải danh sách đề thi');
    } finally {
      setLoading(false);
    }
  }, [page, subject, status]);

  useEffect(() => { fetchExams(); }, [fetchExams]);

  const handlePublish = async (id) => {
    try {
      await examApi.publishExam(id);
      toast.success('Đề thi đã được xuất bản!');
      fetchExams();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không thể xuất bản');
    }
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Xóa đề thi "${title}"?\nHành động này không thể hoàn tác.`)) return;
    setDeletingId(id);
    try {
      await examApi.deleteExam(id);
      toast.success('Đã xóa đề thi');
      if (exams.length === 1 && page > 0) setPage(p => p - 1);
      else fetchExams();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không thể xóa');
    } finally {
      setDeletingId(null);
    }
  };

  const handleFilterChange = (setter) => (val) => {
    setPage(0);
    setter(val);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl text-white shadow-lg shadow-indigo-200">
              <FileText className="size-5" />
            </div>
            Đề thi của tôi
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Quản lý tất cả đề thi đã tạo
            {totalElements > 0 && <span className="ml-1 text-indigo-600 font-semibold">({totalElements} đề)</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchExams}
            className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all">
            <RefreshCw className="size-4" /> Làm mới
          </button>
          <button onClick={() => navigate('/exam-generator')}
            className="flex items-center gap-1.5 text-sm font-black px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl shadow-md shadow-indigo-200 transition-all">
            <Sparkles className="size-4" /> Tạo đề mới
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
        <Filter className="size-4 text-slate-400 flex-shrink-0" />
        <select value={subject} onChange={e => handleFilterChange(setSubject)(e.target.value)}
          className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all">
          <option value="">Tất cả môn học</option>
          {SUBJECTS.filter(Boolean).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={status} onChange={e => handleFilterChange(setStatus)(e.target.value)}
          className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all">
          {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        {(subject || status) && (
          <button onClick={() => { handleFilterChange(setSubject)(''); handleFilterChange(setStatus)(''); }}
            className="text-xs font-bold text-slate-400 hover:text-red-500 transition-all px-2 py-1 hover:bg-red-50 rounded-lg">
            Xóa bộ lọc
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="size-10 text-indigo-500 animate-spin" />
        </div>
      ) : exams.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-50 to-violet-50 flex items-center justify-center border-2 border-dashed border-slate-200 mb-5">
            <FileText className="size-10 text-slate-300" />
          </div>
          <p className="font-black text-slate-600 text-lg">Chưa có đề thi nào</p>
          <p className="text-sm text-slate-400 mt-1.5 max-w-xs">
            {subject || status ? 'Không tìm thấy đề thi với bộ lọc hiện tại' : 'Nhấn "Tạo đề mới" để bắt đầu'}
          </p>
          {!subject && !status && (
            <button onClick={() => navigate('/exam-generator')}
              className="mt-5 flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black rounded-xl shadow-md shadow-indigo-200 transition-all">
              <Sparkles className="size-4" /> Tạo đề đầu tiên
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {exams.map(exam => (
              <ExamCard
                key={exam.id}
                exam={exam}
                onView={setViewingId}
                onPublish={handlePublish}
                onDelete={handleDelete}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-4">
              <button onClick={() => setPage(p => p - 1)} disabled={page === 0}
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                <ChevronLeft className="size-4" />
              </button>
              <span className="text-sm text-slate-600 font-medium">
                Trang <span className="font-black text-indigo-600">{page + 1}</span> / {totalPages}
              </span>
              <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      {viewingId && (
        <ExamDetailModal examId={viewingId} onClose={() => setViewingId(null)} />
      )}
    </div>
  );
};

export default ExamListPage;
