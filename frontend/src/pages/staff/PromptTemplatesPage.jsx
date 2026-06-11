import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation } from 'react-router-dom';
import { Plus, Edit, Trash2, CheckCircle, XCircle, Sparkles, BookOpen, Eye, X } from 'lucide-react';
import { fetchTemplates, deleteTemplate, approveTemplate } from '../../features/promptTemplates/promptTemplateSlice';
import ApprovalStatusBadge from '../../components/ui/ApprovalStatusBadge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../components/ui/card';
import { toast } from 'sonner';

// ─── Modal xem chi tiết prompt ────────────────────────────────────────────────
function PromptDetailModal({ template, onClose, onApprove, onReject, isManagerOrAdmin }) {
  if (!template) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-2xl rounded-xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{template.title}</h2>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs font-medium">{template.purpose}</span>
              <ApprovalStatusBadge status={template.status} approvedByName={template.approvedByName} size="sm" />
              {template.createdByName && (
                <span className="text-xs text-gray-500">👤 {template.createdByName}</span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <X className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          {template.variables && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Biến số</p>
              <div className="flex flex-wrap gap-1.5">
                {template.variables.split(',').filter(v => v.trim()).map((v, i) => (
                  <span key={i} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-mono">{`{{${v.trim()}}}`}</span>
                ))}
              </div>
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Nội dung Prompt</p>
            <pre className="whitespace-pre-wrap rounded-lg bg-gray-50 border border-gray-200 p-4 text-sm text-gray-800 font-mono leading-relaxed">
              {template.promptText || '(Không có nội dung)'}
            </pre>
          </div>

        </div>

        {/* Footer actions */}
        <div className="border-t px-6 py-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50">
            Đóng
          </button>
          {isManagerOrAdmin && template.status === 'PENDING' && (
            <>
              <button
                onClick={() => { onReject(template.id); onClose(); }}
                className="px-4 py-2 rounded-lg text-sm bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 flex items-center gap-1.5"
              >
                <XCircle className="size-4" /> Từ chối
              </button>
              <button
                onClick={() => { onApprove(template.id); onClose(); }}
                className="px-4 py-2 rounded-lg text-sm bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1.5"
              >
                <CheckCircle className="size-4" /> Duyệt
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function PromptTemplatesPage() {
  const dispatch = useDispatch();
  const location = useLocation();
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const { templates = [], loading = false } = useSelector((state) => state.promptTemplates || {});
  const user = useSelector((state) => state.auth?.user);

  const rawRole = user?.roleName || (user?.role && typeof user.role === 'object' ? user.role.name : user?.role) || '';
  const userRole = rawRole.toUpperCase().replace('ROLE_', '');
  const isManagerOrAdmin = ['MANAGER', 'ADMIN'].includes(userRole);
  const isTeacher = userRole === 'TEACHER';

  const isApprovalView = location.pathname === '/manager/approve';
  const isLessonPlanLibrary = location.pathname.includes('/lesson-plans');

  useEffect(() => {
    if (isLessonPlanLibrary) {
      dispatch(fetchTemplates({ purpose: 'LESSON_PLAN_GEN' }));
    } else {
      dispatch(fetchTemplates());
    }
  }, [dispatch, isLessonPlanLibrary]);

  const handleDelete = async (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa template này?')) {
      try {
        await dispatch(deleteTemplate(id)).unwrap();
        toast.success('Xóa template thành công');
      } catch (err) {
        toast.error(err);
      }
    }
  };

  const handleApproval = async (id, status) => {
    const actionText = status === 'APPROVED' ? 'duyệt' : 'từ chối';
    try {
      await dispatch(approveTemplate({ id, status })).unwrap();
      toast.success(`✅ Đã ${actionText} template thành công`);
    } catch (err) {
      toast.error(`❌ Lỗi: ${err || 'Không thể ' + actionText + ' template'}`);
    }
  };

  if (loading && templates.length === 0) return <div className="p-8 text-center">Đang tải...</div>;

  const safeTemplates = Array.isArray(templates) ? templates : [];
  const displayTemplates = isApprovalView
    ? safeTemplates.filter(t => t?.status === 'PENDING')
    : safeTemplates;

  // Giao diện Thư viện dành riêng cho Teacher
  const renderTeacherLibrary = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {displayTemplates.length === 0 ? (
        <div className="col-span-full py-20 text-center bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-200">
          <BookOpen className="size-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Hiện chưa có mẫu giáo án nào khả dụng.</p>
          <p className="text-sm text-gray-400">Vui lòng quay lại sau khi Manager đã phê duyệt nội dung mới.</p>
        </div>
      ) : (
        displayTemplates.map((item) => (
          <Card key={item.id} className="hover:shadow-md transition-shadow border-t-4 border-t-primary">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold uppercase rounded">
                  {item.purpose}
                </span>
                <Sparkles className="size-4 text-amber-500" />
              </div>
              <CardTitle className="text-lg mt-2 line-clamp-1">{item.title}</CardTitle>
              <CardDescription className="line-clamp-2 min-h-[40px]">
                Sử dụng mẫu này để AI hỗ trợ tạo nội dung bài giảng chuyên nghiệp.
              </CardDescription>
            </CardHeader>
            <CardContent className="py-2">
              <div className="flex flex-wrap gap-1.5">
                {(item.variables?.split(',') || [])
                  .filter(v => v.trim() !== '')
                  .map((v, idx) => (
                    <span key={idx} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">
                      {v.trim()}
                    </span>
                  ))}
              </div>
            </CardContent>
            <CardFooter className="pt-4">
              <Link
                to={`/generate-lesson-plan/${item.id}`}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary py-2 text-sm font-bold text-white shadow-sm hover:bg-primary/90 transition-all"
              >
                <Sparkles className="size-4" />
                Sử dụng ngay
              </Link>
            </CardFooter>
          </Card>
        ))
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Detail modal */}
      {selectedTemplate && (
        <PromptDetailModal
          template={selectedTemplate}
          onClose={() => setSelectedTemplate(null)}
          onApprove={(id) => handleApproval(id, 'APPROVED')}
          onReject={(id) => handleApproval(id, 'REJECTED')}
          isManagerOrAdmin={isManagerOrAdmin}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            {isApprovalView ? 'Phê duyệt Prompt Templates' :
             isTeacher ? 'Thư viện Giáo án AI' : 'Quản lý Prompt Templates'}
          </h1>
          <p className="text-sm text-gray-500">
            {isApprovalView ? 'Xét duyệt các câu lệnh AI mới từ nhân viên.' :
             isTeacher ? 'Chọn mẫu giáo án và để AI hỗ trợ bạn soạn bài trong giây lát.' : 'Tạo và quản lý các câu lệnh AI để hỗ trợ giáo viên.'}
          </p>
        </div>
        {!isApprovalView && !isTeacher && (
          <Link
            to="/prompt-templates/new"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow hover:bg-primary/90"
          >
            <Plus className="size-4" />
            Thêm mới
          </Link>
        )}
      </div>

      {isTeacher ? (
        renderTeacherLibrary()
      ) : (
        <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-700 font-semibold border-b">
              <tr>
                <th className="px-6 py-4">Tiêu đề</th>
                {isApprovalView && <th className="px-6 py-4">Người tạo</th>}
                <th className="px-6 py-4">Mục đích</th>
                <th className="px-6 py-4">Biến số</th>
                <th className="px-6 py-4">Trạng thái</th>
                <th className="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {displayTemplates.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-500 italic">
                    Danh sách hiện đang trống.
                  </td>
                </tr>
              )}
              {displayTemplates.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">{item.title}</td>
                  {isApprovalView && (
                    <td className="px-6 py-4 text-gray-600 text-xs font-semibold">{item.createdByName || 'N/A'}</td>
                  )}
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs font-medium">
                      {item.purpose}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500 font-mono text-xs italic">{item.variables}</td>
                  <td className="px-6 py-4">
                    <ApprovalStatusBadge
                      status={item.status}
                      approvedByName={item.approvedByName}
                      size="sm"
                    />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1">
                      {/* Nút xem chi tiết — hiển thị cho tất cả */}
                      <button
                        onClick={() => setSelectedTemplate(item)}
                        title="Xem nội dung prompt"
                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                      >
                        <Eye className="size-4" />
                      </button>

                      {/* Nút duyệt/từ chối — chỉ Manager/Admin với PENDING */}
                      {isManagerOrAdmin && item.status === 'PENDING' && (
                        <>
                          <button
                            onClick={() => handleApproval(item.id, 'APPROVED')}
                            title="Duyệt"
                            className="p-2 text-gray-400 hover:text-emerald-600 transition-colors"
                          >
                            <CheckCircle className="size-4" />
                          </button>
                          <button
                            onClick={() => handleApproval(item.id, 'REJECTED')}
                            title="Từ chối"
                            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                          >
                            <XCircle className="size-4" />
                          </button>
                        </>
                      )}

                      {/* Nút sửa/xóa — chỉ Staff (không phải Manager/Admin) và không ở trang approval */}
                      {!isApprovalView && !isManagerOrAdmin && (
                        <>
                          <Link to={`/prompt-templates/${item.id}/edit`} className="p-2 text-gray-400 hover:text-primary">
                            <Edit className="size-4" />
                          </Link>
                          <button onClick={() => handleDelete(item.id)} className="p-2 text-gray-400 hover:text-red-600">
                            <Trash2 className="size-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
