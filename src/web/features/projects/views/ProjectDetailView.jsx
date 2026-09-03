import {
  ArrowLeft,
  Clock,
  ExternalLink,
  GitBranch,
  Globe,
  Loader2,
  Play,
  Settings,
  UploadCloud,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import DeploymentList from '../../deployments/views/DeploymentList';
import DomainsTab from '../../domains/views/DomainsTab';
import SettingsTab from '../../settings/views/SettingsTab';
import UploadTab from '../../uploads/views/UploadTab';

const isGitSource = (source) => {
  const type = typeof source?.type === 'string' ? source.type.toLowerCase() : '';
  return type === 'github' || type === 'gitlab';
};

const ProjectDetailView = ({
  selectedProject,
  activeTab,
  setActiveTab,
  loadingDeployments,
  deployments,
  deploymentsHasMore,
  deploymentsLoadError,
  productionDeploymentId,
  csrfToken,
  isDeploying,
  onBack,
  onConfirm,
  onNotify,
  onTriggerDeploy,
  onRefreshDeployments,
  onLoadMoreDeployments,
  onUploadSuccess,
}) => {
  const { t } = useTranslation();
  const [isDeleting, setIsDeleting] = useState(false);
  const isGit = isGitSource(selectedProject.source);
  const navigationLocked = isDeleting;

  const tabs = [
    { id: 'deployments', label: t('tab_deployments'), icon: Clock, show: true },
    { id: 'domains', label: t('tab_domains'), icon: Globe, show: true },
    {
      id: 'upload',
      label: t('tab_upload'),
      icon: UploadCloud,
      show: !isGit,
    },
    { id: 'settings', label: t('tab_settings'), icon: Settings, show: true },
  ].filter((tab) => tab.show);

  const handleTabKeyDown = (event) => {
    if (navigationLocked) {
      return;
    }
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') {
      return;
    }
    event.preventDefault();
    const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);
    if (currentIndex < 0) {
      return;
    }
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (currentIndex + delta + tabs.length) % tabs.length;
    const nextId = tabs[nextIndex].id;
    setActiveTab(nextId);
    // Move focus with the selection (WAI-ARIA tabs pattern).
    requestAnimationFrame(() => {
      document.getElementById(`project-tab-${nextId}`)?.focus();
    });
  };

  const showHistorySpinner = loadingDeployments && deployments.length === 0 && !deploymentsLoadError;
  const showHistoryError = deploymentsLoadError && deployments.length === 0 && !loadingDeployments;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            disabled={navigationLocked}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
            title={t('back_to_list')}
            aria-label={t('back_to_list')}
          >
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-900">{selectedProject.name}</h2>
              {selectedProject.subdomain ? (
                <a
                  href={`https://${selectedProject.subdomain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-orange-600 hover:text-orange-800 bg-orange-50 px-2 py-0.5 rounded flex items-center gap-1"
                  aria-label={`${t('visit_site')} ${selectedProject.subdomain}`}
                >
                  {selectedProject.subdomain} <ExternalLink size={10} aria-hidden="true" />
                </a>
              ) : (
                <span className="text-xs text-gray-500">{t('no_domain')}</span>
              )}
            </div>
            <p className="text-sm text-gray-500 flex items-center gap-2 mt-1">
              {isGit && <GitBranch size={14} aria-hidden="true" />}
              {isGit ? (selectedProject.source?.repo || t('unknown_repo')) : t('direct_upload')}
            </p>
          </div>
        </div>

        {isGit && (
          <div className="flex gap-2 items-center">
            <button
              type="button"
              onClick={onTriggerDeploy}
              disabled={isDeploying || navigationLocked}
              className="flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isDeploying ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} className="fill-current" aria-hidden="true" />}
              <span>
                {isDeploying ? t('deploying_btn') : t('deploy_prod_btn')}
              </span>
            </button>
          </div>
        )}
      </div>

      <div className="border-b border-gray-200">
        <div className="-mb-px flex gap-6 overflow-x-auto" role="tablist" aria-label={t('project_tabs')}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`project-tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              aria-controls={`project-panel-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              disabled={navigationLocked}
              onClick={() => {
                if (!navigationLocked) {
                  setActiveTab(tab.id);
                }
              }}
              onKeyDown={handleTabKeyDown}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${activeTab === tab.id ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              <tab.icon size={16} aria-hidden="true" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-[400px]">
        <div
          role="tabpanel"
          id="project-panel-deployments"
          aria-labelledby="project-tab-deployments"
          hidden={activeTab !== 'deployments'}
        >
          {showHistorySpinner ? (
            <div className="p-10 text-center text-gray-500 flex flex-col items-center gap-2" role="status">
              <Loader2 className="animate-spin text-orange-500" size={24} />
              {t('loading_history')}
            </div>
          ) : showHistoryError ? (
            <div className="p-12 text-center text-gray-500 space-y-4">
              <p>{t('deploy_load_error')}</p>
              <button
                type="button"
                onClick={() => onRefreshDeployments(selectedProject.name)}
                className="text-sm px-4 py-2 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                {t('refresh_list')}
              </button>
            </div>
          ) : (
            <div className="relative">
              {loadingDeployments && deployments.length > 0 && (
                <div
                  className="absolute inset-0 z-10 flex justify-center items-start pt-10 bg-white/60 backdrop-blur-[1px]"
                  aria-busy="true"
                  role="status"
                  aria-label={t('loading_history')}
                >
                  <Loader2 className="animate-spin text-orange-500" size={24} />
                </div>
              )}
              <DeploymentList
                deployments={deployments}
                deploymentsHasMore={deploymentsHasMore}
                loadingMore={loadingDeployments && deployments.length > 0}
                productionDeploymentId={productionDeploymentId}
                projectName={selectedProject.name}
                csrfToken={csrfToken}
                onConfirm={onConfirm}
                onNotify={onNotify}
                onDeletingChange={setIsDeleting}
                onRefresh={() => onRefreshDeployments(selectedProject.name)}
                onLoadMore={onLoadMoreDeployments}
              />
            </div>
          )}
        </div>

        {activeTab === 'domains' && (
          <div role="tabpanel" id="project-panel-domains" aria-labelledby="project-tab-domains">
            <DomainsTab
              project={selectedProject}
              csrfToken={csrfToken}
              onConfirm={onConfirm}
              onNotify={onNotify}
            />
          </div>
        )}

        {activeTab === 'upload' && (
          <div role="tabpanel" id="project-panel-upload" aria-labelledby="project-tab-upload">
            <UploadTab
              project={selectedProject}
              csrfToken={csrfToken}
              onNotify={onNotify}
              onUploadSuccess={onUploadSuccess}
            />
          </div>
        )}

        {activeTab === 'settings' && (
          <div role="tabpanel" id="project-panel-settings" aria-labelledby="project-tab-settings">
            <SettingsTab
              project={selectedProject}
              csrfToken={csrfToken}
              onNotify={onNotify}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectDetailView;
