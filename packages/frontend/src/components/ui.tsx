import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, X } from 'lucide-react';

// ==========================================
// 1. BUTTON
// ==========================================
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  ...props
}) => {
  const baseStyle = "inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 focus:outline-none active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none";
  
  const variants = {
    primary: "bg-energy text-white hover:bg-energy-dark shadow-lg shadow-orange-500/20 hover:shadow-orange-500/35",
    secondary: "bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700",
    outline: "border-2 border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800",
    danger: "bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/10",
    ghost: "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-5 py-2.5 text-sm",
    lg: "px-6 py-3.5 text-base"
  };

  return (
    <button
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

// ==========================================
// 2. INPUT
// ==========================================
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  className = '',
  ...props
}) => {
  return (
    <div className="w-full mb-4">
      {label && <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">{label}</label>}
      <input
        className={`w-full px-4 py-3 bg-white dark:bg-slate-900 border ${
          error ? 'border-red-500 focus:ring-red-500/20' : 'border-slate-200 dark:border-slate-800 focus:ring-orange-500/20'
        } rounded-xl shadow-sm text-sm focus:border-energy focus:ring-4 transition-all duration-200 outline-none dark:text-white`}
        {...props}
      />
      {error && <span className="block text-xs text-red-500 mt-1">{error}</span>}
    </div>
  );
};

// ==========================================
// 3. CARD
// ==========================================
interface CardProps {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  interactive = false
}) => {
  return (
    <div className={`bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-6 shadow-md transition-all duration-300 ${
      interactive ? 'hover:scale-[1.02] hover:shadow-xl hover:border-orange-500/10' : ''
    } ${className}`}>
      {children}
    </div>
  );
};

// ==========================================
// 4. BADGE
// ==========================================
interface BadgeProps {
  variant?: 'orange' | 'green' | 'blue' | 'red' | 'gray';
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'gray',
  children,
  className = ''
}) => {
  const styles = {
    orange: "bg-orange-50 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400",
    green: "bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400",
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400",
    red: "bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400",
    gray: "bg-slate-50 text-slate-600 dark:bg-slate-800/80 dark:text-slate-300"
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide ${styles[variant]} ${className}`}>
      {children}
    </span>
  );
};

// ==========================================
// 5. MODAL
// ==========================================
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children
}) => {
  const modalStateKey = useRef(`modal-${Math.random().toString(36).substring(2, 9)}`);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    window.history.pushState({ modalKey: modalStateKey.current }, '');

    const handlePopState = (event: PopStateEvent) => {
      if (event.state?.modalKey !== modalStateKey.current) {
        onClose();
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (window.history.state?.modalKey === modalStateKey.current) {
        window.history.back();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Box */}
      <div 
        className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg p-6 shadow-2xl relative z-10 border border-slate-100 dark:border-slate-850 animate-float-in max-h-[calc(100dvh-2rem)] flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-4 mb-4 flex-shrink-0">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white">{title}</h3>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto pr-1 flex-1 max-h-[60vh] md:max-h-[70vh] pb-[env(safe-area-inset-bottom)]">
          {children}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 6. TOAST
// ==========================================
interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  onClose
}) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const styles = {
    success: "bg-green-500 text-white shadow-green-500/25",
    error: "bg-red-500 text-white shadow-red-500/25",
    info: "bg-slate-800 text-white shadow-slate-800/25"
  };

  return (
    <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl transition-all duration-300 transform translate-y-0 ${styles[type]} animate-slide-in`}>
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="hover:opacity-80">
        <X size={16} />
      </button>
    </div>
  );
};

// ==========================================
// 7. LEGAL CONSENT
// ==========================================
interface LegalConsentProps {
  termsAccepted: boolean;
  privacyAccepted: boolean;
  marketingConsent: boolean;
  onTermsChange: (checked: boolean) => void;
  onPrivacyChange: (checked: boolean) => void;
  onMarketingChange: (checked: boolean) => void;
  compact?: boolean;
}

export const LegalConsent: React.FC<LegalConsentProps> = ({
  termsAccepted,
  privacyAccepted,
  marketingConsent,
  onTermsChange,
  onPrivacyChange,
  onMarketingChange,
  compact = false
}) => {
  const checkboxClass = "mt-0.5 h-4 w-4 rounded border-slate-300 text-energy focus:ring-energy dark:border-slate-700 dark:bg-slate-900";

  return (
    <div className={`rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/40 ${compact ? 'space-y-2' : 'space-y-3'}`}>
      <div className="flex items-start gap-2 text-slate-700 dark:text-slate-200">
        <ShieldCheck size={16} className="mt-0.5 flex-shrink-0 text-energy" />
        <div>
          <p className="text-xs font-bold uppercase tracking-wide">Privacidade e segurança</p>
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Usamos seus dados apenas para login, entrega, pagamento, suporte e comunicações essenciais do pedido.
          </p>
        </div>
      </div>

      <label className="flex items-start gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
        <input
          type="checkbox"
          checked={termsAccepted}
          onChange={(event) => onTermsChange(event.target.checked)}
          className={checkboxClass}
        />
        <span>Li e aceito os Termos de Uso do Traz Pra Cá.</span>
      </label>

      <label className="flex items-start gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
        <input
          type="checkbox"
          checked={privacyAccepted}
          onChange={(event) => onPrivacyChange(event.target.checked)}
          className={checkboxClass}
        />
        <span>Li e aceito a Política de Privacidade.</span>
      </label>

      <label className="flex items-start gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
        <input
          type="checkbox"
          checked={marketingConsent}
          onChange={(event) => onMarketingChange(event.target.checked)}
          className={checkboxClass}
        />
        <span>Quero receber novidades e ofertas. Opcional.</span>
      </label>
    </div>
  );
};
