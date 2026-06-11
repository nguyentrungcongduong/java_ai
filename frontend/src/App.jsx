import React from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import MainLayout from './components/layout/MainLayout'
import ProtectedRoute from './components/ProtectedRoute'
import RoleGuard from './components/guards/RoleGuard'

import Login from './pages/LoginPage'
import Register from './pages/RegisterPage'
import UnauthorizedPage from './pages/UnauthorizedPage'
import DashboardPage from './pages/DashboardPage'

import ManagerSubscriptionsPage from './pages/manager/ManagerSubscriptionsPage'
import ManagerOrdersPage from './pages/manager/ManagerOrdersPage'
import ManagerQuestionApprovalPage from './pages/manager/ManagerQuestionApprovalPage'
import TeacherPackagesPage from './pages/teacher/TeacherPackagesPage'
import TeacherOrderHistoryPage from './pages/teacher/TeacherOrderHistoryPage'
import AdminFrameworksPage from './pages/admin/FrameworksPage'
import FrameworkForm from './pages/admin/FrameworkForm'
import UsersPage from './pages/users/UsersPage'
import UserFormPage from './pages/users/UserFormPage'
import TeacherManagementPage from './pages/manager/TeacherManagementPage'
import SettingsPage from './pages/settings/SettingsPage'
import PromptTemplatesPage from './pages/staff/PromptTemplatesPage'
import PromptTemplateForm from './pages/staff/PromptTemplateForm'
import GenerateLessonPlan from './pages/teacher/GenerateLessonPlan'
import ExamGenerator from './pages/teacher/ExamGenerator'
import ExamListPage from './pages/teacher/ExamListPage'
import LessonPlanGenerator from './pages/teacher/LessonPlanGenerator'
import QuestionBankPage from './features/question-bank/QuestionBankPage'
import BankQuestionsPage from './features/question-bank/BankQuestionsPage'
import LessonPlansPage from './features/lesson-plans/LessonPlansPage'
import LessonPlanFormPage from './features/lesson-plans/LessonPlanFormPage'
import LessonPlanDetailPage from './features/lesson-plans/LessonPlanDetailPage'
import AnswerSheetsPage from './features/answer-sheets/AnswerSheetsPage'
import TeacherAnalyticsDashboard from './pages/teacher/TeacherAnalyticsDashboard'
import ManagerRevenueDashboard from './pages/manager/ManagerRevenueDashboard'
import AdminUserGrowthDashboard from './pages/admin/AdminUserGrowthDashboard'
import GradingResultsList from './pages/teacher/GradingResultsList'
import GradingResultDetail from './pages/teacher/GradingResultDetail'
import SystemConfigPage from './pages/admin/SystemConfigPage'
import PaymentResultPage from './pages/payment/PaymentResultPage'
import { Toaster } from 'sonner'

const NotFound = () => (
  <div className="flex h-screen flex-col items-center justify-center">
    <h1 className="text-4xl font-bold">404 - Not Found</h1>
    <p className="mt-2 text-muted-foreground">Trang ban tim kiem khong ton tai.</p>
  </div>
)

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, info: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, info) {
    console.error('🔴 ErrorBoundary caught:', error.message)
    console.error('📍 Component stack:', info.componentStack)
    this.setState({ info })
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, fontFamily: 'monospace', background: '#fee', border: '2px solid red', margin: 16, borderRadius: 8 }}>
          <h2 style={{ color: 'red' }}>⚠️ React Render Error</h2>
          <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{String(this.state.error)}</pre>
          <details style={{ marginTop: 8 }}>
            <summary>Component Stack</summary>
            <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap' }}>{this.state.info?.componentStack}</pre>
          </details>
          <button onClick={() => this.setState({ hasError: false, error: null, info: null })} style={{ marginTop: 8, padding: '4px 12px', cursor: 'pointer' }}>Retry</button>
        </div>
      )
    }
    return this.props.children
  }
}

