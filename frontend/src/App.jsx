import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Play, Clock, Settings, Loader2, Plus, ArrowLeft, ExternalLink, GitBranch, X, LogOut, Globe, RefreshCw, UploadCloud, Languages 
} from 'lucide-react';

import ProjectCard from './components/ProjectCard';
import DeploymentList from './components/DeploymentList';
import SettingsTab from './components/SettingsTab';
import DomainsTab from './components/DomainsTab';
import UploadTab from './components/UploadTab';
import Footer from './components/Footer';

export default function App() {
  const { t, i18n } = useTranslation();
  const [view, setView] = useState('list');
  const [selectedProject, setSelectedProject] = useState(null);
  const [activeTab, setActiveTab] = useState('deployments'); 
  
  const [projects, setProjects] = useState([]);
  const [deployments, setDeployments] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [loadingDeployments, setLoadingDeployments] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [notification, setNotification] = useState(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [creating, setCreating] = useState(false);
  
  const [csrfToken, setCsrfToken] = useState('');

  useEffect(() => {
    fetchCsrfToken().then(() => {
        fetchProjects();
    });
  }, []);

  useEffect(() => {
    if (selectedProject && view === 'detail') {
        fetchDeployments(selectedProject.name);
    }
  }, [selectedProject, view]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const fetchCsrfToken = async () => {
      try {
          const res = await fetch('/api/csrf-token');
          if (res.ok) {
              const data = await res.json();
              setCsrfToken(data.csrfToken);
          }
      } catch (e) {
          console.error("Error obteniendo CSRF token", e);
      }
  };

  const showNotification = (type, message) => {
    setNotification({ type, message });
  };

  const handleLogout = async () => {
    try {
      await fetch('/logout', { 
          method: 'POST',
          headers: { 'CSRF-Token': csrfToken }
      });
      window.location.href = '/login';
    } catch (error) {
      console.error("Error al cerrar sesión", error);
    }
  };

  const handleAuthError = (res) => {
    if (res.status === 401 || res.status === 403) {
        if (res.status === 403) fetchCsrfToken();
        else window.location.href = '/login';
        throw new Error('Sesión expirada o error de seguridad');
    }
    return res;
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'es' ? 'en' : 'es';
    i18n.changeLanguage(newLang);
  };

  const fetchProjects = async () => {
    setLoading(true);
    try {
        const res = await fetch('/api/projects').then(handleAuthError);
        if (!res.ok) throw new Error('Falló la carga');
        const data = await res.json();
        setProjects(data);
    } catch (error) {
        if (error.message !== 'Sesión expirada o error de seguridad') {
            console.error(error);
            showNotification('error', t('project_list_error'));
        }
    } finally {
        setLoading(false);
    }
  };

  const fetchDeployments = async (projectName) => {
    setLoadingDeployments(true);
    try {
        const res = await fetch(`/api/projects/${projectName}/deployments`).then(handleAuthError);
        if(!res.ok) throw new Error("Error al obtener despliegues");
        const data = await res.json();
        setDeployments(data);
    } catch (error) {
         if (error.message !== 'Sesión expirada o error de seguridad') {
            console.error("Error cargando despliegues:", error);
        }
    } finally {
        setLoadingDeployments(false);
    }
  };

  const triggerDeploy = async () => {
    if (!selectedProject) return;
    setIsDeploying(true);
    try {
        const res = await fetch(`/api/projects/${selectedProject.name}/deployments`, { 
            method: 'POST',
            headers: { 
                'CSRF-Token': csrfToken
            }
        }).then(handleAuthError);
        if (!res.ok) throw new Error('Error en despliegue');
        
        showNotification('success', t('deploy_success'));
        setTimeout(() => fetchDeployments(selectedProject.name), 2000);
    } catch (error) {
         if (error.message !== 'Sesión expirada o error de seguridad') {
            showNotification('error', t('deploy_error'));
        }
    } finally {
        setIsDeploying(false);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
        const res = await fetch('/api/projects', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'CSRF-Token': csrfToken
            },
            body: JSON.stringify({ name: newProjectName })
        }).then(handleAuthError);
        
        if (!res.ok) throw new Error("Error al crear");
        
        showNotification('success', t('create_success'));
        setShowCreateModal(false);
        setNewProjectName('');
        fetchProjects();
    } catch (error) {
        showNotification('error', t('create_error'));
    } finally {
        setCreating(false);
    }
  };

  const handleProjectClick = (project) => {
    setSelectedProject(project);
    setView('detail');
    setActiveTab('deployments');
    setNotification(null);
  };

  const handleBack = () => {
    setSelectedProject(null);
    setView('list');
    setDeployments([]);
    setNotification(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 flex flex-col">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="EasyPages Logo" className="w-8 h-8" />
            <h1 className="font-bold text-xl tracking-tight text-gray-900">
              Easy<span className="font-light text-gray-500">Pages</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
                onClick={toggleLanguage}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-orange-600 hover:bg-orange-50 px-3 py-2 rounded-lg transition-colors"
                title="Cambiar idioma / Change language"
            >
                <Languages size={18} />
                <span className="font-medium uppercase">{i18n.language}</span>
            </button>

            <button 
                onClick={handleLogout}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-orange-600 hover:bg-orange-50 px-3 py-2 rounded-lg transition-colors"
                title={t('logout')}
            >
                <span className="hidden sm:block font-medium">{t('logout')}</span>
                <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {notification && (
        <div className={`fixed top-20 right-4 z-50 p-4 rounded-lg shadow-lg border flex items-center gap-3 animate-in slide-in-from-right duration-300 max-w-sm ${
          notification.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className={`p-1 rounded-full ${notification.type === 'success' ? 'bg-emerald-100' : 'bg-red-100'}`}>
             {notification.type === 'success' ? <Play size={14} className="fill-current" /> : <X size={14} />}
          </div>
          <p className="text-sm font-medium">{notification.message}</p>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {view === 'list' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-row justify-between items-center gap-4">
              <button 
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm whitespace-nowrap"
              >
                  <Plus size={18} />
                  {t('create_project_btn')}
              </button>
              
              <button 
                onClick={fetchProjects} 
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
                  {projects.map(proj => (
                      <ProjectCard key={proj.id} project={proj} onClick={handleProjectClick} />
                  ))}
                </div>
            )}
          </div>
        )}

        {view === 'detail' && selectedProject && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={handleBack} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500" title={t('back_to_list')}>
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
                            onClick={triggerDeploy}
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
                    {[
                        { id: 'deployments', label: t('tab_deployments'), icon: Clock, show: true },
                        { id: 'domains', label: t('tab_domains'), icon: Globe, show: true },
                        { 
                            id: 'upload', 
                            label: t('tab_upload'), 
                            icon: UploadCloud, 
                            show: selectedProject.source?.type !== 'github' 
                        },
                        { id: 'settings', label: t('tab_settings'), icon: Settings, show: true },
                    ]
                    .filter(tab => tab.show)
                    .map((tab) => (
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
                    loadingDeployments 
                    ? <div className="p-10 text-center text-gray-500 flex flex-col items-center gap-2">
                        <Loader2 className="animate-spin text-orange-500" size={24} />
                        {t('loading_history')}
                      </div>
                    : <DeploymentList 
                        deployments={deployments} 
                        projectName={selectedProject.name} 
                        csrfToken={csrfToken}
                        onRefresh={() => fetchDeployments(selectedProject.name)}
                      />
                )}
                {activeTab === 'domains' && (
                    <DomainsTab project={selectedProject} csrfToken={csrfToken} />
                )}
                {activeTab === 'upload' && (
                    <UploadTab 
                        project={selectedProject} 
                        csrfToken={csrfToken}
                        onUploadSuccess={() => {
                            fetchDeployments(selectedProject.name);
                            setActiveTab('deployments');
                            showNotification('success', t('upload_success_msg'));
                        }}
                    />
                )}
                {activeTab === 'settings' && <SettingsTab project={selectedProject} csrfToken={csrfToken} />}
            </div>
          </div>
        )}
      </main>
      
      <Footer />

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4">{t('new_project_title')}</h3>
                <form onSubmit={handleCreateProject}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('project_name_label')}</label>
                            <input 
                                autoFocus
                                type="text" 
                                placeholder="mi-sitio-increible"
                                value={newProjectName}
                                onChange={e => setNewProjectName(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
                                required
                            />
                            <p className="text-xs text-gray-500 mt-1">{t('project_create_hint')}</p>
                        </div>
                        <div className="flex gap-3 justify-end pt-2">
                            <button 
                                type="button"
                                onClick={() => setShowCreateModal(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium"
                            >
                                {t('cancel')}
                            </button>
                            <button 
                                type="submit"
                                disabled={creating}
                                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                            >
                                {creating && <Loader2 size={16} className="animate-spin" />}
                                {t('create_btn')}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
      )}

    </div>
  );
}