import { Ban, CheckCircle2, Loader2, PauseCircle, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Cloudflare Pages stage statuses: success | failure | active | idle | canceled.
 * Legacy `pending` is treated like idle (demo / older fixtures).
 */
const StatusBadge = ({ status }) => {
  const { t } = useTranslation();

  if (status === 'success') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
        <CheckCircle2 size={12} aria-hidden="true" />
        {t('status_success')}
      </span>
    );
  }

  if (status === 'failure') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
        <XCircle size={12} aria-hidden="true" />
        {t('status_failure')}
      </span>
    );
  }

  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
        <Loader2 size={12} className="animate-spin" aria-hidden="true" />
        {t('status_active')}
      </span>
    );
  }

  if (status === 'idle' || status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
        <PauseCircle size={12} aria-hidden="true" />
        {t('status_pending')}
      </span>
    );
  }

  if (status === 'canceled' || status === 'cancelled') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
        <Ban size={12} aria-hidden="true" />
        {t('status_canceled')}
      </span>
    );
  }

  return <span className="text-gray-500 text-xs">{t('unknown')}</span>;
};

export default StatusBadge;
