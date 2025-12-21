import React from 'react';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const StatusBadge = ({ status }) => {
  const { t } = useTranslation();

  if (status === 'success' || status === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
        <CheckCircle2 size={12} />
        {t('status_success')}
      </span>
    );
  }
  if (status === 'failure') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
        <XCircle size={12} />
        {t('status_failure')}
      </span>
    );
  }
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
        <Loader2 size={12} className="animate-spin" />
        {t('status_pending')}
      </span>
    );
  }
  return <span className="text-gray-500 text-xs">{status}</span>;
};

export default StatusBadge;
