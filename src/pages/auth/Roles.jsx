import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import InvitacionPendiente from '../../components/InvitacionPendiente'

const PERMISO = { master: 'Master', operador: 'Operador', lectura: 'Solo lectura', chofer: 'Chofer' }

export default function Roles() {
  const { usuario, cuenta, cuentas, cambiarCuenta, setRol, signOut } = useAuth()
  const navigate = useNavigate()
  const [sinLeer, setSinLeer] = useState({})   // empresa → avisos sin leer

  // Avisos sin leer por empresa (solo si tiene más de una)
  useEffect(() => {
    if (!usuario || cuentas.length < 2) return
    supabase.from('notificaciones').select('cuenta_id')
      .eq('usuario_id', usuario.id).eq('leida', false).not('cuenta_id', 'is', null)
      .then(({ data }) => {
        const c = {}
        for (const n of data || []) c[n.cuenta_id] = (c[n.cuenta_id] || 0) + 1
        setSinLeer(c)
      })
  }, [usuario?.id, cuentas.length])

  const pickRol = (rol) => {
    setRol(rol)
    navigate(rol === 'productor' ? '/productor/pedidos' : '/transportista/disponibles')
  }

  // Roles de la empresa activa + admin si corresponde
  // (con varias empresas, solo los de la elegida; con una, como antes)
  const propios = (usuario?.roles || []).filter(r => r === 'admin' || cuentas.length < 2)
  const esChofer = cuenta?.permiso === 'chofer'
  // El chofer solo ve "Mis viajes" (y admin si lo fuera)
  const roles = esChofer ? propios.filter(r => r === 'admin')
    : [...new Set([...(cuenta?.roles || []), ...propios])]
  const nombre = usuario?.nombre || ''

  return (
    <div className="min-h-screen bg-[#F4F6F4] flex flex-col px-5 py-10 lg:max-w-xl lg:mx-auto lg:w-full">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-gray-900">Hola, {nombre}</h1>
        {cuenta?.razon_social && cuentas.length < 2 && <p className="text-xs text-gray-400 mt-0.5">{cuenta.razon_social}</p>}
      </div>

      <InvitacionPendiente />

      {cuentas.length > 1 && (
        <div className="mb-5">
          <p className="text-sm text-gray-500 mb-2">¿Con qué empresa?</p>
          {cuentas.map(c => {
            const activa = c.id === cuenta?.id
            return (
              <button key={c.id} onClick={() => cambiarCuenta(c.id)}
                className={`w-full text-left bg-white border-[1.5px] rounded-[12px] px-3.5 py-2.5 mb-2 flex items-center gap-3 transition-all
                  ${activa ? 'border-verde-600 bg-verde-50' : 'border-gray-200 hover:border-gray-400'}`}>
                <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${activa ? 'border-verde-600 bg-verde-600' : 'border-gray-300'}`} />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-gray-900 truncate">{c.razon_social}</span>
                  <span className="block text-[11px] text-gray-400">CUIT {c.cuit} · {PERMISO[c.permiso] || c.permiso}</span>
                </span>
                {sinLeer[c.id] > 0 && !activa && (
                  <span className="text-[10px] font-bold text-white bg-red-500 rounded-full px-1.5 py-0.5">{sinLeer[c.id]}</span>
                )}
              </button>
            )
          })}
        </div>
      )}

      <p className="text-sm text-gray-500 mb-3">{esChofer ? 'Tus viajes como chofer' : '¿Con qué rol querés operar hoy?'}</p>

      {esChofer && (
        <div
          onClick={() => { setRol('chofer'); navigate('/chofer') }}
          className="bg-white border-[1.5px] border-gray-200 rounded-[14px] p-4 mb-3 cursor-pointer
            hover:border-azul-500 hover:bg-azul-50 transition-all flex items-center gap-3.5"
        >
          <div className="w-12 h-12 bg-azul-50 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">🧑‍✈️</div>
          <div className="flex-1">
            <div className="text-base font-bold text-gray-900">Chofer</div>
            <div className="text-xs text-gray-500 mt-0.5">Tus viajes: cargado, problemas y descarga</div>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </div>
      )}

      {roles.includes('productor') && (
        <div
          onClick={() => pickRol('productor')}
          className="bg-white border-[1.5px] border-gray-200 rounded-[14px] p-4 mb-3 cursor-pointer
            hover:border-verde-600 hover:bg-verde-50 transition-all flex items-center gap-3.5"
        >
          <div className="w-12 h-12 bg-verde-50 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">🌱</div>
          <div className="flex-1">
            <div className="text-base font-bold text-gray-900">Productor</div>
            <div className="text-xs text-gray-500 mt-0.5">Publicá pedidos de transporte y gestioná tus traslados</div>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </div>
      )}

      {roles.includes('transportista') && (
        <div
          onClick={() => pickRol('transportista')}
          className="bg-white border-[1.5px] border-gray-200 rounded-[14px] p-4 mb-3 cursor-pointer
            hover:border-azul-500 hover:bg-azul-50 transition-all flex items-center gap-3.5"
        >
          <div className="w-12 h-12 bg-azul-50 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">🚛</div>
          <div className="flex-1">
            <div className="text-base font-bold text-gray-900">Transportista</div>
            <div className="text-xs text-gray-500 mt-0.5">Explorá pedidos disponibles y gestioná tus viajes</div>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </div>
      )}

      {roles.includes('admin') && (
        <div
          onClick={() => { setRol('admin'); navigate('/admin') }}
          className="bg-white border-[1.5px] border-gray-200 rounded-[14px] p-4 mb-3 cursor-pointer
            hover:border-yellow-500 hover:bg-yellow-50 transition-all flex items-center gap-3.5"
        >
          <div className="w-12 h-12 bg-yellow-50 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">🛡️</div>
          <div className="flex-1">
            <div className="text-base font-bold text-gray-900">Administrador</div>
            <div className="text-xs text-gray-500 mt-0.5">Gestioná usuarios, pedidos y configuración</div>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </div>
      )}

      {cuenta && !esChofer && (
        <div onClick={() => navigate('/equipo')}
          className="bg-white border-[1.5px] border-gray-200 rounded-[14px] p-4 mb-3 cursor-pointer
            hover:border-gray-400 transition-all flex items-center gap-3.5">
          <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">👥</div>
          <div className="flex-1">
            <div className="text-base font-bold text-gray-900">Mi equipo</div>
            <div className="text-xs text-gray-500 mt-0.5">{cuentas.length > 1 ? `Equipo de ${cuenta.razon_social}` : 'Usuarios de tu empresa, pedidos de acceso e invitaciones'}</div>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </div>
      )}

      <div className="mt-auto pt-8 text-center">
        <button onClick={signOut} className="text-xs text-gray-400 hover:text-gray-600">
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
