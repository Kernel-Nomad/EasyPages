import React, { useEffect, useState } from 'react';
import { AlertTriangle, Clock, ExternalLink, GitBranch, Hash, Loader2, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { easyPagesClient } from '../../../../api/client/easyPagesApi.js';
import { isSecurityError } from '../../../app/hooks/useCsrfSession.js';
import StatusBadge from '../../../shared/ui/StatusBadge';

const DeploymentItem = ({ deployment, isSelected, onToggle, isProduction }) => {
  const { t } = useTranslation();

  return (
    <div className={`flex items-center justify-between p-4 border-b border-gray-100 last:border-0 transition-colors group ${isSelected ? 'bg-orange-50' : 'hover:bg-gray-50'}`}>
      <div className="flex items-center gap-4">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggle(deployment.id)}
          className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-50 cursor-pointer"
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
                Production
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
            <span className="flex items-center gap-1 bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
              <GitBranch size={10} />
              {deployment.deployment_trigger?.metadata?.branch || deployment.branch || 'main'}
            </span>

            <span className="flex items-center gap-1 font-mono">
              <Hash size={10} />
              {deployment.deployment_trigger?.metadata?.commit_hash?.substring(0, 7) || deployment.commit_hash?.substring(0, 7) || '----'}
            </span>

            <span className="flex items-center gap-1">
              <Clock size={10} />
              {new Date(deployment.created_on).toLocaleString()}
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
            className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-full"
            title={t('view_deploy')}
          >
            <ExternalLink size={18} />
          </a>
        )}
      </div>
    </div>
  );
};

const DeploymentList = ({
  deployments,
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

  useEffect(() => {
    setSelectedIds(new Set());
  }, [deployments]);

  const handleToggle = (id) => {
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
      const ids = deployments.map((deployment) => deployment.id);
      setSelectedIds(new Set(ids));
    } else {
      setSelectedIds(new Set());
    }
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
      const result = await easyPagesClient.deleteDeployments({
        projectName,
        csrfToken,
        deploymentIds: Array.from(selectedIds),
      });

      if (result.failed > 0) {
        onNotify('warning', t('deploy_delete_partial', result));
      } else {
        onNotify('success', t('deploy_delete_success', { count: result.success }));
      }

      await onRefresh();
    } catch (error) {
      if (!isSecurityError(error)) {
        console.error(error);
        onNotify('error', error.message || t('deploy_delete_error'));
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
    setProgress({ current: 0, total: 100 });

    try {
      const data = await easyPagesClient.fetchDeploymentDeleteCandidates(projectName);
      const idsToDelete = data.ids || [];

      if (idsToDelete.length === 0) {
        onNotify('info', t('deploy_delete_none'));
        setIsDeleting(false);
        return;
      }

      setProgress({ current: 0, total: idsToDelete.length });

      const chunkSize = 5;
      const results = { failed: 0, success: 0 };

      for (let index = 0; index < idsToDelete.length; index += chunkSize) {
        const chunk = idsToDelete.slice(index, index + chunkSize);
        const chunkResult = await easyPagesClient.deleteDeployments({
          projectName,
          csrfToken,
          deploymentIds: chunk,
        });

        results.failed += chunkResult.failed;
        results.success += chunkResult.success;

        setProgress((currentProgress) => ({
          ...currentProgress,
          current: Math.min(currentProgress.current + chunk.length, currentProgress.total),
        }));
      }

      if (results.failed > 0) {
        onNotify('warning', t('deploy_delete_partial', results));
      } else {
        onNotify('success', t('deploy_delete_success', { count: results.success }));
      }

      await onRefresh();
    } catch (error) {
      if (!isSecurityError(error)) {
        console.error(error);
        onNotify('error', error.message || t('deploy_delete_error'));
      }
    } finally {
      setIsDeleting(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden animate-in fade-in duration-300 shadow-sm relative">
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
            type="checkbox"
            checked={selectedIds.size > 0 && selectedIds.size === deployments.length}
            onChange={handleSelectAll}
            className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-50"
          />
          <span className="text-sm text-gray-600">
            {selectedIds.size > 0 ? t('selected_count', { count: selectedIds.size }) : t('select_all')}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDeleteAll}
            disabled={isDeleting || deployments.length === 0}
            className="text-sm px-3 py-1.5 rounded-md border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50 flex items-center gap-2"
          >
            <AlertTriangle size={14} />
            {t('delete_all_non_prod')}
          </button>
          <button
            onClick={handleDeleteSelected}
            disabled={isDeleting || selectedIds.size === 0}
            className="text-sm px-3 py-1.5 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
          >
            {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {t('delete_selected')}
          </button>
        </div>
      </div>

      {deployments.length === 0 ? (
        <div className="p-12 text-center text-gray-500">
          <Clock size={32} className="mx-auto mb-3 text-gray-300" />
          <p>{t('no_deployments')}</p>
        </div>
      ) : (
        deployments.map((deployment, index) => (
          <DeploymentItem
            key={deployment.id}
            deployment={deployment}
            isSelected={selectedIds.has(deployment.id)}
            onToggle={handleToggle}
            isProduction={index === 0}
          />
        ))
      )}
    </div>
  );
};

export default DeploymentList;
