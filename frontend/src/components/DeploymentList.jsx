import React from 'react';
import { GitBranch, Clock, ExternalLink, Hash } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import StatusBadge from './ui/StatusBadge';

const DeploymentItem = ({ deployment }) => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between p-4 hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors group">
      <div className="flex items-start gap-4">
        <div className={`mt-1.5 w-2.5 h-2.5 rounded-full ring-4 ring-opacity-20 ${
            deployment.status === 'success' ? 'bg-emerald-500 ring-emerald-500' : 
            deployment.status === 'active' ? 'bg-blue-500 ring-blue-500' : 'bg-red-500 ring-red-500'
        }`} />
        
        <div>
          <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-gray-900 text-sm">
                  {deployment.deployment_trigger?.metadata?.commit_message || deployment.message || t('manual_deploy')}
              </span>
          </div>
          
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
            <span className="flex items-center gap-1 bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
              <GitBranch size={10} />
              {deployment.deployment_trigger?.metadata?.branch || deployment.branch || 'main'}
            </span>
            
            <span className="flex items-center gap-1 font-mono">
              <Hash size={10} />
              {deployment.deployment_trigger?.metadata?.commit_hash?.substring(0,7) || deployment.commit_hash?.substring(0,7) || '----'}
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

const DeploymentList = ({ deployments }) => {
    const { t } = useTranslation();
    return (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden animate-in fade-in duration-300 shadow-sm">
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                <h3 className="font-semibold text-gray-800">{t('history_title')}</h3>
                <span className="text-xs text-gray-500">{deployments?.length || 0} {t('results_count')}</span>
            </div>
            <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                {Array.isArray(deployments) && deployments.length > 0 ? (
                    deployments.map(dep => (
                        <DeploymentItem key={dep.id} deployment={dep} />
                    ))
                ) : (
                    <div className="p-12 text-center text-gray-500 flex flex-col items-center gap-2">
                        <Clock size={32} className="text-gray-300" />
                        <p>{t('no_history')}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DeploymentList;
