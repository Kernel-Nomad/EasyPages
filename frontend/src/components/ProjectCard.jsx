import React from 'react';
import { Box, GitBranch, Globe, HardDrive } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import StatusBadge from './ui/StatusBadge';

const ProjectCard = ({ project, onClick }) => {
  const { t } = useTranslation();
  
  const source = project.source || {};
  const latestDeployment = project.latest_deployment || { status: 'unknown' };
  
  const isGithub = source.type === 'github';
  const isDirectUpload = !source.type || source.type === 'direct_upload';

  return (
    <div 
      onClick={() => onClick(project)}
      className="group bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg hover:border-orange-300 transition-all cursor-pointer relative overflow-hidden h-full flex flex-col"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600">
            <Box size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 group-hover:text-orange-600 transition-colors">
              {project.name}
            </h3>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              {isGithub ? <GitBranch size={12} /> : <Globe size={12} />}
              {project.subdomain || t('no_domain')}
            </p>
          </div>
        </div>
        <StatusBadge status={latestDeployment.status} />
      </div>
      
      <div className="space-y-2 pt-4 border-t border-gray-100 mt-auto">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">{t('source_label')}</span>
          <span className="text-gray-700 truncate max-w-[150px] flex items-center gap-1">
            {isGithub ? (
                <>
                    <GitBranch size={12} />
                    {source.repo || t('unknown_repo')}
                </>
            ) : (
                <>
                    <HardDrive size={12} />
                    {t('direct_upload')}
                </>
            )}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ProjectCard;
