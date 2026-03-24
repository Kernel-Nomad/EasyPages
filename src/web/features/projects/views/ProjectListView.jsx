import React from 'react';
import { Loader2, Plus, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ProjectCard from '../components/ProjectCard';

const ProjectListView = ({ loading, projects, onCreateClick, onRefresh, onProjectClick }) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-row justify-between items-center gap-4">
        <button
          onClick={onCreateClick}
          className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm whitespace-nowrap"
        >
          <Plus size={18} />
          {t('create_project_btn')}
        </button>

        <button
          onClick={onRefresh}
          className="p-2 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
          title={t('refresh_list')}
        >
          <RefreshCw size={20} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-orange-500" size={32} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} onClick={onProjectClick} />
          ))}
        </div>
      )}
    </div>
  );
};

export default ProjectListView;
