import React, { useState, useEffect } from 'react';
import { ArrowLeft, Brain, Sparkles, Send, Check, Edit3, Trash2, X, PlusCircle, Book, Layout, Loader2, FileText } from 'lucide-react';
import questionApi from '../../services/questionApi';
import promptTemplateApi from '../../services/promptTemplateApi';
import { toast } from 'sonner';
import ApprovalStatusBadge from '../../components/ui/ApprovalStatusBadge';

/**
 * AIQuestionGenerator – Bộ tạo câu hỏi thông minh.
 * Quy trình:
 * 1. Nhập thông số (Form)
 * 2. Preview & Chỉnh sửa (Preview)
 * 3. Lưu vào DB (Save)
 */
const AIQuestionGenerator = ({ banks, initialBankId, onClose }) => {
  // --- States cho Form ---
  const [params, setParams] = useState({
    bankId: initialBankId || (banks[0]?.id || ""),
    subject: "Hóa học",
    topic: "",
    difficulty: "MEDIUM",
    type: "MULTIPLE_CHOICE",
    count: 5
  });

  // --- Template state ---
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  // --- States cho Preview ---
  const [previewQuestions, setPreviewQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [saving, setSaving] = useState(false);

  // Fetch approved QUESTION_GEN templates
  useEffect(() => {
    promptTemplateApi.getApproved('QUESTION_GEN')
      .then(res => setTemplates(res.data || []))
      .catch(() => {}); // silent fail — template là tuỳ chọn
  }, []);

  // --- Handlers ---
  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!params.bankId) return toast.error("Vui lòng chọn ngân hàng câu hỏi.");
    if (!params.topic) return toast.error("Vui lòng nhập chủ đề.");

    try {
      setLoading(true);
      setPreviewQuestions([]);

      if (selectedTemplateId) {
        // ── Dùng Prompt Template đã duyệt ──
        const inputs = {
          subject: params.subject,
          topic: params.topic,
          difficulty: params.difficulty,
          count: String(params.count),
          grade: params.grade || '',
        };
        const res = await promptTemplateApi.generate(Number(selectedTemplateId), inputs);
        // Backend trả về string JSON → parse thành mảng câu hỏi
        const raw = res.data?.content || '';
        try {
          const jsonMatch = raw.match(/\[[\s\S]*\]/);
          const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
          const mapped = parsed.map(q => ({
            content: q.content || q.question || '',
            type: 'MULTIPLE_CHOICE',
            difficulty: params.difficulty,
            options: q.options
              ? Object.entries(q.options).map(([label, text], i) => ({
                  label, text, isCorrect: label === (q.correctAnswer || q.answer)
                }))
              : [],
            explanation: q.explanation || '',
          }));
          setPreviewQuestions(mapped);
          toast.success(`Đã sinh ${mapped.length} câu từ template!`);
        } catch {
          toast.error('AI trả về định dạng không hợp lệ. Thử lại hoặc dùng chế độ mặc định.');
        }
      } else {
        // ── Dùng prompt mặc định (cũ) ──
        const res = await questionApi.aiGeneratePreview(params);
        setPreviewQuestions(res.data);
        toast.success(`Đã sinh thành công ${res.data.length} câu hỏi! Review ngay.`);
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Lỗi khi sinh câu hỏi. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };


  const handleUpdatePreview = (index, updatedQuestion) => {
    const newQuestions = [...previewQuestions];
    newQuestions[index] = updatedQuestion;
    setPreviewQuestions(newQuestions);
    setEditingIndex(null);
  };

  const handleDeletePreview = (index) => {
    setPreviewQuestions(previewQuestions.filter((_, i) => i !== index));
  };

  const handleFinalSave = async () => {
    if (previewQuestions.length === 0) return;
    
    try {
      setSaving(true);
      await questionApi.saveBatch({
        bankId: params.bankId,
        questions: previewQuestions
      });
      toast.success("Đã lưu tất cả câu hỏi vào ngân hàng!");
      onClose();
    } catch (err) {
      toast.error("Lỗi khi lưu câu hỏi.");
    } finally {
      setSaving(false);
    }
  };

  // --- Render Helpers ---
  const renderForm = () => (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center space-y-2">
        <div className="inline-flex p-3 bg-indigo-100 text-indigo-600 rounded-2xl mb-2">
          <Brain size={32} />
        </div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Sinh câu hỏi thông minh</h2>
        <p className="text-slate-500 font-medium">Sử dụng Gemini AI để tạo bộ câu hỏi chất lượng chỉ trong vài giây.</p>
      </div>

      <form onSubmit={handleGenerate} className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-2xl shadow-slate-200/50 space-y-6">

        {/* Template selector */}
        {templates.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <FileText size={16} /> Prompt Template <span className="text-xs font-normal text-slate-400">(Tuỳ chọn — để trống dùng prompt mặc định)</span>
            </label>
            <select
              className="w-full px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-indigo-800"
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
            >
              <option value="">-- Dùng prompt mặc định --</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
            {selectedTemplateId && (
              <p className="text-xs text-indigo-600 font-medium">
                ✅ Sẽ dùng prompt template đã được Manager duyệt thay cho prompt mặc định.
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Layout size={16} /> Ngân hàng câu hỏi
            </label>
            <select 
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
              value={params.bankId}
              onChange={(e) => setParams({...params, bankId: e.target.value})}
              required
            >
              <option value="">-- Chọn ngân hàng --</option>
              {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Book size={16} /> Môn học
            </label>
            <input 
              type="text"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
              value={params.subject}
              onChange={(e) => setParams({...params, subject: e.target.value})}
              placeholder="VD: Hóa học 10"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">Chủ đề bài học / Nội dung kiến thức</label>
          <textarea 
            rows="3"
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium resize-none"
            value={params.topic}
            onChange={(e) => setParams({...params, topic: e.target.value})}
            placeholder="VD: Bảng tuần hoàn các nguyên tố hóa học, Cấu hình electron..."
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Độ khó</label>
            <select 
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
              value={params.difficulty}
              onChange={(e) => setParams({...params, difficulty: e.target.value})}
            >
              <option value="EASY">Dễ</option>
              <option value="MEDIUM">Trung bình</option>
              <option value="HARD">Khó</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Loại câu hỏi</label>
            <select 
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
              value={params.type}
              onChange={(e) => setParams({...params, type: e.target.value})}
            >
              <option value="MULTIPLE_CHOICE">Trắc nghiệm (4 đáp án)</option>
              <option value="SHORT_ANSWER">Trả lời ngắn</option>
              <option value="FILL_IN_BLANK">Điền khuyết (___)</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Số lượng (1-20)</label>
            <input 
              type="number"
              min="1" max="20"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
              value={params.count}
              onChange={(e) => setParams({...params, count: parseInt(e.target.value)})}
            />
          </div>
        </div>

        <button 
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-lg uppercase tracking-wider flex items-center justify-center gap-3 hover:bg-indigo-700 hover:shadow-xl hover:shadow-indigo-200 transition-all active:scale-[0.98] disabled:bg-indigo-300"
        >
          {loading ? (
            <><Loader2 className="animate-spin" size={24} /> Đang tư duy...</>
          ) : (
            <><Sparkles size={24} /> Bắt đầu tạo ngay</>
          )}
        </button>
      </form>
    </div>
  );

  const renderPreview = () => (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-10 bg-slate-50 py-4 -mx-4 px-4 bg-opacity-90 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2 uppercase tracking-wide">
            <Check className="text-green-500" /> Review câu hỏi sinh ra
          </h2>
          <p className="text-sm text-slate-500 font-medium italic">Vui lòng kiểm tra lại nội dung trước khi lưu chính thức.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setPreviewQuestions([])}
            className="px-4 py-2 border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-100 transition-all"
          >
            Hủy kết quả
          </button>
          <button 
            onClick={handleFinalSave}
            disabled={saving || previewQuestions.length === 0}
            className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-lg shadow-green-100 transition-all active:scale-95 disabled:bg-green-300"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
            Xác nhận lưu {previewQuestions.length} câu
          </button>
        </div>
      </div>

      <div className="space-y-4 max-w-4xl mx-auto">
        {previewQuestions.map((q, idx) => (
          <div key={idx} className="group relative bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all">
            {editingIndex === idx ? (
              <div className="space-y-4">
                <textarea 
                  className="w-full p-4 border rounded-xl text-lg font-medium outline-indigo-500"
                  value={q.content}
                  onChange={(e) => {
                    const next = [...previewQuestions];
                    next[idx].content = e.target.value;
                    setPreviewQuestions(next);
                  }}
                />
                
                {q.type === 'MULTIPLE_CHOICE' && q.options && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {q.options.map((opt, oIdx) => (
                      <div key={oIdx} className="flex gap-2 items-center">
                        <input 
                          type="radio" 
                          name={`correct-${idx}`}
                          checked={opt.isCorrect}
                          onChange={() => {
                            const next = [...previewQuestions];
                            next[idx].options = next[idx].options.map((o, i) => ({...o, isCorrect: i === oIdx}));
                            setPreviewQuestions(next);
                          }}
                        />
                        <input 
                          className="flex-1 p-2 border rounded-lg text-sm"
                          value={opt.text}
                          onChange={(e) => {
                            const next = [...previewQuestions];
                            next[idx].options[oIdx].text = e.target.value;
                            setPreviewQuestions(next);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button 
                    onClick={() => setEditingIndex(null)}
                    className="p-2 bg-indigo-600 text-white rounded-lg"
                  >
                    Xong
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex gap-2">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-600 text-xs font-black">
                      #{idx + 1}
                    </span>
                    <h3 className="text-lg font-bold text-slate-800 flex-1 leading-snug">
                      {q.content}
                    </h3>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button 
                      onClick={() => setEditingIndex(idx)}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                    >
                      <Edit3 size={18} />
                    </button>
                    <button 
                      onClick={() => handleDeletePreview(idx)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                {q.type === 'MULTIPLE_CHOICE' && q.options && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-10">
                    {q.options.map((opt, oIdx) => (
                      <div 
                        key={oIdx} 
                        className={`p-3 rounded-xl border ${opt.isCorrect ? 'bg-green-50 border-green-200 text-green-700' : 'bg-slate-50 border-slate-100 text-slate-600'} text-sm font-medium`}
                      >
                        <span className="font-bold mr-2">{opt.label}.</span>
                        {opt.text}
                        {opt.isCorrect && <Check size={14} className="inline ml-2" />}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-4 pl-10">
                   <div className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1">
                      <Layout size={12}/> {q.type}
                   </div>
                   <div className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1">
                      <Sparkles size={12}/> {q.difficulty}
                   </div>
                   {/* Approval status badge – hiển thị cho Staff biết trạng thái duyệt */}
                   {q.id && (
                     <ApprovalStatusBadge isApproved={q.isApproved} approvedByName={q.approvedByName} />
                   )}
                </div>

                {q.explanation && (
                  <div className="mt-4 pl-10">
                    <div className="p-3 bg-amber-50 rounded-xl border-l-4 border-amber-300">
                      <p className="text-xs font-black text-amber-800 mb-1 uppercase tracking-tighter">Giải thích của AI</p>
                      <p className="text-sm text-amber-700 leading-relaxed font-medium italic">"{q.explanation}"</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        
        <button 
          onClick={() => {
            // Logic để add manual câu hỏi nếu cần
          }}
          className="w-full py-6 border-2 border-dashed border-slate-200 rounded-3xl text-slate-400 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 group font-bold"
        >
          <PlusCircle size={20} className="group-hover:scale-110 transition-transform" />
          Thêm câu hỏi thủ công
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
       {/* Simple Navbar */}
       <div className="h-16 flex items-center px-6 border-b bg-white border-slate-200 justify-between">
          <button 
             onClick={onClose}
             className="flex items-center gap-2 text-slate-600 hover:text-indigo-600 font-bold transition-colors"
          >
             <ArrowLeft size={20} /> Quay lại
          </button>
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white">
                <Brain size={16}/>
             </div>
             <span className="font-black text-slate-900 uppercase tracking-widest text-sm">AI Generator v1.0</span>
          </div>
       </div>

       <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {previewQuestions.length > 0 ? renderPreview() : renderForm()}
       </div>
    </div>
  );
};

export default AIQuestionGenerator;
