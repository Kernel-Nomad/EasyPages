import { useState } from 'react';
import { Loader2, PlugZap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AuthLayout from '../components/AuthLayout';

/** Shown when the backend did not answer at all, as opposed to answering with an error. */
const OfflineView = ({ onRetry, onToggleLanguage }) => {
  const { t } = useTranslation();
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <AuthLayout title={t('auth_offline_title')} onToggleLanguage={onToggleLanguage}>
      <div className="space-y-4">
        <p className="flex gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-600">
          <PlugZap size={16} className="mt-px shrink-0" />
          <span>{t('auth_offline_hint')}</span>
        </p>

        <button
          type="button"
          onClick={handleRetry}
          disabled={retrying}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
        >
          {retrying && <Loader2 size={16} className="animate-spin" />}
          {t('auth_retry')}
        </button>
      </div>
    </AuthLayout>
  );
};

export default OfflineView;
