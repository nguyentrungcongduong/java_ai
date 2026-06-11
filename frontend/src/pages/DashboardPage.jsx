import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  Sparkles, Calendar, BookOpen, Clock, Users, ArrowUpRight,
  Zap, Target, TrendingUp, FileText, Brain, ScanLine, BarChart2,
  CheckCircle2, Crown, Star, Shield
} from "lucide-react";
import { subscriptionsApi } from "../features/subscriptions/subscriptionsApi";
import api from "../services/api";

const DashboardPage = () => {
  const { user } = useSelector((state) => state.auth);
  const navigate = useNavigate();

  const [activeOrder, setActiveOrder] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(true);

  // Real stats state
  const [statsData, setStatsData] = useState({
    lessonPlanCount: null,
    studentGroupCount: null,
    aiQuestionsCount: null,
    performanceScore: null,
  });
  const [loadingStats, setLoadingStats] = useState(true);

  // Recent activity
  const [recentPlans, setRecentPlans] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  useEffect(() => {
    subscriptionsApi.getMyOrders()
      .then(res => {
        const orders = res.data || [];
        const active = orders.find(o => o.status === "ACTIVE");
        setActiveOrder(active || null);
      })
      .catch(() => setActiveOrder(null))
      .finally(() => setLoadingPlan(false));
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [lessonRes, analyticsRes] = await Promise.allSettled([
          api.get("/lesson-plans", { params: { page: 0, size: 1 } }),
          api.get("/analytics/students"),
        ]);

        const lessonCount =
          lessonRes.status === "fulfilled"
            ? lessonRes.value.data?.totalElements ?? null
            : null;

        const summary =
          analyticsRes.status === "fulfilled"
            ? analyticsRes.value.data?.summary
            : null;

        // Điểm hiệu suất = % đề đã publish / tổng đề (thang 100)
        const perfScore =
          summary && summary.totalExams > 0
            ? Math.round((summary.publishedExams / summary.totalExams) * 100)
            : null;

        // Thời gian AI hỗ trợ ≈ số câu AI tạo / 10 (quy ước: mỗi 10 câu ~ 1h)
        const aiHours =
          summary && summary.totalAiQuestions > 0
            ? Math.round(summary.totalAiQuestions / 10)
            : null;

        setStatsData({
          lessonPlanCount: lessonCount,
          studentGroupCount: summary?.studentGroupCount ?? null,
          aiQuestionsCount: aiHours,
          performanceScore: perfScore,
        });
      } catch (err) {
        console.error("[Dashboard] fetchStats error:", err);
      } finally {
        setLoadingStats(false);
      }
    };
    fetchStats();
  }, []);

  useEffect(() => {
    api.get("/lesson-plans", { params: { page: 0, size: 5 } })
      .then(res => setRecentPlans(res.data?.content ?? []))
      .catch(() => setRecentPlans([]))
      .finally(() => setLoadingRecent(false));
  }, []);

  const pkgName = (activeOrder?.packageName || "FREE").toUpperCase();
  const hasActivePlan = !!activeOrder && pkgName !== "FREE";

  // Lookup table cho các gói đã biết – gói admin thêm mới sẽ dùng fallback generic
  const PKG_PRESETS = {
    PRO:     { gradient: "from-blue-500 to-indigo-600",   icon: <Zap   className="w-6 h-6" />, desc: "Ban dang dung goi PRO voi day du tinh nang AI." },
    PREMIUM: { gradient: "from-purple-500 to-pink-600",   icon: <Crown className="w-6 h-6" />, desc: "Ban dang dung goi PREMIUM – khong gioi han moi tinh nang." },
    FREE:    { gradient: "from-slate-400 to-slate-500",   icon: <Star  className="w-6 h-6" />, desc: "Goi mien phi – nang cap de mo khoa day du tinh nang AI." },
  };
  const pkgPreset = PKG_PRESETS[pkgName] ?? {
    // Gói admin thêm tùy ý – dùng gradient mặc định, mô tả tên gói
    gradient: "from-teal-500 to-cyan-600",
    icon:     <Shield className="w-6 h-6" />,
    desc:     `Ban dang su dung goi ${pkgName}.`,
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "--";
    return new Date(dateStr).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const fmtVal = (val, suffix = "") =>
    val === null ? "..." : `${val}${suffix}`;

  const stats = [
    {
      label: "Giao an da tao",
      value: fmtVal(statsData.lessonPlanCount),
      icon: BookOpen,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Hoc sinh quan ly",
      value: fmtVal(statsData.studentGroupCount, " nhom"),
      icon: Users,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      label: "Thoi gian AI ho tro",
      value: fmtVal(statsData.aiQuestionsCount, "h"),
      icon: Clock,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Diem hieu suat",
      value: fmtVal(statsData.performanceScore, "%"),
      icon: TrendingUp,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
  ];

  const timeAgo = (dateStr) => {
    if (!dateStr) return "";
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${mins} phut truoc`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} gio truoc`;
    const days = Math.floor(hours / 24);
    return `${days} ngay truoc`;
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Chao buoi sang";
    if (hour < 18) return "Chao buoi chieu";
    return "Chao buoi toi";
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 animate-in fade-in duration-700">
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 p-8 md:p-12 mb-10 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 bg-blue-500/20 rounded-full blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-80 h-80 bg-purple-500/10 rounded-full blur-[100px]"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-4 py-1.5 bg-blue-500/20 backdrop-blur-md border border-blue-400/30 rounded-full text-blue-300 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" /> AI Powered Platform
            </span>
            {!loadingPlan && hasActivePlan && (
              <span className="px-4 py-1.5 bg-amber-400/20 border border-amber-400/40 rounded-full text-amber-300 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <Zap className="w-3.5 h-3.5" /> {pkgName}
              </span>
            )}
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-4 tracking-tight">
            {getGreeting()},{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
              {user?.fullName || "Giao vien"}
            </span>!
          </h1>
          <p className="text-slate-300 text-lg md:text-xl max-w-2xl font-medium leading-relaxed">
            Ban co <span className="text-emerald-400 font-bold">2 cuoc hop</span> va{" "}
            <span className="text-blue-400 font-bold">3 lop hoc</span> sap toi.
          </p>
          <div className="flex flex-wrap gap-4 mt-8">
            <button className="px-6 py-3 bg-white text-slate-900 font-bold rounded-2xl hover:bg-slate-100 transition-all flex items-center gap-2 shadow-lg active:scale-95">
              <Zap className="w-5 h-5 text-blue-600" /> Soan bai nhanh voi AI
            </button>
            <button className="px-6 py-3 bg-white/10 backdrop-blur-md border border-white/20 text-white font-bold rounded-2xl hover:bg-white/20 transition-all flex items-center gap-2 active:scale-95">
              <Calendar className="w-5 h-5" /> Xem lich giang day
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {stats.map((item, idx) => (
          <div key={idx} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 group">
            <div className="flex justify-between items-start mb-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${item.bg} ${item.color} transition-transform duration-500 group-hover:scale-110`}>
                <item.icon className="w-6 h-6" />
              </div>
            </div>
            <p className="text-slate-500 text-sm font-semibold uppercase tracking-wider">{item.label}</p>
            {loadingStats ? (
              <div className="h-9 w-20 bg-slate-100 rounded-xl animate-pulse mt-1" />
            ) : (
              <h3 className="text-3xl font-black text-slate-900 mt-1">{item.value}</h3>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-xl shadow-slate-200/30">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Target className="w-6 h-6 text-blue-600" /> Hoat dong gan day
              </h3>
              <button className="text-sm font-bold text-blue-600 hover:underline">Xem tat ca</button>
            </div>
            <div className="space-y-2">
              {loadingRecent ? (
                [1, 2, 3].map(i => (
                  <div key={i} className="flex gap-4 p-4">
                    <div className="w-12 h-12 bg-slate-100 rounded-xl animate-pulse flex-shrink-0" />
                    <div className="flex-1 space-y-2 py-1">
                      <div className="h-4 bg-slate-100 rounded animate-pulse w-3/4" />
                      <div className="h-3 bg-slate-100 rounded animate-pulse w-1/2" />
                    </div>
                  </div>
                ))
              ) : recentPlans.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  Chua co hoat dong nao. Hay tao giao an dau tien!
                </div>
              ) : (
                recentPlans.map((plan, idx) => (
                  <div
                    key={plan.id}
                    className="flex gap-4 group cursor-pointer p-4 hover:bg-slate-50 rounded-2xl transition-all"
                    onClick={() => navigate(`/lesson-plans/${plan.id}`)}
                  >
                    <div className="w-12 h-12 bg-slate-100 rounded-xl flex-shrink-0 flex items-center justify-center font-bold text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors text-sm">
                      {String(idx + 1).padStart(2, '0')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-slate-800 group-hover:text-blue-700 transition-colors truncate">
                        {plan.title || "Giao an khong tieu de"}
                      </h4>
                      <p className="text-sm text-slate-500 mt-1 font-medium">
                        {plan.aiGenerated ? "Ho tro boi AI" : "Tu soan"}
                        {plan.subject ? ` · ${plan.subject}` : ""}
                        {plan.gradeLevel ? ` Lop ${plan.gradeLevel}` : ""}
                        {" · "}{timeAgo(plan.updatedAt)}
                      </p>
                    </div>
                    <span className={`self-start mt-1 px-2 py-0.5 text-[10px] font-bold rounded-full flex-shrink-0 ${
                      plan.status === "PUBLISHED"
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}>
                      {plan.status === "PUBLISHED" ? "Published" : "Draft"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-xl shadow-slate-200/30">
            <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Zap className="w-6 h-6 text-amber-500" /> Cong cu nhanh
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Soan giao an AI", icon: FileText, color: "text-blue-600",   bg: "bg-blue-50",   hover: "hover:bg-blue-100",   path: "/lesson-plans/ai-generator" },
                { label: "Sinh de thi",     icon: Brain,    color: "text-purple-600", bg: "bg-purple-50", hover: "hover:bg-purple-100", path: "/exam-generator" },
                { label: "Cham bai OCR",    icon: ScanLine, color: "text-emerald-600",bg: "bg-emerald-50",hover: "hover:bg-emerald-100",path: "/ocr-grading" },
                { label: "Xem thong ke",    icon: BarChart2,color: "text-amber-600",  bg: "bg-amber-50",  hover: "hover:bg-amber-100",  path: "/analytics" },
              ].map((tool, idx) => (
                <button
                  key={idx}
                  onClick={() => navigate(tool.path)}
                  className={`flex items-center gap-3 p-5 rounded-2xl ${tool.bg} ${tool.hover} border border-transparent hover:border-slate-200 transition-all group`}
                >
                  <div className={`w-10 h-10 rounded-xl ${tool.bg} ${tool.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    <tool.icon className="w-5 h-5" />
                  </div>
                  <span className={`font-semibold text-sm ${tool.color}`}>{tool.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {loadingPlan ? (
            <div className="bg-slate-100 rounded-[2.5rem] p-8 animate-pulse h-52" />
          ) : hasActivePlan ? (
          <div className={`bg-gradient-to-br ${pkgPreset.gradient} rounded-[2.5rem] p-8 text-white shadow-xl`}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                  {pkgPreset.icon}
                </div>
                <div>
                  <p className="text-white/70 text-xs font-bold uppercase tracking-widest">Goi hien tai</p>
                  <p className="text-2xl font-black">{pkgName}</p>
                </div>
              </div>
              <p className="text-white/80 text-sm mb-5 leading-relaxed">
                {pkgPreset.desc}
              </p>
              {activeOrder?.expiresAt && (
                <div className="flex items-center gap-2 bg-white/15 rounded-xl px-4 py-2.5 text-sm mb-5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Het han: <strong>{formatDate(activeOrder.expiresAt)}</strong></span>
                </div>
              )}
              <button
                onClick={() => navigate("/packages")}
                className="w-full py-3 bg-white/20 hover:bg-white/30 text-white font-bold rounded-2xl transition-all active:scale-95 text-sm border border-white/30"
              >
                Xem chi tiet goi
              </button>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[2.5rem] p-8 text-white shadow-xl shadow-indigo-500/20">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Zap className="w-6 h-6 fill-amber-400 text-amber-400" /> Nang cap PRO
              </h3>
              <p className="text-indigo-100 text-sm mb-6 leading-relaxed opacity-90">
                Trai nghiem toan bo suc manh cua AI voi bo cong cu soan giao an va cham diem tu dong khong gioi han.
              </p>
              <button
                onClick={() => navigate("/packages")}
                className="w-full py-3.5 bg-white text-indigo-600 font-bold rounded-2xl shadow-lg hover:shadow-white/20 transition-all active:scale-95"
              >
                Xem bang gia ngay
              </button>
            </div>
          )}

          <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-xl shadow-slate-200/30">
            <h3 className="text-lg font-bold text-slate-900 mb-6">Thong tin tai khoan</h3>
            <div className="space-y-4">
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-sm text-slate-500 font-medium">Vai tro</span>
                <span className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg">
                  {user?.roleName || (typeof user?.role === "object" ? user?.role?.name : user?.role) || "-"}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-sm text-slate-500 font-medium">Goi dich vu</span>
                {loadingPlan ? (
                  <span className="h-5 w-16 bg-slate-100 rounded animate-pulse inline-block" />
                ) : (
                  <span className={`text-sm font-bold px-3 py-1 rounded-lg ${
                    pkgName === "PREMIUM" ? "bg-purple-100 text-purple-700" :
                    pkgName === "PRO"     ? "bg-blue-100 text-blue-700" :
                    "bg-slate-100 text-slate-600"
                  }`}>
                    {hasActivePlan ? pkgName : "FREE"}
                  </span>
                )}
              </div>
              {hasActivePlan && activeOrder?.expiresAt && (
                <div className="flex justify-between py-2 border-b border-slate-50">
                  <span className="text-sm text-slate-500 font-medium">Het han</span>
                  <span className="text-sm font-bold text-slate-700">{formatDate(activeOrder.expiresAt)}</span>
                </div>
              )}
              <div className="flex justify-between py-2">
                <span className="text-sm text-slate-500 font-medium">Trang thai</span>
                <span className="text-sm font-bold text-emerald-500">Dang hoat dong</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
