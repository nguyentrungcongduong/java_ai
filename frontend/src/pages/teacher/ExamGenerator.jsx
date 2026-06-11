import React, { useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { examApi } from '../../services/examApi';
import { questionApi } from '../../services/questionApi';
import {
  Sparkles, Brain, Loader2, RefreshCw, Save, Trash2,
  CheckCircle2, AlertCircle, ChevronDown, ChevronUp,
  BookOpen, Sliders, FileText, BarChart3, Plus, X,
  GraduationCap, Clock, Shuffle, Eye, EyeOff, Printer
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Constants ────────────────────────────────────────────────────────────────

const SUBJECTS = [
  'Toán', 'Vật lý', 'Hóa học', 'Sinh học', 'Ngữ văn',
  'Lịch sử', 'Địa lý', 'GDCD', 'Tiếng Anh', 'Tin học',
  'Công nghệ', 'Thể dục', 'Khác'
];

const GRADES = ['10', '11', '12'];

const QUESTION_TYPES = [
  { value: 'MULTIPLE_CHOICE', label: 'Trắc nghiệm (4 đáp án)' },
  { value: 'SHORT_ANSWER',    label: 'Trả lời ngắn' },
  { value: 'FILL_IN_BLANK',   label: 'Điền vào chỗ trống' },
];

const DIFFICULTY_COLORS = {
  EASY:   { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', badge: 'bg-emerald-500' },
  MEDIUM: { bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-300',   badge: 'bg-amber-500'   },
  HARD:   { bg: 'bg-red-100',     text: 'text-red-700',     border: 'border-red-300',     badge: 'bg-red-500'     },
};

const DIFFICULTY_LABELS = { EASY: 'Dễ', MEDIUM: 'Trung bình', HARD: 'Khó' };

// ─── DifficultyMixSlider ───────────────────────────────────────────────────────

/**
 * Slider phân bổ câu hỏi theo 3 mức độ khó.
 * Tổng luôn = totalQuestions.
 */
const DifficultyMixSlider = ({ total, mix, onChange }) => {
  const handleChange = (key, rawValue) => {
    const val = Math.max(0, Math.min(total, parseInt(rawValue) || 0));
    const remaining = total - val;
    const others = Object.keys(mix).filter((k) => k !== key);

    // Phân phối phần còn lại cho 2 mức khác theo tỉ lệ hiện tại
    const otherTotal = others.reduce((s, k) => s + mix[k], 0);
    let newMix = { ...mix, [key]: val };
    if (otherTotal === 0) {
      const half = Math.floor(remaining / 2);
      newMix[others[0]] = half;
      newMix[others[1]] = remaining - half;
    } else {
      let assigned = 0;
      others.forEach((k, i) => {
        if (i === others.length - 1) {
          newMix[k] = remaining - assigned;
        } else {
          const share = Math.round((mix[k] / otherTotal) * remaining);
          newMix[k] = share;
          assigned += share;
        }
      });
    }
    onChange(newMix);
  };

  return (
    <div className="space-y-3">
      {Object.entries(mix).map(([key, val]) => {
        const c = DIFFICULTY_COLORS[key];
        const pct = total > 0 ? Math.round((val / total) * 100) : 0;
        return (
          <div key={key}>
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs font-black uppercase ${c.text}`}>
                {DIFFICULTY_LABELS[key]}
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={total}
                  value={val}
                  onChange={(e) => handleChange(key, e.target.value)}
                  className={`w-14 text-center text-sm font-bold border ${c.border} rounded-lg py-0.5 outline-none ${c.bg} ${c.text}`}
                />
                <span className="text-xs text-slate-400 w-8">{pct}%</span>
              </div>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${c.badge} rounded-full transition-all duration-300`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
      <p className="text-[11px] text-slate-400 text-right">
        Tổng: <span className={`font-bold ${Object.values(mix).reduce((s,v) => s+v, 0) === total ? 'text-emerald-600' : 'text-red-500'}`}>
          {Object.values(mix).reduce((s,v) => s+v, 0)}
        </span> / {total}
      </p>
    </div>
  );
};

// ─── QuestionCard ──────────────────────────────────────────────────────────────

const QuestionCard = ({ question, index, onRemove, showExplanation }) => {
  const [expanded, setExpanded] = useState(false);
  const diff = question.difficulty || 'MEDIUM';
  const c = DIFFICULTY_COLORS[diff] || DIFFICULTY_COLORS.MEDIUM;
  const src = question.source || (question.aiGenerated ? 'AI' : 'BANK');

  // Từ ExamDTO.ExamQuestionDTO → question object bên trong
  const q = question.question || question;
  const options = q.options || [];

  return (
    <div className={`bg-white rounded-2xl border-2 ${c.border} shadow-sm transition-all duration-200 hover:shadow-md`}>
      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start gap-3">
          <span className={`flex-shrink-0 w-8 h-8 rounded-full ${c.badge} text-white text-xs font-black flex items-center justify-center mt-0.5`}>
            {index + 1}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>
                {DIFFICULTY_LABELS[diff]}
              </span>
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${src === 'AI' ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'}`}>
                {src === 'AI' ? '✨ AI' : '📚 Bank'}
              </span>
              {q.topic && (
                <span className="text-[10px] text-slate-400 italic truncate">{q.topic}</span>
              )}
            </div>
            <p className="text-sm font-semibold text-slate-800 leading-relaxed">
              {q.content}
            </p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
              title={expanded ? 'Thu gọn' : 'Xem đáp án'}
            >
              {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>
            <button
              onClick={() => onRemove(index)}
              className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
              title="Bỏ câu này"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Options – expanded */}
        {expanded && options.length > 0 && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 pl-11">
            {options.map((opt, i) => {
              const isCorrect = opt.isCorrect === true;
              return (
                <div
                  key={i}
                  className={`flex items-start gap-2 p-2.5 rounded-xl text-xs font-medium border transition-all ${
                    isCorrect
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : 'bg-slate-50 border-slate-100 text-slate-600'
                  }`}
                >
                  <span className={`font-black flex-shrink-0 ${isCorrect ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {opt.label || String.fromCharCode(65 + i)}.
                  </span>
                  <span>{opt.text || opt}</span>
                  {isCorrect && <CheckCircle2 className="size-3.5 text-emerald-500 flex-shrink-0 ml-auto mt-0.5" />}
                </div>
              );
            })}
          </div>
        )}

        {/* Explanation */}
        {expanded && (showExplanation || true) && q.explanation && (
          <div className="mt-3 pl-11">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700 italic leading-relaxed">
              <span className="font-bold not-italic text-blue-800">💡 Giải thích: </span>
              {q.explanation}
            </div>
          </div>
        )}

        {/* Short / Fill answer */}
        {expanded && options.length === 0 && q.correctAnswer && (
          <div className="mt-3 pl-11">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-700">
              <span className="font-bold">Đáp án: </span>{q.correctAnswer}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────

const ExamGenerator = () => {
  const { token } = useSelector((state) => state.auth);

  // ── Form state ──
  const [form, setForm] = useState({
    subject:        'Hóa học',
    grade_level:    '10',
    topic:          '',
    total_questions: 20,
    question_type:  'MULTIPLE_CHOICE',
    duration_mins:  45,
    randomized:     false,
    bank_id:        '',
  });

  // difficulty_mix tương ứng total_questions
  const [diffMix, setDiffMix] = useState({ EASY: 5, MEDIUM: 10, HARD: 5 });

  // Banks của teacher
  const [banks, setBanks] = useState([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [banksLoaded, setBanksLoaded] = useState(false);

  // UI state
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Preview state
  const [examResult, setExamResult] = useState(null);   // ExamDTO từ API
  const [previewList, setPreviewList] = useState([]);   // ExamQuestionDTO[]  (editable)
  const [showExplanations, setShowExplanations] = useState(true);

  // ── Sync diffMix khi total thay đổi ──
  const handleTotalChange = (val) => {
    const total = Math.max(1, Math.min(50, parseInt(val) || 1));
    const ratio = { EASY: 0.25, MEDIUM: 0.5, HARD: 0.25 };
    const easy = Math.round(total * ratio.EASY);
    const hard = Math.round(total * ratio.HARD);
    const medium = total - easy - hard;
    setDiffMix({ EASY: easy, MEDIUM: Math.max(0, medium), HARD: hard });
    setForm((f) => ({ ...f, total_questions: total }));
  };

  // ── Fetch banks lazily ──
  const ensureBanks = useCallback(async () => {
    if (banksLoaded) return;
    setBanksLoading(true);
    try {
      const res = await questionApi.getMyBanks();
      setBanks(res.data || []);
    } catch {
      toast.error('Không tải được danh sách ngân hàng câu hỏi');
    } finally {
      setBanksLoading(false);
      setBanksLoaded(true);
    }
  }, [banksLoaded]);

  // ── Validate diffMix total ──
  const diffMixTotal = Object.values(diffMix).reduce((s, v) => s + v, 0);
  const diffMixValid = diffMixTotal === form.total_questions;

  // ── Build payload ──
  const buildPayload = () => ({
    subject:        form.subject,
    grade_level:    form.grade_level,
    topic:          form.topic.trim(),
    total_questions: form.total_questions,
    difficulty_mix: diffMix,
    bank_id:        form.bank_id ? parseInt(form.bank_id) : null,
    question_type:  form.question_type,
    duration_mins:  form.duration_mins || null,
    randomized:     form.randomized,
  });

  // ── Generate ──
  const handleGenerate = async () => {
    if (!form.topic.trim()) return toast.error('Vui lòng nhập chủ đề bài kiểm tra');
    if (!diffMixValid) return toast.error(`Tổng câu theo độ khó phải bằng ${form.total_questions}`);

    setGenerating(true);
    setExamResult(null);
    setPreviewList([]);

    try {
      const res = await examApi.aiGenerate(buildPayload());
      const data = res.data;
      setExamResult(data);
      setPreviewList(data.questions || []);
      toast.success(`✨ Sinh đề thành công! ${data.questions?.length || 0} câu hỏi`);
    } catch (err) {
      const msg = err.response?.data?.message || 'Lỗi khi gọi AI. Vui lòng thử lại.';
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  // ── Regenerate (reset preview giữ nguyên form) ──
  const handleRegenerate = () => {
    if (generating) return;
    handleGenerate();
  };

  // ── Remove a question from preview ──
  const handleRemoveQuestion = (idx) => {
    setPreviewList((prev) => prev.filter((_, i) => i !== idx));
    toast.info('Đã bỏ câu hỏi khỏi đề');
  };

  // ── Save (publish exam từ DRAFT → lưu lại, thực ra đề đã tạo trong DB) ──
  const handleSaveExam = async () => {
    if (!examResult?.id) return;
    if (previewList.length === 0) return toast.error('Đề trống! Vui lòng giữ lại ít nhất 1 câu.');

    setSaving(true);
    try {
      // Đề thi đã DRAFT trong DB rồi (được tạo trong handleGenerate).
      // Hành động "Lưu đề" ở đây = Publish.
      await examApi.publishExam(examResult.id);
      toast.success('🎉 Đề thi đã được lưu và phát hành!');
      // Reset để tạo đề mới
      setExamResult(null);
      setPreviewList([]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không thể lưu đề thi');
    } finally {
      setSaving(false);
    }
  };

  // ── Print / Export PDF ──
  const handlePrint = () => {
    if (!examResult || previewList.length === 0) return;

    const LABELS = ['A', 'B', 'C', 'D', 'E'];
    const questionsHtml = previewList.map((item, idx) => {
      const q = item.question || item;
      const options = q.options || [];
      const optionsHtml = options.length > 0
        ? `<div class="options">${options.map((o, i) => {
            const label = o.label || LABELS[i] || String(i + 1);
            return `<div class="option"><span class="opt-label">${label}.</span> ${o.text || o}</div>`;
          }).join('')}</div>`
        : '';
      return `
        <div class="question">
          <p class="q-content"><strong>Câu ${idx + 1}.</strong> ${q.content}</p>
          ${optionsHtml}
        </div>`;
    }).join('');

    // Answer key
    const answerKey = previewList.map((item, idx) => {
      const q = item.question || item;
      const correct = (q.options || []).find(o => o.isCorrect);
      if (!correct) return `<span class="ans">Câu ${idx + 1}: ${q.correctAnswer || '...'}</span>`;
      const i = (q.options || []).indexOf(correct);
      return `<span class="ans">Câu ${idx + 1}: ${correct.label || 'ABCDE'[i]}</span>`;
    }).join('');

    const html = `<!DOCTYPE html><html lang="vi"><head>
      <meta charset="UTF-8"/>
      <title>${examResult.title || 'Đề thi'}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Times New Roman', serif; font-size: 13pt; line-height: 1.6; padding: 20mm 20mm 20mm 25mm; color: #000; }
        .header { text-align: center; margin-bottom: 24px; }
        .school { font-size: 11pt; text-transform: uppercase; font-weight: bold; }
        .title { font-size: 16pt; font-weight: bold; text-transform: uppercase; margin: 8px 0 4px; }
        .meta { font-size: 11pt; color: #333; }
        .divider { border: none; border-top: 2px solid #000; margin: 16px 0; }
        .question { margin-bottom: 18px; page-break-inside: avoid; }
        .q-content { font-weight: normal; margin-bottom: 6px; }
        .options { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; padding-left: 16px; }
        .option { font-size: 12pt; }
        .opt-label { font-weight: bold; }
        .answer-key { margin-top: 32px; border-top: 1px dashed #666; padding-top: 16px; }
        .answer-key h3 { font-size: 12pt; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
        .ans { display: inline-block; margin: 2px 12px 2px 0; font-size: 11pt; }
        @media print { body { padding: 0; } }
      </style>
    </head><body>
      <div class="header">
        <div class="school">PlanbookAI – Hệ thống quản lý giáo dục</div>
        <div class="title">${examResult.title || 'ĐỀ KIỂM TRA'}</div>
        <div class="meta">
          Môn: ${examResult.subject || ''} &nbsp;|&nbsp;
          Lớp: ${examResult.gradeLevel || ''} &nbsp;|&nbsp;
          Thời gian: ${examResult.durationMins || 45} phút
          (Không kể thời gian phát đề)
        </div>
      </div>
      <hr class="divider"/>
      ${questionsHtml}
      <div class="answer-key">
        <h3>Đáp án</h3>
        ${answerKey}
      </div>
    </body></html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  };

  const bankCount = previewList.filter(q => (q.source || '') !== 'AI').length;
  const aiCount   = previewList.filter(q => (q.source || '') === 'AI').length;

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-br from-blue-600 to-violet-600 rounded-xl text-white shadow-lg shadow-blue-200">
              <Brain className="size-5" />
            </div>
            Tạo Đề Thi Bằng AI
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            AI kết hợp ngân hàng câu hỏi → sinh đề tự động. Review, chỉnh sửa rồi lưu.
          </p>
        </div>
        {examResult && (
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <FileText className="size-3.5" />
            Đề #{examResult.id} • {previewList.length} câu
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

        {/* ════════════ LEFT – Form ════════════ */}
        <div className="xl:col-span-4 space-y-4">

          {/* Card: Thông tin đề */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm shadow-slate-100 p-5 space-y-4">
            <div className="flex items-center gap-2 text-slate-700">
              <BookOpen className="size-4 text-blue-600" />
              <h2 className="font-black text-sm uppercase tracking-wider">Thông tin đề thi</h2>
            </div>

            {/* Subject */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">Môn học *</label>
              <select
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
              >
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Grade */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">Khối lớp *</label>
              <div className="flex flex-wrap gap-2">
                {GRADES.map(g => (
                  <button
                    key={g}
                    onClick={() => setForm({ ...form, grade_level: g })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black border transition-all ${
                      form.grade_level === g
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-200'
                        : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    Lớp {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Topic */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">Chủ đề / Chương *</label>
              <input
                type="text"
                placeholder="VD: Nguyên tử – Phân tử, Hàm số bậc hai..."
                value={form.topic}
                onChange={(e) => setForm({ ...form, topic: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-300"
              />
            </div>

            {/* Question type */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">Loại câu hỏi</label>
              <select
                value={form.question_type}
                onChange={(e) => setForm({ ...form, question_type: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
              >
                {QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            {/* Duration + Total */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                  <Clock className="size-3" /> Thời gian (phút)
                </label>
                <input
                  type="number"
                  min={5}
                  max={180}
                  value={form.duration_mins}
                  onChange={(e) => setForm({ ...form, duration_mins: parseInt(e.target.value) || 45 })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-center text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                  <GraduationCap className="size-3" /> Số câu (1–50)
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={form.total_questions}
                  onChange={(e) => handleTotalChange(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-center text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>
            </div>

            {/* Randomized toggle */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                <Shuffle className="size-3.5" /> Trộn ngẫu nhiên
              </span>
              <button
                onClick={() => setForm({ ...form, randomized: !form.randomized })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.randomized ? 'bg-blue-600' : 'bg-slate-200'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.randomized ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>

          {/* Card: Phân bổ độ khó */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm shadow-slate-100 p-5 space-y-3">
            <div className="flex items-center gap-2 text-slate-700">
              <Sliders className="size-4 text-amber-500" />
              <h2 className="font-black text-sm uppercase tracking-wider">Phân bổ độ khó</h2>
            </div>
            <DifficultyMixSlider
              total={form.total_questions}
              mix={diffMix}
              onChange={setDiffMix}
            />
            {!diffMixValid && (
              <div className="flex items-center gap-1.5 text-xs text-red-500 font-medium">
                <AlertCircle className="size-3.5" />
                Tổng phải bằng {form.total_questions} câu
              </div>
            )}
          </div>

          {/* Card: Ngân hàng câu hỏi */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm shadow-slate-100 p-5 space-y-3">
            <div className="flex items-center gap-2 text-slate-700">
              <BarChart3 className="size-4 text-violet-500" />
              <h2 className="font-black text-sm uppercase tracking-wider">Ngân hàng câu hỏi</h2>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Chọn bank để ưu tiên lấy câu đã có. AI sẽ sinh bù phần còn thiếu.
              <br />Bỏ chọn → AI sinh tất cả.
            </p>
            <select
              value={form.bank_id}
              onChange={(e) => setForm({ ...form, bank_id: e.target.value })}
              onFocus={ensureBanks}
              disabled={banksLoading}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all disabled:opacity-60"
            >
              <option value="">✨ AI sinh toàn bộ (không dùng bank)</option>
              {banks.map(b => (
                <option key={b.id} value={b.id}>📚 {b.name}</option>
              ))}
            </select>
            {banksLoading && (
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <Loader2 className="size-3 animate-spin" /> Đang tải danh sách bank...
              </p>
            )}
          </div>

          {/* ── Generate Button ── */}
          <button
            onClick={handleGenerate}
            disabled={generating || !form.topic.trim() || !diffMixValid}
            className="w-full bg-gradient-to-r from-blue-600 via-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 disabled:from-slate-300 disabled:to-slate-400 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 shadow-lg shadow-blue-200 active:scale-[0.98] transition-all duration-200 disabled:shadow-none disabled:cursor-not-allowed"
          >
            {generating ? (
              <>
                <Loader2 className="size-5 animate-spin" />
                AI đang tạo đề...
              </>
            ) : (
              <>
                <Sparkles className="size-5" />
                Tạo đề bằng AI
              </>
            )}
          </button>
        </div>

        {/* ════════════ RIGHT – Preview ════════════ */}
        <div className="xl:col-span-8">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm shadow-slate-100 min-h-[600px] flex flex-col overflow-hidden sticky top-6">

            {/* Preview Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/60">
              <div className="flex items-center gap-3">
                <eye className="size-4 text-slate-400" />
                <span className="text-sm font-black text-slate-700 uppercase tracking-wider">
                  Preview Đề Thi
                </span>
                {previewList.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                      {bankCount} bank
                    </span>
                    <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-bold">
                      {aiCount} AI
                    </span>
                  </div>
                )}
              </div>

              {previewList.length > 0 && (
                <div className="flex items-center gap-2">
                  {/* Toggle explanations */}
                  <button
                    onClick={() => setShowExplanations(!showExplanations)}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1.5 px-2 py-1.5 hover:bg-slate-100 rounded-lg transition-all"
                  >
                    {showExplanations ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    {showExplanations ? 'Ẩn giải thích' : 'Hiện giải thích'}
                  </button>

                  {/* Print */}
                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-1.5 text-xs font-black px-3 py-1.5 text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-all"
                    title="In đề / Xuất PDF"
                  >
                    <Printer className="size-3.5" />
                    In đề
                  </button>

                  {/* Regenerate */}
                  <button
                    onClick={handleRegenerate}
                    disabled={generating}
                    className="flex items-center gap-1.5 text-xs font-black px-3 py-1.5 text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`size-3.5 ${generating ? 'animate-spin' : ''}`} />
                    Tạo lại đề
                  </button>

                  {/* Save */}
                  <button
                    onClick={handleSaveExam}
                    disabled={saving || previewList.length === 0}
                    className="flex items-center gap-1.5 text-xs font-black px-3 py-1.5 text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm shadow-emerald-200 transition-all disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                    Lưu đề
                  </button>
                </div>
              )}
            </div>

            {/* Preview Body */}
            <div className="flex-1 p-6 overflow-y-auto">
              {generating ? (
                // Loading state
                <div className="h-full flex flex-col items-center justify-center text-center space-y-5">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-violet-100 flex items-center justify-center">
                      <Brain className="size-9 text-blue-600" />
                    </div>
                    <div className="absolute inset-0 rounded-full border-4 border-blue-300 border-t-blue-600 animate-spin" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-black text-slate-800 text-lg">AI đang tạo đề thi...</p>
                    <p className="text-sm text-slate-400">
                      Đang truy vấn ngân hàng câu hỏi và gọi Gemini AI
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    {[0,1,2].map(i => (
                      <div key={i} className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>

              ) : previewList.length > 0 ? (
                // Question list
                <div className="space-y-3">
                  {/* Exam meta info */}
                  {examResult && (
                    <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-xs font-black text-slate-700 truncate">{examResult.title}</span>
                      <span className="text-slate-200">|</span>
                      <span className="text-xs text-slate-500">{examResult.subject} • Lớp {examResult.gradeLevel}</span>
                      {examResult.durationMins && (
                        <>
                          <span className="text-slate-200">|</span>
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Clock className="size-3" />{examResult.durationMins} phút
                          </span>
                        </>
                      )}
                    </div>
                  )}

                  {previewList.map((q, idx) => (
                    <QuestionCard
                      key={q.examQuestionId || idx}
                      question={q}
                      index={idx}
                      onRemove={handleRemoveQuestion}
                      showExplanation={showExplanations}
                    />
                  ))}

                  {/* Bottom action bar */}
                  <div className="pt-4 flex items-center justify-between border-t border-slate-100">
                    <span className="text-xs text-slate-400 font-medium">
                      Còn lại <strong className="text-slate-700">{previewList.length}</strong> câu hỏi
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleRegenerate}
                        disabled={generating}
                        className="flex items-center gap-1.5 text-xs font-black px-4 py-2 text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-all disabled:opacity-50"
                      >
                        <RefreshCw className={`size-3.5 ${generating ? 'animate-spin': ''}`} />
                        Tạo lại đề
                      </button>
                      <button
                        onClick={handleSaveExam}
                        disabled={saving || previewList.length === 0}
                        className="flex items-center gap-1.5 text-xs font-black px-4 py-2 text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm shadow-emerald-200 transition-all disabled:opacity-50"
                      >
                        {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                        Lưu &amp; Phát hành
                      </button>
                    </div>
                  </div>
                </div>

              ) : (
                // Empty state
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 min-h-[400px]">
                  <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-slate-100 to-blue-50 flex items-center justify-center border-2 border-dashed border-slate-200">
                    <Sparkles className="size-10 text-slate-300" />
                  </div>
                  <div className="space-y-1.5">
                    <p className="font-black text-slate-600 text-base">Chưa có đề thi</p>
                    <p className="text-sm text-slate-400 max-w-xs">
                      Điền thông tin bên trái và nhấn <strong>"Tạo đề bằng AI"</strong> để bắt đầu.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                    {['✨ AI sinh câu tự động', '📚 Ưu tiên từ bank', '🔀 Trộn độ khó'].map(tip => (
                      <span key={tip} className="text-xs bg-slate-100 text-slate-500 px-3 py-1 rounded-full font-medium">
                        {tip}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamGenerator;