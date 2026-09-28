import type { ReactNode } from 'react';
import { Logo } from '@/components/Logo';

/** The frame shared by every screen shown before the app itself. */
export function AuthCard({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-6">
          <Logo size={44} className="shrink-0" />
          <h1 className="text-2xl font-bold text-gray-900">Patrimonia</h1>
        </div>
        <div className="bg-white rounded-lg border shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{titre}</h2>
          {children}
        </div>
      </div>
    </div>
  );
}

export function Champ({
  label,
  type,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  type: 'email' | 'password';
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}) {
  return (
    <label className="block mb-3">
      <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </label>
  );
}

export function Bouton({ children, disabled }: { children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {children}
    </button>
  );
}

export function Alerte({ type, children }: { type: 'erreur' | 'info'; children: ReactNode }) {
  const style =
    type === 'erreur'
      ? 'bg-red-50 border-red-200 text-red-700'
      : 'bg-green-50 border-green-200 text-green-800';
  return (
    <div role={type === 'erreur' ? 'alert' : 'status'} className={`mb-4 p-3 border rounded-md text-sm ${style}`}>
      {children}
    </div>
  );
}
