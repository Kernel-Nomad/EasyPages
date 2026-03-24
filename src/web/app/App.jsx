import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { easyPagesClient } from '../../api/client/easyPagesApi.js';
import CreateProjectModal from '../features/projects/components/CreateProjectModal';
import ProjectDetailView from '../features/projects/views/ProjectDetailView';
import ProjectListView from '../features/projects/views/ProjectListView';
import Footer from '../shared/layout/Footer';
import ConfirmDialog from '../shared/ui/ConfirmDialog';
import NotificationToast from '../shared/ui/NotificationToast';
import AppHeader from './components/AppHeader';
import { isSecurityError, useCsrfSession } from './hooks/useCsrfSession';
import { useDashboardState } from './hooks/useDashboardState';

export default function App() {
  const { t, i18n } = useTranslation();
  const [notification, setNotification] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const { csrfToken, loadCsrfToken } = useCsrfSession();

  const showNotification = (type, message) => {
    setNotification({ type, message });
  };

  const {
    activeTab,
    creating,
    deployments,
    handleBack,
    handleCreateProject,
    handleProjectClick,
    handleTriggerDeploy,
    handleUploadSuccess,
    isDeploying,
    loadDeployments,
    loadProjects,
    loading,
    loadingDeployments,
    newProjectName,
    projects,
    selectedProject,
    setActiveTab,
    setNewProjectName,
    setShowCreateModal,
    showCreateModal,
    view,
  } = useDashboardState({
    csrfToken,
    isSecurityError,
    onNotify: showNotification,
    t,
  });

  const initializeApp = async () => {
    try {
      await loadCsrfToken();
      await loadProjects();
    } catch (error) {
      if (!isSecurityError(error)) {
        console.error('Error inicializando la aplicación', error);
        showNotification('error', error.message || t('project_list_error'));
      }
    }
  };

  useEffect(() => {
    initializeApp();
  }, []);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const requestConfirmation = (options) =>
    new Promise((resolve) => {
      setConfirmation({ ...options, resolve });
    });

  const closeConfirmation = (result) => {
    if (confirmation?.resolve) {
      confirmation.resolve(result);
    }
    setConfirmation(null);
  };

  const handleLogout = async () => {
    try {
      await easyPagesClient.logout(csrfToken);
      window.location.href = '/login';
    } catch (error) {
      if (!isSecurityError(error)) {
        console.error('Error al cerrar sesión', error);
        showNotification('error', error.message || t('logout_error'));
      }
    }
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'es' ? 'en' : 'es';
    i18n.changeLanguage(newLang);
  };

  const handleProjectSelection = (project) => {
    setNotification(null);
    handleProjectClick(project);
  };

  const handleBackToList = () => {
    setNotification(null);
    handleBack();
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 flex flex-col">
      <AppHeader
        language={i18n.language}
        onToggleLanguage={toggleLanguage}
        onLogout={handleLogout}
      />

      <NotificationToast notification={notification} onDismiss={() => setNotification(null)} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {view === 'list' && (
          <ProjectListView
            loading={loading}
            projects={projects}
            onCreateClick={() => setShowCreateModal(true)}
            onRefresh={loadProjects}
            onProjectClick={handleProjectSelection}
          />
        )}

        {view === 'detail' && selectedProject && (
          <ProjectDetailView
            selectedProject={selectedProject}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            loadingDeployments={loadingDeployments}
            deployments={deployments}
            csrfToken={csrfToken}
            isDeploying={isDeploying}
            onBack={handleBackToList}
            onConfirm={requestConfirmation}
            onNotify={showNotification}
            onTriggerDeploy={handleTriggerDeploy}
            onRefreshDeployments={loadDeployments}
            onUploadSuccess={handleUploadSuccess}
          />
        )}
      </main>

      <Footer />

      {showCreateModal && (
        <CreateProjectModal
          creating={creating}
          newProjectName={newProjectName}
          onClose={() => setShowCreateModal(false)}
          onNameChange={setNewProjectName}
          onSubmit={handleCreateProject}
        />
      )}

      <ConfirmDialog
        confirmation={confirmation}
        onCancel={() => closeConfirmation(false)}
        onConfirm={() => closeConfirmation(true)}
      />
    </div>
  );
}
