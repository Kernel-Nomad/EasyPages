import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AccountModal from '../features/auth/components/AccountModal';
import AuthLayout from '../features/auth/components/AuthLayout';
import LoginView from '../features/auth/views/LoginView';
import OfflineView from '../features/auth/views/OfflineView';
import SetupView from '../features/auth/views/SetupView';
import CreateProjectModal from '../features/projects/components/CreateProjectModal';
import ProjectDetailView from '../features/projects/views/ProjectDetailView';
import ProjectListView from '../features/projects/views/ProjectListView';
import Footer from '../shared/layout/Footer';
import ConfirmDialog from '../shared/ui/ConfirmDialog';
import NotificationToast from '../shared/ui/NotificationToast';
import AppHeader from './components/AppHeader';
import { isSecurityError, useAuthSession } from './hooks/useAuthSession';
import { useDashboardState } from './hooks/useDashboardState';

export default function App() {
  const { t, i18n } = useTranslation();
  const [notification, setNotification] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const {
    authState,
    completeSetup,
    csrfToken,
    retryConnection,
    signIn,
    signOut,
    updateCredentials,
    username,
  } = useAuthSession();

  const showNotification = (type, message) => {
    setNotification({ type, message });
  };

  const {
    activeTab,
    creating,
    deployments,
    deploymentsHasMore,
    handleBack,
    handleCreateProject,
    handleProjectClick,
    handleTriggerDeploy,
    handleUploadSuccess,
    isDeploying,
    loadDeployments,
    loadMoreDeployments,
    loadProjects,
    loading,
    loadingDeployments,
    newProjectName,
    productionDeploymentId,
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

  // Gated on `ready`: unconditional, these calls fired on a fresh install and 401'd before
  // the wizard had been drawn. `loadProjects`/`t` are deliberately omitted: loadProjects is
  // recreated every render and would refetch in a loop.
  useEffect(() => {
    if (authState !== 'ready') {
      return;
    }
    loadProjects().catch((error) => {
      if (!isSecurityError(error)) {
        console.error('Error initialising the application', error);
        showNotification('error', error.message || t('project_list_error'));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: see comment above
  }, [authState]);

  useEffect(() => {
    document.documentElement.lang = i18n.language?.split('-')[0] ?? 'en';
  }, [i18n.language]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
    return undefined;
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

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'es' ? 'en' : 'es');
  };

  const handleLogout = async () => {
    setNotification(null);
    setShowAccountModal(false);
    try {
      await signOut();
    } catch (error) {
      if (!isSecurityError(error)) {
        console.error('Error signing out', error);
        showNotification('error', error.message || t('logout_error'));
      }
    }
  };

  const handleProjectSelection = (project) => {
    setNotification(null);
    handleProjectClick(project);
  };

  const handleBackToList = () => {
    setNotification(null);
    handleBack();
  };

  // Route gating without a router: the SPA asks /api/auth/status and draws accordingly.
  if (authState === 'loading') {
    return (
      <AuthLayout title={t('loading')} onToggleLanguage={toggleLanguage}>
        <div className="flex justify-center py-4" role="status" aria-label={t('loading')}>
          <Loader2 size={24} className="animate-spin text-orange-600" />
        </div>
      </AuthLayout>
    );
  }

  if (authState === 'offline') {
    return <OfflineView onRetry={retryConnection} onToggleLanguage={toggleLanguage} />;
  }

  if (authState === 'setup') {
    return <SetupView onSubmit={completeSetup} onToggleLanguage={toggleLanguage} />;
  }

  if (authState === 'login') {
    return <LoginView onSubmit={signIn} onToggleLanguage={toggleLanguage} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 flex flex-col">
      <AppHeader
        language={i18n.language}
        onToggleLanguage={toggleLanguage}
        onLogout={handleLogout}
        onOpenAccount={() => setShowAccountModal(true)}
        username={username}
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
            deploymentsHasMore={deploymentsHasMore}
            productionDeploymentId={productionDeploymentId}
            csrfToken={csrfToken}
            isDeploying={isDeploying}
            onBack={handleBackToList}
            onConfirm={requestConfirmation}
            onNotify={showNotification}
            onTriggerDeploy={handleTriggerDeploy}
            onRefreshDeployments={loadDeployments}
            onLoadMoreDeployments={loadMoreDeployments}
            onUploadSuccess={handleUploadSuccess}
          />
        )}
      </main>

      <Footer />

      {showAccountModal && (
        <AccountModal
          username={username}
          onClose={() => setShowAccountModal(false)}
          onSubmit={updateCredentials}
        />
      )}

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
