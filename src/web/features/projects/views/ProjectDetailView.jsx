import React from 'react';
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
import { useTranslation } from 'react-i18next';
import DeploymentList from '../../deployments/views/DeploymentList';
import DomainsTab from '../../domains/views/DomainsTab';
import SettingsTab from '../../settings/views/SettingsTab';
import UploadTab from '../../uploads/views/UploadTab';

const ProjectDetailView = ({
  selectedProject,
  activeTab,
  setActiveTab,
  loadingDeployments,
  deployments,
  csrfToken,
  isDeploying,
  onBack,
  onConfirm,
  onNotify,
  onTriggerDeploy,
  onRefreshDeployments,
  onUploadSuccess,
}) => {
  const { t } = useTranslation();

  const tabs = [
    { id: 'deployments', label: t('tab_deployments'), icon: Clock, show: true },
    { id: 'domains', label: t('tab_domains'), icon: Globe, show: true },
    {
      id: 'upload',
      label: t('tab_upload'),
      icon: UploadCloud,
      show: selectedProject.source?.type !== 'github',
    },
    { id: 'settings', label: t('tab_settings'), icon: Settings, show: true },
  ].filter((tab) => tab.show);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500" title={t('back_to_list')}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-900">{selectedProject.name}</h2>
              <a
                href={`https://${selectedProject.subdomain}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-orange-600 hover:text-orange-800 bg-orange-50 px-2 py-0.5 rounded flex items-center gap-1"
              >
                {selectedProject.subdomain} <ExternalLink size={10} />
              </a>
            </div>
            <p className="text-sm text-gray-500 flex items-center gap-2 mt-1">
              {selectedProject.source?.type === 'github' && <GitBranch size={14} />}
              {selectedProject.source?.repo || t('direct_upload')}
            </p>
          </div>
        </div>

        {selectedProject.source?.type === 'github' && (
          <div className="flex gap-2 items-center">
            <button
              onClick={onTriggerDeploy}
              disabled={isDeploying}
              className="flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed group relative"
            >
              {isDeploying ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} className="fill-current" />}
              <span>
                {isDeploying ? t('deploying_btn') : t('deploy_prod_btn')}
              </span>
            </button>
          </div>
        )}
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="min-h-[400px]">
        {activeTab === 'deployments' && (
          loadingDeployments && deployments.length === 0 ? (
            <div className="p-10 text-center text-gray-500 flex flex-col items-center gap-2">
              <Loader2 className="animate-spin text-orange-500" size={24} />
              {t('loading_history')}
            </div>
          ) : (
            <div className="relative">
              {loadingDeployments && deployments.length > 0 && (
                <div
                  className="absolute inset-0 z-10 flex justify-center items-start pt-10 bg-white/60 backdrop-blur-[1px]"
                  aria-busy="true"
                  aria-label={t('loading_history')}
                >
                  <Loader2 className="animate-spin text-orange-500" size={24} />
                </div>
              )}
              <DeploymentList
                deployments={deployments}
                projectName={selectedProject.name}
                csrfToken={csrfToken}
                onConfirm={onConfirm}
                onNotify={onNotify}
                onRefresh={() => onRefreshDeployments(selectedProject.name)}
              />
            </div>
          )
        )}

        {activeTab === 'domains' && (
          <DomainsTab
            project={selectedProject}
            csrfToken={csrfToken}
            onConfirm={onConfirm}
            onNotify={onNotify}
          />
        )}

        {activeTab === 'upload' && (
          <UploadTab
            project={selectedProject}
            csrfToken={csrfToken}
            onNotify={onNotify}
            onUploadSuccess={onUploadSuccess}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            project={selectedProject}
            csrfToken={csrfToken}
            onNotify={onNotify}
          />
        )}
      </div>
    </div>
  );
};

export default ProjectDetailView;
