import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/layout/ProtectedRoute'
import AdminRoute from './components/layout/AdminRoute'

// Auth
const Login      = lazy(() => import('./pages/auth/Login'))
const Roles      = lazy(() => import('./pages/auth/Roles'))
const Registro   = lazy(() => import('./pages/auth/Registro'))

// Productor
const MisPedidos     = lazy(() => import('./pages/productor/MisPedidos'))
const CrearPedido    = lazy(() => import('./pages/productor/CrearPedido'))
const DetallePedido  = lazy(() => import('./pages/productor/DetallePedido'))
const Historial      = lazy(() => import('./pages/productor/Historial'))
const Perfil         = lazy(() => import('./pages/productor/Perfil'))

// Transportista
const Disponibles        = lazy(() => import('./pages/transportista/Disponibles'))
const DetalleDisponible  = lazy(() => import('./pages/transportista/DetalleDisponible'))
const MisPedidosTransp   = lazy(() => import('./pages/transportista/MisPedidos'))
const DetallePedidoTransp= lazy(() => import('./pages/transportista/DetallePedido'))
const PedidoDirecto      = lazy(() => import('./pages/transportista/PedidoDirecto'))
const HistorialTransp    = lazy(() => import('./pages/transportista/Historial'))
const PerfilTransp       = lazy(() => import('./pages/transportista/Perfil'))

// Shared
const PerfilPublico = lazy(() => import('./pages/PerfilPublico'))

// Admin
const AdminLogin          = lazy(() => import('./pages/admin/Login'))
const AdminDashboard      = lazy(() => import('./pages/admin/Dashboard'))
const AdminUsuarios       = lazy(() => import('./pages/admin/Usuarios'))
const AdminPedidos        = lazy(() => import('./pages/admin/Pedidos'))
const AdminCalificaciones = lazy(() => import('./pages/admin/Calificaciones'))
const AdminReportes       = lazy(() => import('./pages/admin/Reportes'))

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-verde-800">
    <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
  </div>
)

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<Spinner />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/registro" element={<Registro />} />
            <Route path="/roles" element={<ProtectedRoute><Roles /></ProtectedRoute>} />
            <Route path="/" element={<Navigate to="/login" replace />} />

            <Route path="/productor/pedidos" element={<ProtectedRoute rolRequerido="productor"><MisPedidos /></ProtectedRoute>} />
            <Route path="/productor/crear" element={<ProtectedRoute rolRequerido="productor"><CrearPedido /></ProtectedRoute>} />
            <Route path="/productor/pedido/:id" element={<ProtectedRoute rolRequerido="productor"><DetallePedido /></ProtectedRoute>} />
            <Route path="/productor/historial" element={<ProtectedRoute rolRequerido="productor"><Historial /></ProtectedRoute>} />
            <Route path="/productor/perfil" element={<ProtectedRoute rolRequerido="productor"><Perfil /></ProtectedRoute>} />

            <Route path="/transportista/disponibles" element={<ProtectedRoute rolRequerido="transportista"><Disponibles /></ProtectedRoute>} />
            <Route path="/transportista/disponible/:id" element={<ProtectedRoute rolRequerido="transportista"><DetalleDisponible /></ProtectedRoute>} />
            <Route path="/transportista/pedidos" element={<ProtectedRoute rolRequerido="transportista"><MisPedidosTransp /></ProtectedRoute>} />
            <Route path="/transportista/pedido-directo/:id" element={<ProtectedRoute rolRequerido="transportista"><PedidoDirecto /></ProtectedRoute>} />
            <Route path="/transportista/pedido/:id" element={<ProtectedRoute rolRequerido="transportista"><DetallePedidoTransp /></ProtectedRoute>} />
            <Route path="/transportista/historial" element={<ProtectedRoute rolRequerido="transportista"><HistorialTransp /></ProtectedRoute>} />
            <Route path="/transportista/perfil" element={<ProtectedRoute rolRequerido="transportista"><PerfilTransp /></ProtectedRoute>} />

            <Route path="/perfil/:rol/:id" element={<ProtectedRoute><PerfilPublico /></ProtectedRoute>} />

            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="/admin/usuarios" element={<AdminRoute><AdminUsuarios /></AdminRoute>} />
            <Route path="/admin/pedidos" element={<AdminRoute><AdminPedidos /></AdminRoute>} />
            <Route path="/admin/calificaciones" element={<AdminRoute><AdminCalificaciones /></AdminRoute>} />
            <Route path="/admin/reportes" element={<AdminRoute><AdminReportes /></AdminRoute>} />

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}