function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route path="/payment/result" element={<PaymentResultPage />} />

        <Route
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/settings" element={<SettingsPage />} />

          <Route
            path="/admin/users"
            element={
              <RoleGuard roles={['ADMIN']}>
                <UsersPage />
              </RoleGuard>
            }
          />
          <Route
            path="/admin/users/new"
            element={
              <RoleGuard roles={['ADMIN']}>
                <UserFormPage />
              </RoleGuard>
            }
          />
          <Route
            path="/admin/users/:id/edit"
            element={
              <RoleGuard roles={['ADMIN']}>
                <UserFormPage />
              </RoleGuard>
            }
          />

          {/* ADMIN - Frameworks */}
          <Route
            path="/admin/frameworks"
            element={
              <RoleGuard roles={['ADMIN']}>
                <AdminFrameworksPage />
              </RoleGuard>
            }
          />
          <Route
            path="/admin/frameworks/new"
            element={
              <RoleGuard roles={['ADMIN']}>
                <FrameworkForm />
              </RoleGuard>
            }
          />
          <Route
            path="/admin/frameworks/:id/edit"
            element={
              <RoleGuard roles={['ADMIN']}>
                <FrameworkForm />
              </RoleGuard>
            }
          />

          {/* MANAGER routes */}
          <Route
            path="/manager/teachers"
            element={
              <RoleGuard roles={['MANAGER', 'ADMIN']}>
                <TeacherManagementPage />
              </RoleGuard>
            }
          />
          <Route
            path="/manager/subscriptions"
            element={
              <RoleGuard roles={['MANAGER', 'ADMIN']}>
                <ManagerSubscriptionsPage />
              </RoleGuard>
            }
          />
          <Route
            path="/manager/orders"
            element={
              <RoleGuard roles={['MANAGER', 'ADMIN']}>
                <ManagerOrdersPage />
              </RoleGuard>
            }
          />
          <Route
            path="/manager/questions/approval"
            element={
              <RoleGuard roles={['MANAGER', 'ADMIN']}>
                <ManagerQuestionApprovalPage />
              </RoleGuard>
            }
          />
          <Route
            path="/manager/approve"
            element={
              <RoleGuard roles={['MANAGER', 'ADMIN']}>
                <PromptTemplatesPage />
              </RoleGuard>
            }
          />
          <Route
            path="/manager/analytics"
            element={
              <RoleGuard roles={['MANAGER', 'ADMIN']}>
                <ManagerRevenueDashboard />
              </RoleGuard>
            }
          />
          <Route
            path="/admin/analytics/users"
            element={
              <RoleGuard roles={['ADMIN']}>
                <AdminUserGrowthDashboard />
              </RoleGuard>
            }
          />
          <Route
            path="/admin/system-config"
            element={
              <RoleGuard roles={['ADMIN']}>
                <SystemConfigPage />
              </RoleGuard>
            }
          />

          <Route
            path="/prompt-templates"
            element={
              <RoleGuard roles={['STAFF', 'MANAGER', 'ADMIN']}>
                <PromptTemplatesPage />
              </RoleGuard>
            }
          />
          <Route
            path="/prompt-templates/new"
            element={
              <RoleGuard roles={['STAFF']}>
                <PromptTemplateForm />
              </RoleGuard>
            }
          />
          <Route
            path="/prompt-templates/:id/edit"
            element={
              <RoleGuard roles={['STAFF']}>
                <PromptTemplateForm />
              </RoleGuard>
            }
          />

          <Route
            path="/lesson-plans"
            element={
              <RoleGuard roles={['TEACHER', 'STAFF']}>
                <LessonPlansPage />
              </RoleGuard>
            }
          />
          <Route
            path="/generate-lesson-plan/:id"
            element={
              <RoleGuard roles={['TEACHER', 'STAFF', 'MANAGER']}>
                <GenerateLessonPlan />
              </RoleGuard>
            }
          />
          <Route
            path="/lesson-plans/new"
            element={
              <RoleGuard roles={['TEACHER']}>
                <LessonPlanFormPage />
              </RoleGuard>
            }
          />
          <Route
            path="/lesson-plans/:id"
            element={
              <RoleGuard roles={['TEACHER']}>
                <LessonPlanDetailPage />
              </RoleGuard>
            }
          />
          <Route
            path="/lesson-plans/:id/edit"
            element={
              <RoleGuard roles={['TEACHER']}>
                <LessonPlanFormPage />
              </RoleGuard>
            }
          />
          <Route
            path="/lesson-plans/ai-generator"
            element={
              <RoleGuard roles={['TEACHER', 'STAFF']}>
                <LessonPlanGenerator />
              </RoleGuard>
            }
          />
          <Route
            path="/packages"
            element={
              <RoleGuard roles={['TEACHER']}>
                <TeacherPackagesPage />
              </RoleGuard>
            }
          />
          <Route
            path="/orders/history"
            element={
              <RoleGuard roles={['TEACHER']}>
                <TeacherOrderHistoryPage />
              </RoleGuard>
            }
          />
          <Route
            path="/exams"
            element={
              <RoleGuard roles={['TEACHER']}>
                <ExamListPage />
              </RoleGuard>
            }
          />
          <Route
            path="/exam-generator"
            element={
              <RoleGuard roles={['TEACHER']}>
                <ExamGenerator />
              </RoleGuard>
            }
          />
          <Route
            path="/analytics"
            element={
              <RoleGuard roles={['TEACHER']}>
                <TeacherAnalyticsDashboard />
              </RoleGuard>
            }
          />
          <Route
            path="/grading"
            element={
              <RoleGuard roles={['TEACHER']}>
                <GradingResultsList />
              </RoleGuard>
            }
          />
          <Route
            path="/grading/:id"
            element={
              <RoleGuard roles={['TEACHER']}>
                <GradingResultDetail />
              </RoleGuard>
            }
          />
          <Route
            path="/ocr-grading"
            element={
              <RoleGuard roles={['TEACHER']}>
                <AnswerSheetsPage />
              </RoleGuard>
            }
          />

          <Route
            path="/question-bank"
            element={
              <RoleGuard roles={['TEACHER', 'STAFF', 'MANAGER', 'ADMIN']}>
                <QuestionBankPage />
              </RoleGuard>
            }
          />
          <Route
            path="/question-bank/:bankId"
            element={
              <RoleGuard roles={['TEACHER', 'STAFF', 'MANAGER', 'ADMIN']}>
                <BankQuestionsPage />
              </RoleGuard>
            }
          />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster position="top-right" richColors closeButton />
    </ErrorBoundary>
  )
}

export default App
