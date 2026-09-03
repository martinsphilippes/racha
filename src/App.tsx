import { lazy, Suspense } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import { AuthProvider, useAuth } from '@/hooks/useAuth'
import { GroupProvider, useGroup } from '@/hooks/useGroupContext'
import { ToastProvider } from '@/components/Toast'
import { firebaseConfigured } from '@/lib/firebase'
import AppShell from '@/components/AppShell'
import { Spinner } from '@/components/ui'
import Login from '@/pages/Login'
import Signup from '@/pages/Signup'
import Home from '@/pages/Home'
import MatchPage from '@/pages/MatchPage'
const History = lazy(() => import('@/pages/History'))
const Profile = lazy(() => import('@/pages/Profile'))
const NewGroup = lazy(() => import('@/pages/NewGroup'))
const Admin = lazy(() => import('@/pages/Admin'))
const Dashboard = lazy(() => import('@/pages/manage/Dashboard'))
const GroupSettings = lazy(() => import('@/pages/manage/GroupSettings'))
const Venues = lazy(() => import('@/pages/manage/Venues'))
const SchedulePage = lazy(() => import('@/pages/manage/Schedule'))
const Members = lazy(() => import('@/pages/manage/Members'))
const Announcements = lazy(() => import('@/pages/manage/Announcements'))
const NewMatch = lazy(() => import('@/pages/manage/NewMatch'))
const ManageMatch = lazy(() => import('@/pages/manage/ManageMatch'))

function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Spinner label="Abrindo…" />
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  return <Outlet />
}

function RedirectIfAuth() {
  const { user, loading } = useAuth()
  if (loading) return <Spinner label="Abrindo…" />
  if (user) return <Navigate to="/" replace />
  return <Outlet />
}

function RequireManager() {
  const { isManager, membershipsSynced, groupLoading } = useGroup()
  if (isManager) return <Outlet />
  // Só redireciona depois que o servidor confirmou a lista de grupos (o cache pode estar incompleto).
  if (!membershipsSynced || groupLoading) return <Spinner />
  return <Navigate to="/" replace />
}

function RequireOwner() {
  const { isOwner, roleReady } = useAuth()
  if (!roleReady) return <Spinner />
  if (!isOwner) return <Navigate to="/" replace />
  return <Outlet />
}

function RequireGroup() {
  const { memberships, membershipsSynced } = useGroup()
  if (memberships.length > 0) return <Outlet />
  if (!membershipsSynced) return <Spinner />
  return <Navigate to="/" replace />
}

function NotConfigured() {
  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-bold">Firebase não configurado</h1>
      <p className="mt-2 text-sm text-slate-200">Copie <code>.env.example</code> para <code>.env</code> e preencha as variáveis <code>VITE_FIREBASE_*</code> com os dados do seu projeto Firebase (ou defina <code>VITE_USE_EMULATORS=true</code> para desenvolvimento local).</p>
    </div>
  )
}

export default function App() {
  if (!firebaseConfigured) return <NotConfigured />
  return (
    <ToastProvider>
      <AuthProvider>
        <GroupProvider>
          <Suspense fallback={<Spinner />}>
          <Routes>
            <Route element={<RedirectIfAuth />}>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
            </Route>
            <Route element={<RequireAuth />}>
              <Route element={<AppShell />}>
                <Route index element={<Home />} />
                <Route path="/groups/new" element={<NewGroup />} />
                <Route element={<RequireOwner />}>
                  <Route path="/admin" element={<Admin />} />
                </Route>
                <Route path="/profile" element={<Profile />} />
                <Route element={<RequireGroup />}>
                  <Route path="/match/:id" element={<MatchPage />} />
                  <Route path="/history" element={<History />} />
                  <Route element={<RequireManager />}>
                    <Route path="/manage" element={<Dashboard />} />
                    <Route path="/manage/group" element={<GroupSettings />} />
                    <Route path="/manage/venues" element={<Venues />} />
                    <Route path="/manage/schedule" element={<SchedulePage />} />
                    <Route path="/manage/members" element={<Members />} />
                    <Route path="/manage/announcements" element={<Announcements />} />
                    <Route path="/manage/match/new" element={<NewMatch />} />
                    <Route path="/manage/match/:id" element={<ManageMatch />} />
                  </Route>
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </GroupProvider>
      </AuthProvider>
    </ToastProvider>
  )
}
