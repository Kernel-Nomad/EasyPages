import React from 'react';
import { AlertCircle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

const stylesByType = {
  error: {
    container: 'bg-red-50 border-red-200 text-red-800',
    icon: 'bg-red-100 text-red-700',
    Icon: XCircle,
  },
  info: {
    container: 'bg-sky-50 border-sky-200 text-sky-800',
    icon: 'bg-sky-100 text-sky-700',
    Icon: Info,
  },
  success: {
    container: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    icon: 'bg-emerald-100 text-emerald-700',
    Icon: CheckCircle2,
  },
  warning: {
    container: 'bg-amber-50 border-amber-200 text-amber-800',
    icon: 'bg-amber-100 text-amber-700',
    Icon: AlertCircle,
  },
};

const NotificationToast = ({ notification, onDismiss }) => {
  if (!notification) {
    return null;
  }

  const style = stylesByType[notification.type] || stylesByType.info;

  return (
    <div className={`fixed top-20 right-4 z-50 max-w-sm rounded-lg border p-4 shadow-lg animate-in slide-in-from-right duration-300 ${style.container}`}>
      <div className="flex items-start gap-3">
        <div className={`rounded-full p-1 ${style.icon}`}>
          <style.Icon size={16} />
        </div>
        <p className="flex-1 text-sm font-medium">{notification.message}</p>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-full p-1 text-current/70 transition-colors hover:bg-black/5 hover:text-current"
          aria-label="Dismiss notification"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

export default NotificationToast;
