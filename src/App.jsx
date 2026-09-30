import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/layout/ProtectedRoute'
import Login from './pages/auth/Login'
import Roles from './pages/auth/Roles'
import Registro from './pages/auth/Registro'
import MisPedidos from './pages/productor/MisPedidos'
import CrearPedido from './pages/productor/CrearPedido'
import DetallePedido from './pages/productor/DetallePedido'
import Historial from './pages/productor/Historial'
import Perfil from './pages/productor/Perfil'
import Disponibles from './pages/transportista/Disponibles'
import DetalleDisponible from './pages/transportista/DetalleDisponible'
import MisPedidosTransp from './pages/transportista/MisPedidos'
import DetallePedidoTransp from './pages/transportista/DetallePedido'
import PedidoDirecto from './pages/transportista/PedidoDirecto'
import PerfilPublico from './pages/PerfilPublico'
import AdminLogin from './pages/admin/Login'
import AdminDashboard from './pages/admin/Dashboard'
import AdminUsuarios from './pages/admin/Usuarios'
import AdminPedidos from './pages/admin/Pedidos'
import AdminCalificaciones from './pages/admin/Calificaciones'
import AdminReportes from './pages/admin/Reportes'
import AdminRoute from './components/layout/AdminRoute'
import HistorialTransp from './pages/transportista/Historial'
import PerfilTransp from './pages/transportista/Perfil'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
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
          <Route path="/perfil/:rol/:id" element={<ProtectedRoute><PerfilPublico /></ProtectedRoute>} />
          <Route path="/transportista/pedido-directo/:id" element={<ProtectedRoute rolRequerido="transportista"><PedidoDirecto /></ProtectedRoute>} />
          <Route path="/transportista/pedido/:id" element={<ProtectedRoute rolRequerido="transportista"><DetallePedidoTransp /></ProtectedRoute>} />
          <Route path="/transportista/historial" element={<ProtectedRoute rolRequerido="transportista"><HistorialTransp /></ProtectedRoute>} />
          <Route path="/transportista/perfil" element={<ProtectedRoute rolRequerido="transportista"><PerfilTransp /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        {/* Admin */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          <Route path="/admin/usuarios" element={<AdminRoute><AdminUsuarios /></AdminRoute>} />
          <Route path="/admin/pedidos" element={<AdminRoute><AdminPedidos /></AdminRoute>} />
          <Route path="/admin/calificaciones" element={<AdminRoute><AdminCalificaciones /></AdminRoute>} />
          <Route path="/admin/reportes" element={<AdminRoute><AdminReportes /></AdminRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
