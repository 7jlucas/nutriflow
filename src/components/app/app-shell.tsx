"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  BookOpen, ChartLine, ChefHat, FileText, LayoutDashboard, ListChecks, LogOut, Menu, PanelLeftClose, PanelLeftOpen,
  Plus, Search, Settings, Sparkles, User, X,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { useQuickLog } from "./quick-log";
import { logoutAction } from "@/app/(auth)/actions";

const NAV = [
  { href: "/dashboard", label: "Painel", icon: LayoutDashboard },
  { href: "/diary", label: "Diário", icon: BookOpen },
  { href: "/foods", label: "Alimentos", icon: Search },
  { href: "/plan", label: "Plano alimentar", icon: ListChecks },
  { href: "/lab", label: "AI Nutrition Lab", icon: Sparkles },
  { href: "/recipes", label: "Receitas", icon: ChefHat },
  { href: "/progress", label: "Progresso", icon: ChartLine },
  { href: "/reports", label: "Relatórios", icon: FileText },
] as const;
const NAV_ACCOUNT = [
  { href: "/profile", label: "Perfil", icon: User },
  { href: "/settings", label: "Configurações", icon: Settings },
] as const;

const isActive = (path: string, href: string) => path === href || path.startsWith(href + "/");

export function AppShell({ children, userName }: { children: React.ReactNode; userName: string }) {
  const path = usePathname();
  const quickLog = useQuickLog();
  const [collapsed, setCollapsed] = useState(false);
  const [menu, setMenu] = useState(false);

  // preferência transitória de interface (não é dado do usuário): localStorage é adequado
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("nf:sidebar") === "1");
    } catch {}
  }, []);
  useEffect(() => {
    setMenu(false);
  }, [path]);
  function toggle() {
    setCollapsed((c) => {
      try {
        localStorage.setItem("nf:sidebar", c ? "0" : "1");
      } catch {}
      return !c;
    });
  }

  return (
    <div className="min-h-dvh lg:flex">
      {/* Sidebar desktop */}
      <aside
        className={`sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-ink transition-[width] duration-300 ease-[var(--ease-out-expo)] lg:flex ${collapsed ? "w-[76px]" : "w-[248px]"}`}
        aria-label="Navegação principal"
      >
        <div className={`flex h-16 items-center ${collapsed ? "justify-center" : "justify-between px-5"}`}>
          <Logo href="/dashboard" compact={collapsed} />
        </div>
        <div className={collapsed ? "px-3" : "px-4"}>
          <button onClick={() => quickLog()} className={`btn btn-volt w-full ${collapsed ? "px-0" : ""}`} aria-label="Registrar alimento" title="Registrar alimento">
            <Plus size={16} strokeWidth={2.5} /> {!collapsed && "Registrar alimento"}
          </button>
        </div>
        <nav className="mt-6 flex-1 overflow-y-auto px-3">
          <ul className="space-y-0.5">
            {NAV.map((n) => (
              <NavItem key={n.href} {...n} active={isActive(path, n.href)} collapsed={collapsed} />
            ))}
          </ul>
          <div className={`my-4 h-px bg-line ${collapsed ? "mx-2" : "mx-3"}`} />
          <ul className="space-y-0.5">
            {NAV_ACCOUNT.map((n) => (
              <NavItem key={n.href} {...n} active={isActive(path, n.href)} collapsed={collapsed} />
            ))}
          </ul>
        </nav>
        <div className={`border-t border-line p-3 ${collapsed ? "space-y-2" : "flex items-center gap-2"}`}>
          {!collapsed && <span className="flex-1 truncate px-2 text-sm text-mute">{userName}</span>}
          <form action={logoutAction} className={collapsed ? "" : "shrink-0"}>
            <button className={`btn btn-quiet h-9 px-2 ${collapsed ? "w-full" : ""}`} title="Sair" aria-label="Sair">
              <LogOut size={16} />
            </button>
          </form>
          <button onClick={toggle} className={`btn btn-quiet h-9 px-2 ${collapsed ? "w-full" : "shrink-0"}`} aria-label={collapsed ? "Expandir menu" : "Recolher menu"} title={collapsed ? "Expandir" : "Recolher"}>
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>
      </aside>

      {/* Topo mobile */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-ink/90 px-4 backdrop-blur-md lg:hidden">
        <Logo href="/dashboard" />
        <button onClick={() => setMenu(true)} className="btn btn-quiet h-10 w-10 p-0" aria-label="Abrir menu" aria-expanded={menu}>
          <Menu size={20} />
        </button>
      </header>

      <main id="conteudo" className="min-w-0 flex-1 pb-28 lg:pb-0">
        {children}
      </main>

      {/* Barra inferior mobile, diário com acesso prioritário */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden" aria-label="Navegação rápida">
        <ul className="grid grid-cols-5 items-center">
          {[NAV[0], NAV[1]].map((n) => (
            <BottomItem key={n.href} {...n} active={isActive(path, n.href)} />
          ))}
          <li className="flex justify-center">
            <button onClick={() => quickLog()} className="-mt-6 grid h-14 w-14 place-items-center bg-volt text-volt-ink shadow-[0_10px_30px_-8px_rgba(255,42,61,0.45)]" aria-label="Registrar alimento">
              <Plus size={24} strokeWidth={2.5} />
            </button>
          </li>
          {[NAV[6], NAV[3]].map((n) => (
            <BottomItem key={n.href} {...n} active={isActive(path, n.href)} />
          ))}
        </ul>
      </nav>

      {/* Menu completo mobile */}
      <AnimatePresence>
        {menu && (
          <motion.div className="fixed inset-0 z-50 bg-ink lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} role="dialog" aria-modal="true" aria-label="Menu">
            <div className="flex h-14 items-center justify-between border-b border-line px-4">
              <Logo href="/dashboard" />
              <button onClick={() => setMenu(false)} className="btn btn-quiet h-10 w-10 p-0" aria-label="Fechar menu" autoFocus>
                <X size={20} />
              </button>
            </div>
            <nav className="px-4 py-6">
              <ul>
                {[...NAV, ...NAV_ACCOUNT].map((n, i) => (
                  <motion.li key={n.href} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.025 }}>
                    <Link href={n.href} className={`flex items-center justify-between border-b border-line py-3.5 font-[family-name:var(--font-display)] text-3xl font-bold uppercase ${isActive(path, n.href) ? "text-volt" : ""}`}>
                      {n.label}
                      <n.icon size={18} className="text-mute" aria-hidden />
                    </Link>
                  </motion.li>
                ))}
              </ul>
              <form action={logoutAction} className="mt-6">
                <button className="btn btn-ghost w-full">
                  <LogOut size={16} /> Sair
                </button>
              </form>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavItem({ href, label, icon: Icon, active, collapsed }: { href: string; label: string; icon: React.ElementType; active: boolean; collapsed: boolean }) {
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        title={collapsed ? label : undefined}
        className={`relative flex h-10 items-center gap-3 text-sm transition-colors ${collapsed ? "justify-center" : "px-3"} ${active ? "bg-graphite text-bone" : "text-mute hover:bg-graphite/60 hover:text-bone"}`}
      >
        {active && <motion.span layoutId="nav-active" className="absolute inset-y-1.5 left-0 w-[2px] bg-volt" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
        <Icon size={17} aria-hidden />
        {!collapsed && <span>{label}</span>}
        {collapsed && <span className="sr-only">{label}</span>}
      </Link>
    </li>
  );
}

function BottomItem({ href, label, icon: Icon, active }: { href: string; label: string; icon: React.ElementType; active: boolean }) {
  return (
    <li>
      <Link href={href} aria-current={active ? "page" : undefined} className={`flex h-16 flex-col items-center justify-center gap-1 text-[10px] uppercase tracking-wider ${active ? "text-volt" : "text-mute"}`}>
        <Icon size={19} aria-hidden />
        {label.split(" ")[0]}
      </Link>
    </li>
  );
}
