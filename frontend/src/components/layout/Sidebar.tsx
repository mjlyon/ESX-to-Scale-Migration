import { NavLink } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  LayoutDashboard, Plus, List, Server, HardDrive,
  Settings as SettingsIcon, Wrench,
} from 'lucide-react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/migrations/new', icon: Plus, label: 'New Migration' },
  { to: '/migrations', icon: List, label: 'Migrations' },
  { to: '/connections', icon: Server, label: 'Connections' },
  { to: '/storage', icon: HardDrive, label: 'Storage' },
  { to: '/setup', icon: Wrench, label: 'Setup' },
  { to: '/settings', icon: SettingsIcon, label: 'Settings' },
]

export function Sidebar() {
  return (
    <aside className="flex w-56 flex-col bg-gray-900 text-gray-300">
      <div className="flex h-14 items-center px-4">
        <h1 className="text-lg font-bold text-white">ESX to Scale</h1>
      </div>
      <nav className="flex-1 space-y-1 px-2 py-4">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-gray-800 text-white'
                  : 'hover:bg-gray-800 hover:text-white',
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-gray-700 px-4 py-3 text-xs text-gray-500">
        v2.0.0
      </div>
    </aside>
  )
}
