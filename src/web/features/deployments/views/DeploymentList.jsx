import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Clock, ExternalLink, GitBranch, Hash, Loader2, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { easyPagesClient } from '../../../../api/client/easyPagesApi.js';
import { isSecurityError } from '../../../app/hooks/useAuthSession.js';
import { dashboardErrorMessage } from '../../../shared/i18n/dashboardErrors.js';
import StatusBadge from '../../../shared/ui/StatusBadge';

const DeploymentItem = ({ deployment, isSelected, onToggle, isProduction }) => {
  const { t, i18n } = useTranslation();
  const checkboxLabel = isProduction
    ? `${deployment.id} (${t('production_badge')})`
    : (deployment.deployment_trigger?.metadata?.commit_message
      || deployment.message
      || deployment.id);

  return (
    <div className={`flex items-center justify-between p-4 border-b border-gray-100 last:border-0 transition-colors group ${isSelected ? 'bg-orange-50' : 'hover:bg-gray-50'}`}>
      <div className="flex items-center gap-4">
        <input
          type="checkbox"
          checked={isSelected}
          disabled={isProduction}
          onChange={() => onToggle(deployment.id)}
          aria-label={checkboxLabel}
          className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-2 focus:ring-orange-500 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        />

        <div className={`mt-0.5 w-2.5 h-2.5 rounded-full ring-4 ring-opacity-20 ${
          deployment.status === 'success' ? 'bg-emerald-500 ring-emerald-500' :
          deployment.status === 'active' ? 'bg-blue-500 ring-blue-500' : 'bg-red-500 ring-red-500'
        }`} />

        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-gray-900 text-sm">
              {deployment.deployment_trigger?.metadata?.commit_message || deployment.message || t('manual_deploy')}
            </span>
            {isProduction && (
              <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">
                {t('production_badge')}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
            <span className="flex items-center gap-1 bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
              <GitBranch size={10} aria-hidden="true" />
              {deployment.deployment_trigger?.metadata?.branch || deployment.branch || t('default_branch')}
            </span>

            <span className="flex items-center gap-1 font-mono">
              <Hash size={10} aria-hidden="true" />
              {deployment.deployment_trigger?.metadata?.commit_hash?.substring(0, 7) || deployment.commit_hash?.substring(0, 7) || '----'}
            </span>

            <span className="flex items-center gap-1">
              <Clock size={10} aria-hidden="true" />
              {new Date(deployment.created_on).toLocaleString(i18n.language)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <StatusBadge status={deployment.status} />

        {deployment.url && (
          <a
            href={deployment.url}
            target="_blank"
            rel="noreferrer"
            className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-full focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
            title={t('view_deploy')}
            aria-label={t('view_deploy')}
          >
            <ExternalLink size={18} aria-hidden="true" />
          </a>
        )}
      </div>
    </div>
  );
};

const DeploymentList = ({
  deployments,
  deploymentsHasMore,
  loadingMore,
  onLoadMore,
  productionDeploymentId,
  projectName,
  csrfToken,
  onConfirm,
  onNotify,
  onRefresh,
}) => {
  const { t } = useTranslation();
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const selectAllRef = useRef(null);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [projectName]);

  useEffect(() => {
    if (!selectAllRef.current) {
      return;
    }
    const selectable = deployments.filter((d) => d.id !== productionDeploymentId);
    const partial = selectedIds.size > 0 && selectedIds.size < selectable.length;
    selectAllRef.current.indeterminate = partial;
  }, [selectedIds, deployments, productionDeploymentId]);

  const handleToggle = (id) => {
    if (id === productionDeploymentId) {
      return;
    }
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      const ids = deployments
        .filter((deployment) => deployment.id !== productionDeploymentId)
        .map((deployment) => deployment.id);
      setSelectedIds(new Set(ids));
    } else {
      setSelectedIds(new Set());
    }
  };

  const notifyDeleteResult = (result) => {
    if (result.success === 0 && result.failed === 0 && result.skipped > 0) {
      onNotify('info', t('deploy_delete_skipped_only'));
      return;
    }
    if (result.failed > 0) {
      onNotify('warning', t('deploy_delete_partial', result));
      return;
    }
    onNotify('success', t('deploy_delete_success', { count: result.success }));
  };

  const handleDeleteSelected = async () => {
    const confirmed = await onConfirm({
      title: t('confirm_delete_selected_title'),
      message: t('confirm_delete_selected', { count: selectedIds.size }),
      confirmLabel: t('delete'),
      destructive: true,
    });

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);

    try {
      const ids = Array.from(selectedIds);
      const chunkSize = 5;
      const results = { failed: 0, skipped: 0, success: 0 };

      for (let index = 0; index < ids.length; index += chunkSize) {
        const chunk = ids.slice(index, index + chunkSize);
        const chunkResult = await easyPagesClient.deleteDeployments({
          projectName,
          csrfToken,
          deploymentIds: chunk,
        });
        results.failed += chunkResult.failed;
        results.success += chunkResult.success;
        results.skipped += chunkResult.skipped || 0;
      }

      notifyDeleteResult(results);
      await onRefresh();
    } catch (error) {
      if (!isSecurityError(error)) {
        console.error(error);
        onNotify('error', dashboardErrorMessage(error, 'deploy_delete_error', t));
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteAll = async () => {
    const confirmed = await onConfirm({
      title: t('confirm_delete_all_title'),
      message: t('confirm_delete_all'),
      confirmLabel: t('delete'),
      destructive: true,
    });

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);

    try {
      const data = await easyPagesClient.fetchDeploymentDeleteCandidates(projectName);
      const idsToDelete = data.ids || [];

      if (data.truncated || data.fetchError) {
        const proceed = await onConfirm({
          title: t('confirm_delete_truncated_title'),
          message: t('confirm_delete_truncated'),
          confirmLabel: t('continue'),
          destructive: true,
        });
        if (!proceed) {
          setIsDeleting(false);
          return;
        }
      }

      if (idsToDelete.length === 0) {
        onNotify('info', t('deploy_delete_none'));
        setIsDeleting(false);
        return;
      }

      setProgress({ current: 0, total: idsToDelete.length });

      const chunkSize = 5;
      const results = { failed: 0, skipped: 0, success: 0 };

      for (let index = 0; index < idsToDelete.length; index += chunkSize) {
        const chunk = idsToDelete.slice(index, index + chunkSize);
        const chunkResult = await easyPagesClient.deleteDeployments({
          projectName,
          csrfToken,
          deploymentIds: chunk,
        });

        results.failed += chunkResult.failed;
        results.success += chunkResult.success;
        results.skipped += chunkResult.skipped || 0;

        setProgress((currentProgress) => ({
          ...currentProgress,
          current: Math.min(currentProgress.current + chunk.length, currentProgress.total),
        }));
      }

      notifyDeleteResult(results);
      await onRefresh();
    } catch (error) {
      if (!isSecurityError(error)) {
        console.error(error);
        onNotify('error', dashboardErrorMessage(error, 'deploy_delete_error', t));
      }
    } finally {
      setIsDeleting(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  const selectableCount = deployments.filter((d) => d.id !== productionDeploymentId).length;

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm relative">
      {isDeleting && progress.total > 0 && (
        <div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center p-8 gap-4">
          <Loader2 size={40} className="animate-spin text-orange-600" />
          <div className="w-full max-w-md space-y-2">
            <div className="flex justify-between text-sm font-medium text-gray-600">
              <span>{t('deleting_msg')}</span>
              <span>{Math.round((progress.current / progress.total) * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
              <div
                className="h-full bg-orange-500 transition-all duration-300"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <input
            ref={selectAllRef}
            type="checkbox"
            checked={selectedIds.size > 0 && selectedIds.size === selectableCount && selectableCount > 0}
            onChange={handleSelectAll}
            aria-label={t('select_all')}
            className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-2 focus:ring-orange-500"
          />
          <span className="text-sm text-gray-600">
            {selectedIds.size > 0 ? t('selected_count', { count: selectedIds.size }) : t('select_all')}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDeleteAll}
            disabled={isDeleting || deployments.length === 0}
            className="text-sm px-3 py-1.5 rounded-md border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50 flex items-center gap-2"
          >
            <AlertTriangle size={14} />
            {t('delete_all_non_prod')}
          </button>
          <button
            type="button"
            onClick={handleDeleteSelected}
            disabled={isDeleting || selectedIds.size === 0}
            className="text-sm px-3 py-1.5 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
          >
            {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {t('delete_selected', { count: selectedIds.size })}
          </button>
        </div>
      </div>

      {deployments.length === 0 ? (
        <div className="p-12 text-center text-gray-500">
          <Clock size={32} className="mx-auto mb-3 text-gray-300" />
          <p>{t('no_deployments')}</p>
        </div>
      ) : (
        <>
          {deployments.map((deployment) => (
            <DeploymentItem
              key={deployment.id}
              deployment={deployment}
              isSelected={selectedIds.has(deployment.id)}
              onToggle={handleToggle}
              isProduction={deployment.id === productionDeploymentId}
            />
          ))}
          {deploymentsHasMore && (
            <div className="p-4 border-t border-gray-100 flex justify-center">
              <button
                type="button"
                onClick={onLoadMore}
                disabled={loadingMore || isDeleting}
                className="text-sm px-4 py-2 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
              >
                {loadingMore ? <Loader2 size={14} className="animate-spin" /> : null}
                {t('load_more_deployments')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DeploymentList;
