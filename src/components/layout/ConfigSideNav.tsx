import { Link } from '@tanstack/react-router'
import { Settings, Users, Shield, Cloud, Mail, Database, History, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ConfigSideNav() {
  const items = [
    { label: 'Geral', icon: Settings, to: '/configuracoes' },
    { label: 'Usuários', icon: Users, to: '/configuracoes/usuarios' },
    { label: 'Acessos & RBAC', icon: Shield, to: '/configuracoes/acessos' },
    { label: 'OneDrive (Admin)', icon: Cloud, to: '/configuracoes/integracoes/onedrive-admin' },
    { label: 'OneDrive (Usuário)', icon: Cloud, to: '/configuracoes/onedrive' },
    { label: 'E-mail', icon: Mail, to: '/configuracoes/email' },
    { label: 'Backup', icon: Database, to: '/configuracoes/backup' },
    { label: 'LGPD', icon: History, to: '/configuracoes/lgpd' },
  ]

  return (
    <nav className="flex flex-col gap-1 w-full max-w-[240px]">
      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to as any}
          className={({ isActive }) => cn(
            "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
            isActive 
              ? "bg-primary/10 text-primary font-medium" 
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <item.icon className="h-4 w-4" />
          <span className="flex-1">{item.label}</span>
          <ChevronRight className="h-3 w-3 opacity-50" />
        </Link>
      ))}
    </nav>
  )
}
