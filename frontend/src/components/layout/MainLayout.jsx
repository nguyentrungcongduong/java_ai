import React from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
  AlignLeft,
  BarChart3,
  BookCopy,
  BookOpen,
  Bot,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  Settings2,
  Shield,
  Users,
  Loader2,
} from 'lucide-react'

import { logout } from '../../features/auth/authSlice'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar'

const NAV_GROUPS = [
  {
    label: 'Tổng quan',
    roles: [],            // visible to ALL
    items: [
      { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Công cụ giảng dạy',
    roles: ['TEACHER', 'STAFF'],
    items: [
      { title: 'Giáo án của tôi',  href: '/lesson-plans',              icon: BookOpen,      roles: ['TEACHER', 'STAFF'] },
      { title: 'Soạn giáo án AI', href: '/lesson-plans/ai-generator',  icon: Bot,           roles: ['TEACHER', 'STAFF'] },
      { title: 'Ngân hàng câu hỏi', href: '/question-bank',           icon: BookCopy,      roles: ['TEACHER'] },

      { title: 'Đề thi của tôi',   href: '/exams',                     icon: ClipboardList, roles: ['TEACHER'] },
      { title: 'Tạo đề thi',      href: '/exam-generator',            icon: FileText,      roles: ['TEACHER'] },
      { title: 'OCR Chấm bài',    href: '/ocr-grading',               icon: Bot,           roles: ['TEACHER'] },
      { title: 'Thống kê',        href: '/analytics',                 icon: BarChart3,     roles: ['TEACHER'] },
    ],
  },
  {
    label: 'Tài khoản & Dịch vụ',
    roles: ['TEACHER'],
    items: [
      { title: 'Gói dịch vụ',     href: '/packages',                  icon: Package,   roles: ['TEACHER'] },
      { title: 'Lịch sử đơn hàng', href: '/orders/history',           icon: BarChart3, roles: ['TEACHER'] },
    ],
  },
  {
    label: 'Quản lý nội dung',
    roles: ['STAFF', 'MANAGER', 'ADMIN'],
    items: [
      { title: 'Ngân hàng câu hỏi', href: '/question-bank',            icon: BookCopy,  roles: ['STAFF', 'MANAGER', 'ADMIN'] },
      { title: 'Prompt Templates', href: '/prompt-templates',          icon: Settings2, roles: ['STAFF', 'MANAGER', 'ADMIN'] },
      { title: 'Duyệt câu hỏi',   href: '/manager/approve',           icon: Shield,    roles: ['MANAGER', 'ADMIN'] },
    ],
  },
  {
    label: 'Quản lý hệ thống',
    roles: ['MANAGER', 'ADMIN'],
    items: [
      { title: 'Quản lý giáo viên', href: '/manager/teachers',         icon: Users,     roles: ['MANAGER', 'ADMIN'] },
      { title: 'Gói đăng ký',      href: '/manager/subscriptions',    icon: Package,   roles: ['MANAGER', 'ADMIN'] },
      { title: 'Đơn hàng',         href: '/manager/orders',           icon: BookCopy,  roles: ['MANAGER', 'ADMIN'] },
      { title: 'Doanh thu',        href: '/manager/analytics',        icon: BarChart3, roles: ['MANAGER', 'ADMIN'] },
    ],
  },
  {
    label: 'Quản trị',
    roles: ['ADMIN'],
    items: [
      { title: 'Người dùng',       href: '/admin/users',               icon: Users,     roles: ['ADMIN'] },
      { title: 'Khung chương trình', href: '/admin/frameworks',        icon: BookOpen,  roles: ['ADMIN'] },
      { title: 'Thống kê người dùng', href: '/admin/analytics/users', icon: BarChart3, roles: ['ADMIN'] },
      { title: 'Cấu hình hệ thống', href: '/admin/system-config',     icon: Settings2, roles: ['ADMIN'] },
    ],
  },
]

const ROLE_LABELS = {
  ADMIN: { label: 'Admin', color: 'bg-red-100 text-red-700' },
  MANAGER: { label: 'Manager', color: 'bg-purple-100 text-purple-700' },
  STAFF: { label: 'Staff', color: 'bg-blue-100 text-blue-700' },
  TEACHER: { label: 'Teacher', color: 'bg-green-100 text-green-700' },
}

function useBreadcrumb(pathname) {
  if (pathname.startsWith('/question-bank')) return 'Question Bank'
  if (pathname === '/lesson-plans/ai-generator') return 'Tạo giáo án với AI'
  if (pathname === '/lesson-plans/new') return 'Tạo giáo án'
  if (/^\/lesson-plans\/\d+\/edit$/.test(pathname)) return 'Chỉnh sửa giáo án'
  if (/^\/lesson-plans\/\d+$/.test(pathname)) return 'Chi tiết giáo án'
  if (pathname.startsWith('/lesson-plans')) return 'Lesson Plans'
  const map = {
    '/dashboard': 'Dashboard',
    '/packages': 'Packages',
    '/orders/history': 'Orders',
    '/question-bank': 'Question Bank',
    '/exams': 'Đề thi của tôi',
    '/exam-generator': 'Tạo đề thi bằng AI',
    '/ocr-grading': 'OCR Grading',
    '/analytics': 'Thống kê học sinh',
    '/prompt-templates': 'Prompt Templates',
    '/manager/teachers': 'Manage Teachers',
    '/manager/subscriptions': 'Manager Packages',
    '/manager/orders': 'Orders',
    '/manager/analytics': 'Analytics',
    '/manager/approve': 'Approve Templates',
    '/admin/users': 'User Management',
  }
  return map[pathname] || 'Dashboard'
}

function AppSidebar() {
  const location = useLocation()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const user = useSelector((state) => state.auth?.user)
  const rawRole = user?.roleName || (typeof user?.role === 'object' ? user?.role?.name : user?.role);
  const role = rawRole?.toUpperCase() || '';

  const isActive = (href) => {
    if (href === '/dashboard') return location.pathname === '/dashboard'
    return location.pathname.startsWith(href)
  }

  const initials = user?.fullName
    ? user.fullName.trim().split(/\s+/).map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'AD'

  const handleLogout = () => {
    dispatch(logout())
    navigate('/login')
  }

  const currentRoleKey = role
  const roleInfo = ROLE_LABELS[currentRoleKey] || { label: role || 'User', color: 'bg-slate-100 text-slate-600' }

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="h-16 flex-row items-center gap-3 px-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow">
          <AlignLeft className="size-5" />
        </div>
        <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
          <span className="truncate text-base font-bold text-sidebar-foreground">PlanbookAI</span>
          <span className="truncate text-xs text-sidebar-accent-foreground">LMS Platform</span>
        </div>
      </SidebarHeader>

      <Separator className="bg-sidebar-border" />

      <SidebarContent className="py-2 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {NAV_GROUPS.map((group, idx) => {
          // Filter items visible for current role
          const visibleItems = group.items.filter(item => {
            if (!item.roles || item.roles.length === 0) return true
            return role && item.roles.map(r => r.toUpperCase()).includes(role)
          })
          // Hide entire group if no items visible
          if (visibleItems.length === 0) return null
          // Hide group header if roles don't match group-level check
          if (group.roles.length > 0 && !group.roles.map(r => r.toUpperCase()).includes(role)) return null

          return (
            <React.Fragment key={group.label}>
              {idx > 0 && (
                <div className="mx-3 my-1 h-px bg-sidebar-border/50 group-data-[collapsible=icon]:mx-2" />
              )}
              <SidebarGroup className="py-0.5">
                <SidebarMenu>
                  {visibleItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={isActive(item.href)}
                        tooltip={item.title}
                        onClick={() => navigate(item.href)}
                        className="cursor-pointer transition-colors duration-150"
                      >
                        <item.icon className="size-4 shrink-0" />
                        <span className="truncate">{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroup>
            </React.Fragment>
          )
        })}
      </SidebarContent>

      <Separator className="bg-sidebar-border" />
      <SidebarFooter className="py-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex w-full items-center gap-3 rounded-lg px-3 py-2">
              <Avatar className="size-8 rounded-lg shrink-0">
                <AvatarImage src={user?.avatarUrl} alt={user?.fullName} />
                <AvatarFallback className="rounded-lg bg-sidebar-primary text-sidebar-primary-foreground text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden min-w-0">
                <span className="truncate font-semibold text-sidebar-foreground">
                  {user?.fullName || 'Admin'}
                </span>
                <span className="truncate text-[11px] text-sidebar-accent-foreground">
                  {user?.email || 'admin@planbookai.com'}
                </span>
                {role && (
                  <span className={`mt-1 inline-flex w-fit rounded px-1.5 py-0.5 text-[10px] font-semibold ${roleInfo.color}`}>
                    {roleInfo.label}
                  </span>
                )}
              </div>
              <button
                onClick={handleLogout}
                className="shrink-0 rounded-md p-1.5 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors group-data-[collapsible=icon]:hidden"
                title="Logout"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}

function TopHeader() {
  const location = useLocation()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const user = useSelector((state) => state.auth?.user)
  const breadcrumb = useBreadcrumb(location.pathname)

  const handleLogout = () => {
    dispatch(logout())
    navigate('/login')
  }

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-card px-4 shadow-sm">
      <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground hover:bg-muted" />
      <Separator orientation="vertical" className="mx-1 h-5" />
      <div className="flex items-center gap-2 text-sm">
        <span className="font-semibold text-foreground">{breadcrumb}</span>
      </div>
      <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
        <span className="hidden md:inline-block">{user?.email || 'admin@planbookai.com'}</span>
        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
        >
          <LogOut className="size-4" />
          Logout
        </button>
      </div>
    </header>
  )
}

function AppFooter() {
  return (
    <footer className="border-t bg-card px-6 py-3">
      <div className="flex flex-col items-center justify-between gap-1 sm:flex-row">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} PlanbookAI. Nền tảng học tập cho giáo viên.
        </p>
        <p className="text-xs text-muted-foreground">Phiên bản 1.0.0</p>
      </div>
    </footer>
  )
}

export default function MainLayout() {
  // Kiểm tra an toàn: nếu state._persist tồn tại thì mới đợi rehydrated, nếu không thì render luôn
  const isRehydrated = useSelector((state) => state._persist?.rehydrated ?? true);

  if (!isRehydrated) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="size-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="flex min-h-screen flex-col bg-background">
          <TopHeader />
          <main className="flex-1 overflow-auto p-6">
            <Outlet />
          </main>
          <AppFooter />
        </SidebarInset>
      </SidebarProvider>
  )
}
