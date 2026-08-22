import { Navigate, Route, Routes } from 'react-router-dom'
import LoginPage from '@/pages/LoginPage'
import LoginLinkPage from '@/pages/LoginLinkPage'
import GroupsListPage from '@/pages/admin/GroupsListPage'
import CreateGroupPage from '@/pages/admin/CreateGroupPage'
import GroupDashboardPage from '@/pages/admin/GroupDashboardPage'
import OfflineBanner from '@/components/OfflineBanner'
import { useAuth } from '@/lib/useAuth'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex min-h-dvh items-center justify-center text-faint">…</div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin } = useAuth()
  if (loading) return <div className="flex min-h-dvh items-center justify-center text-faint">…</div>
  if (!user) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/groups" replace />
  return <>{children}</>
}

import { ViewModeProvider } from '@/lib/useViewMode'
import BottomNav from '@/components/BottomNav'

export default function App() {
  return (
    <ViewModeProvider>
      <OfflineBanner />
      <BottomNav />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/login/link/:id" element={<LoginLinkPage />} />
        <Route
          path="/groups"
          element={
            <RequireAuth>
              <GroupsListPage />
            </RequireAuth>
          }
        />
        <Route
          path="/groups/new"
          element={
            <RequireAdmin>
              <CreateGroupPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/groups/:groupId"
          element={
            <RequireAuth>
              <GroupDashboardPage />
            </RequireAuth>
          }
        />
        <Route path="/" element={<Navigate to="/groups" replace />} />
        <Route path="*" element={<Navigate to="/groups" replace />} />
      </Routes>
    </ViewModeProvider>
  )
}
