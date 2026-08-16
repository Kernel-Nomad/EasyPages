import { Box, GitBranch, Globe, HardDrive } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import StatusBadge from '../../../shared/ui/StatusBadge';

const isGitSource = (source) => {
  const type = typeof source?.type === 'string' ? source.type.toLowerCase() : '';
  return type === 'github' || type === 'gitlab';
};

const ProjectCard = ({ project, onClick }) => {
  const { t } = useTranslation();

  const source = project.source || {};
  const latestDeployment = project.latest_deployment || { status: 'unknown' };
  const isGit = isGitSource(source);

  return (
    <button
      type="button"
      onClick={() => onClick(project)}
      aria-label={project.name}
      className="group bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg hover:border-orange-300 transition-all cursor-pointer relative overflow-hidden h-full flex flex-col text-left w-full"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600">
            <Box size={20} aria-hidden="true" />
          </div>
          <div>
            <span className="font-semibold text-gray-900 group-hover:text-orange-600 transition-colors block">
              {project.name}
            </span>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              {isGit ? <GitBranch size={12} aria-hidden="true" /> : <Globe size={12} aria-hidden="true" />}
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
            {isGit ? (
              <>
                <GitBranch size={12} aria-hidden="true" />
                {source.repo || t('unknown_repo')}
              </>
            ) : (
              <>
                <HardDrive size={12} aria-hidden="true" />
                {t('direct_upload')}
              </>
            )}
          </span>
        </div>
      </div>
    </button>
  );
};

export default ProjectCard;
