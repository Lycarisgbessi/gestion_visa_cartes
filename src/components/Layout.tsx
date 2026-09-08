import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  CreditCard, 
  Users, 
  Store, 
  BarChart3, 
  Menu, 
  X,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Settings
} from 'lucide-react';

import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

const navigation = [
  { name: 'Tableau de bord', href: '/', icon: LayoutDashboard },
  { name: 'Stock Cartes', href: '/inventory', icon: CreditCard },
  { name: 'Partenaires', href: '/partners', icon: Users },
  { name: 'Agence', href: '/agency', icon: Store },
  { name: 'Rapports', href: '/reports', icon: BarChart3 },
  { name: 'Paramètres', href: '/settings', icon: Settings },
];


export default function Layout({ children }: { children: React.ReactNode }) {
  // mobileOpen: controls the mobile drawer
  const [mobileOpen, setMobileOpen] = useState(false);
  // desktopCollapsed: controls narrow/full sidebar on desktop
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const location = useLocation();
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 flex">

      {/* ─── Mobile backdrop ─────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-gray-900/50 lg:hidden"
          style={{ zIndex: 200 }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ─── Sidebar ─────────────────────────────────────────────── */}
      {/*
          On MOBILE  : slides in from left as an overlay (z-210).
          On DESKTOP : always visible, either full (w-64) or icon-only (w-16).
          z-index is intentionally LOWER than modals (modals use z-[300]).
      */}
      <aside
        className={cn(
          // positioning & transitions
          "fixed inset-y-0 left-0 flex flex-col bg-white shadow-xl transition-all duration-300 ease-in-out",
          // desktop: always shown, width toggles
          "lg:static lg:translate-x-0 lg:shadow-none lg:border-r lg:border-gray-100",
          // mobile: offscreen when closed, overlay when open
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          // width
          desktopCollapsed ? "lg:w-16" : "lg:w-64",
          // mobile always full-width sidebar when open
          "w-64",
        )}
        style={{ zIndex: 210 }}
      >
        {/* Logo / header */}
        <div className={cn(
          "flex h-16 items-center border-b border-gray-100 shrink-0 transition-all duration-300",
          desktopCollapsed ? "lg:justify-center px-2" : "justify-between px-5"
        )}>
          {/* Title — hidden when collapsed on desktop */}
          <span className={cn(
            "text-xl font-bold text-indigo-600 whitespace-nowrap transition-opacity duration-200",
            desktopCollapsed ? "lg:hidden" : ""
          )}>
            VisaManager Pro
          </span>

          {/* Desktop collapse toggle */}
          <button
            onClick={() => setDesktopCollapsed(c => !c)}
            className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-indigo-600 transition-colors"
            title={desktopCollapsed ? "Développer" : "Réduire"}
          >
            {desktopCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>

          {/* Mobile close */}
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden text-gray-400 hover:text-gray-600"
          >
            <X size={22} />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setMobileOpen(false)}
                title={desktopCollapsed ? item.name : undefined}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-150",
                  isActive
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                  desktopCollapsed ? "lg:justify-center lg:px-0" : ""
                )}
              >
                <item.icon
                  size={20}
                  className={cn("shrink-0", isActive ? "text-indigo-600" : "text-gray-400")}
                />
                <span className={cn("truncate transition-all duration-200", desktopCollapsed ? "lg:hidden" : "")}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-2 border-t border-gray-100">
          <button
            onClick={() => logout()}
            title={desktopCollapsed ? "Déconnexion" : undefined}
            className={cn(
              "flex w-full items-center gap-3 px-3 py-2.5 text-sm font-medium text-red-500 rounded-xl hover:bg-red-50 transition-colors",
              desktopCollapsed ? "lg:justify-center lg:px-0" : ""
            )}
          >
            <LogOut size={20} className="shrink-0" />
            <span className={cn("truncate", desktopCollapsed ? "lg:hidden" : "")}>Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* ─── Main content ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0 overflow-hidden">

        {/* Mobile top bar */}
        <header className="bg-white border-b border-gray-100 lg:hidden shrink-0">
          <div className="flex h-14 items-center justify-between px-4">
            <button
              onClick={() => setMobileOpen(true)}
              className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            >
              <Menu size={22} />
            </button>
            <span className="text-base font-semibold text-gray-900">VisaManager Pro</span>
            <div className="w-8" />
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden overflow-y-auto">
          <div className="max-w-7xl mx-auto animate-fade-in pb-8">
            {children}
          </div>
        </main>
        
        {/* Footer */}
        <footer className="shrink-0 border-t border-gray-100 bg-white py-4 px-6 mt-auto">
          <div className="max-w-7xl mx-auto flex items-center justify-center text-sm text-gray-400">
            <span>Conçu avec excellence par <span className="font-bold text-gray-900 tracking-wide">EINSOF DIGIT</span></span>
          </div>
        </footer>
      </div>
    </div>
  );
}
