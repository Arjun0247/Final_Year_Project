'use client';

import { useAuth } from '@/app/context/AuthContext';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import Link from 'next/link';
import { User, Mail, Shield, LogOut, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

function ProfileContent() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-white pt-8 pb-12">
      <div className="max-w-2xl mx-auto px-6">
        {/* Back Button */}
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 mb-8 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Dashboard
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400 mb-2">
            Profile Settings
          </h1>
          <p className="text-slate-400">Manage your account information</p>
        </div>

        {/* Profile Card */}
        <div className="bg-gradient-to-br from-slate-900/50 to-slate-900/30 border border-cyan-500/20 rounded-2xl p-8 space-y-8">
          {/* Avatar Section */}
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center text-3xl font-black">
              {user?.username.substring(0, 1).toUpperCase()}
            </div>
            <div>
              <h2 className="text-3xl font-bold text-white">{user?.username}</h2>
              <p className="text-cyan-400 font-medium">Account verified</p>
            </div>
          </div>

          {/* Info Section */}
          <div className="space-y-4 border-t border-slate-700 pt-8">
            <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-900/50">
              <User className="w-5 h-5 text-cyan-400" />
              <div className="flex-1">
                <p className="text-sm text-slate-400">Username</p>
                <p className="text-white font-medium">{user?.username}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-900/50">
              <Mail className="w-5 h-5 text-cyan-400" />
              <div className="flex-1">
                <p className="text-sm text-slate-400">Email Address</p>
                <p className="text-white font-medium">{user?.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-900/50">
              <Shield className="w-5 h-5 text-cyan-400" />
              <div className="flex-1">
                <p className="text-sm text-slate-400">Account Security</p>
                <p className="text-white font-medium">Secured with JWT</p>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="border-t border-slate-700 pt-8">
            <h3 className="text-lg font-bold text-red-400 mb-4">Account Actions</h3>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-red-950/30 hover:bg-red-950/50 border border-red-500/30 hover:border-red-500/50 text-red-400 font-semibold rounded-lg transition-all"
            >
              <LogOut className="w-5 h-5" />
              Sign Out from All Devices
            </button>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-8 p-4 rounded-lg bg-slate-900/30 border border-slate-700">
          <p className="text-sm text-slate-400">
            Your scan history is securely stored and can be accessed anytime from your dashboard.
          </p>
        </div>
      </div>
    </main>
  );
}

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfileContent />
    </ProtectedRoute>
  );
}
