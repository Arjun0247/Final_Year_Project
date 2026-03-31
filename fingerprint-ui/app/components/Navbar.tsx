'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { Fingerprint, ChevronDown, LogOut, BarChart3, Settings, Home } from 'lucide-react';

export default function Navbar() {
  const { user, isLoggedIn, logout } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <nav className="fixed top-0 left-0 w-full z-50 bg-slate-950/80 backdrop-blur-md border-b border-cyan-500/20 text-white">

      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">

        {/* LEFT: Logo */}
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="bg-gradient-to-br from-cyan-500 to-blue-600 p-2 rounded-lg">
            <Fingerprint className="w-6 h-6 text-white" />
          </div>
          <span className="font-black text-xl bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400 hidden sm:inline">
            RAPID BIO
          </span>
        </Link>

        {/* CENTER: Navigation Links */}
        <div className="hidden md:flex items-center gap-8">
          {isLoggedIn && (
            <>

              <Link
                href="/dashboard"
                className="text-slate-300 hover:text-cyan-400 transition-colors font-medium flex items-center gap-2"
              >
                <BarChart3 className="w-4 h-4" />
                Dashboard
              </Link>
            </>
          )}
        </div>

        {/* RIGHT: Auth Section */}
        <div className="flex items-center gap-4">
          {isLoggedIn && user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-950/30 hover:bg-cyan-900/40 border border-cyan-500/50 transition-all hover:border-cyan-400 text-cyan-400"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-sm font-bold">
                  {user.username.substring(0, 2).toUpperCase()}
                </div>
                <span className="hidden sm:inline text-white font-medium">{user.username}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-cyan-500/30 rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                  <div className="px-4 py-3 border-b border-slate-700 bg-slate-950">
                    <p className="text-xs text-slate-400">Logged in as</p>
                    <p className="text-white font-semibold">{user.email}</p>
                  </div>

                  <Link
                    href="/profile"
                    className="flex items-center gap-3 w-full px-4 py-3 text-slate-300 hover:text-cyan-400 hover:bg-slate-800/50 transition-all"
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    <Settings className="w-4 h-4" />
                    Settings
                  </Link>

                  <button
                    onClick={() => {
                      logout();
                      setIsDropdownOpen(false);
                    }}
                    className="flex items-center gap-3 w-full px-4 py-3 text-red-400 hover:text-red-300 hover:bg-slate-800/50 transition-all border-t border-slate-700"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="px-6 py-2 text-cyan-400 font-medium hover:text-cyan-300 transition-colors"
              >
                Login
              </Link>
              <Link
                href="/signup"
                className="px-6 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-medium rounded-lg hover:from-cyan-500 hover:to-blue-500 transition-all hover:shadow-lg hover:shadow-cyan-500/20"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
