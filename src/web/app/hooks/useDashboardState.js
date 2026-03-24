import { useEffect, useRef, useState } from 'react';
import { easyPagesClient } from '../../../api/client/easyPagesApi.js';

/** Delay before re-fetching deployments so Cloudflare can register the new deployment. */
const DEPLOYMENTS_LIST_REFRESH_DELAY_MS = 2000;

export const useDashboardState = ({ csrfToken, isSecurityError, onNotify, t }) => {
  const [view, setView] = useState('list');
  const [selectedProject, setSelectedProject] = useState(null);
  const [activeTab, setActiveTab] = useState('deployments');
  const [projects, setProjects] = useState([]);
  const [deployments, setDeployments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingDeployments, setLoadingDeployments] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [creating, setCreating] = useState(false);
  const deploymentsAbortControllerRef = useRef(null);
  const deploymentsRefreshTimeoutRef = useRef(null);

  const clearScheduledDeploymentsRefresh = () => {
    if (deploymentsRefreshTimeoutRef.current) {
      clearTimeout(deploymentsRefreshTimeoutRef.current);
      deploymentsRefreshTimeoutRef.current = null;
    }
  };

  const loadProjects = async () => {
    setLoading(true);

    try {
      const data = await easyPagesClient.fetchProjects();
      setProjects(data);
    } catch (error) {
      if (!isSecurityError(error)) {
        console.error(error);
        onNotify('error', error.message || t('project_list_error'));
      }
    } finally {
      setLoading(false);
    }
  };

  const loadDeployments = async (projectName, { signal } = {}) => {
    setLoadingDeployments(true);

    try {
      const data = await easyPagesClient.fetchDeployments(projectName, { signal });
      if (signal?.aborted) {
        return;
      }
      setDeployments(data);
    } catch (error) {
      if (error?.name === 'AbortError') {
        return;
      }
      if (!isSecurityError(error)) {
        console.error('Error cargando despliegues:', error);
        onNotify('error', error.message || t('deploy_load_error'));
      }
    } finally {
      if (!signal?.aborted) {
        setLoadingDeployments(false);
      }
    }
  };

  useEffect(() => {
    if (selectedProject && view === 'detail') {
      deploymentsAbortControllerRef.current?.abort();
      const nextController = new AbortController();
      deploymentsAbortControllerRef.current = nextController;
      loadDeployments(selectedProject.name, { signal: nextController.signal });

      return () => {
        nextController.abort();
        if (deploymentsAbortControllerRef.current === nextController) {
          deploymentsAbortControllerRef.current = null;
        }
      };
    }
    return undefined;
  }, [selectedProject, view]);

  useEffect(() => () => {
    deploymentsAbortControllerRef.current?.abort();
    clearScheduledDeploymentsRefresh();
  }, []);

  const handleTriggerDeploy = async () => {
    if (!selectedProject) {
      return;
    }
    const projectName = selectedProject.name;

    setIsDeploying(true);

    try {
      await easyPagesClient.triggerDeployment({
        projectName,
        csrfToken,
      });

      onNotify('success', t('deploy_success'));
      clearScheduledDeploymentsRefresh();
      deploymentsRefreshTimeoutRef.current = setTimeout(() => {
        loadDeployments(projectName);
      }, DEPLOYMENTS_LIST_REFRESH_DELAY_MS);
    } catch (error) {
      if (!isSecurityError(error)) {
        onNotify('error', error.message || t('deploy_error'));
      }
    } finally {
      setIsDeploying(false);
    }
  };

  const handleCreateProject = async (event) => {
    event.preventDefault();
    setCreating(true);

    try {
      await easyPagesClient.createProject({
        csrfToken,
        name: newProjectName,
      });

      onNotify('success', t('create_success'));
      setShowCreateModal(false);
      setNewProjectName('');
      await loadProjects();
    } catch (error) {
      if (!isSecurityError(error)) {
        onNotify('error', error.message || t('create_error'));
      }
    } finally {
      setCreating(false);
    }
  };

  const handleProjectClick = (project) => {
    setSelectedProject(project);
    setView('detail');
    setActiveTab('deployments');
  };

  const handleBack = () => {
    clearScheduledDeploymentsRefresh();
    setSelectedProject(null);
    setView('list');
    setDeployments([]);
  };

  const handleUploadSuccess = () => {
    if (!selectedProject) {
      return;
    }

    clearScheduledDeploymentsRefresh();
    loadDeployments(selectedProject.name);
    setActiveTab('deployments');
    onNotify('success', t('upload_success_msg'));
  };

  return {
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
  };
};
