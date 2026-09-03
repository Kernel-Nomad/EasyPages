import { useEffect, useRef, useState } from 'react';
import { easyPagesClient } from '../../../api/client/easyPagesApi.js';
import { dashboardErrorMessage } from '../../shared/i18n/dashboardErrors.js';

/** Delay before re-fetching deployments so Cloudflare can register the new deployment. */
const DEPLOYMENTS_LIST_REFRESH_DELAY_MS = 2000;

export const useDashboardState = ({ csrfToken, isSecurityError, onNotify, sessionActive, t }) => {
  const [view, setView] = useState('list');
  const [selectedProject, setSelectedProject] = useState(null);
  const [activeTab, setActiveTab] = useState('deployments');
  const [projects, setProjects] = useState([]);
  const [projectsLoadError, setProjectsLoadError] = useState(false);
  const [deployments, setDeployments] = useState([]);
  const [deploymentsLoadError, setDeploymentsLoadError] = useState(false);
  const [productionDeploymentId, setProductionDeploymentId] = useState(null);
  const [deploymentsPage, setDeploymentsPage] = useState(1);
  const [deploymentsHasMore, setDeploymentsHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingDeployments, setLoadingDeployments] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const deploymentsAbortControllerRef = useRef(null);
  const deploymentsRefreshTimeoutRef = useRef(null);
  const deploymentsGenerationRef = useRef(0);
  const projectsGenerationRef = useRef(0);

  const clearScheduledDeploymentsRefresh = () => {
    if (deploymentsRefreshTimeoutRef.current) {
      clearTimeout(deploymentsRefreshTimeoutRef.current);
      deploymentsRefreshTimeoutRef.current = null;
    }
  };

  const loadProjects = async () => {
    const generation = projectsGenerationRef.current + 1;
    projectsGenerationRef.current = generation;
    setLoading(true);
    setProjectsLoadError(false);

    try {
      const data = await easyPagesClient.fetchProjects();
      if (generation !== projectsGenerationRef.current) {
        return;
      }
      setProjects(data);
    } catch (error) {
      if (generation !== projectsGenerationRef.current) {
        return;
      }
      if (!isSecurityError(error)) {
        console.error(error);
        setProjectsLoadError(true);
        onNotify('error', dashboardErrorMessage(error, 'project_list_error', t));
      }
    } finally {
      if (generation === projectsGenerationRef.current) {
        setLoading(false);
      }
    }
  };

  const loadDeployments = async (projectName, { append = false, page = 1, signal } = {}) => {
    const generation = deploymentsGenerationRef.current;
    setLoadingDeployments(true);
    if (!append) {
      setDeploymentsLoadError(false);
    }

    try {
      const data = await easyPagesClient.fetchDeployments(projectName, { page, signal });
      if (signal?.aborted || generation !== deploymentsGenerationRef.current) {
        return;
      }

      const nextDeployments = data?.deployments || [];
      setDeployments((current) => (append ? [...current, ...nextDeployments] : nextDeployments));
      setProductionDeploymentId(data?.productionDeploymentId ?? null);
      setDeploymentsPage(data?.page || page);
      setDeploymentsHasMore(Boolean(data?.hasMore));
      setDeploymentsLoadError(false);
    } catch (error) {
      if (error?.name === 'AbortError') {
        return;
      }
      if (generation !== deploymentsGenerationRef.current) {
        return;
      }
      if (!append) {
        setDeploymentsLoadError(true);
      }
      if (!isSecurityError(error)) {
        console.error('Error loading deployments:', error);
        onNotify('error', dashboardErrorMessage(error, 'deploy_load_error', t));
      }
    } finally {
      if (!signal?.aborted && generation === deploymentsGenerationRef.current) {
        setLoadingDeployments(false);
      }
    }
  };

  const loadMoreDeployments = async () => {
    if (!selectedProject || !deploymentsHasMore || loadingDeployments) {
      return;
    }

    deploymentsAbortControllerRef.current?.abort();
    const nextController = new AbortController();
    deploymentsAbortControllerRef.current = nextController;

    await loadDeployments(selectedProject.name, {
      append: true,
      page: deploymentsPage + 1,
      signal: nextController.signal,
    });
  };

  useEffect(() => {
    if (selectedProject && view === 'detail') {
      clearScheduledDeploymentsRefresh();
      deploymentsGenerationRef.current += 1;
      deploymentsAbortControllerRef.current?.abort();
      const nextController = new AbortController();
      deploymentsAbortControllerRef.current = nextController;
      setDeployments([]);
      setDeploymentsLoadError(false);
      setProductionDeploymentId(null);
      setDeploymentsPage(1);
      setDeploymentsHasMore(false);
      loadDeployments(selectedProject.name, { signal: nextController.signal });

      return () => {
        nextController.abort();
        if (deploymentsAbortControllerRef.current === nextController) {
          deploymentsAbortControllerRef.current = null;
        }
      };
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadDeployments is recreated each render
  }, [selectedProject, view]);

  useEffect(() => () => {
    deploymentsAbortControllerRef.current?.abort();
    clearScheduledDeploymentsRefresh();
  }, []);

  useEffect(() => {
    if (sessionActive) {
      return undefined;
    }
    clearScheduledDeploymentsRefresh();
    deploymentsGenerationRef.current += 1;
    projectsGenerationRef.current += 1;
    deploymentsAbortControllerRef.current?.abort();
    setView('list');
    setSelectedProject(null);
    setActiveTab('deployments');
    setProjects([]);
    setProjectsLoadError(false);
    setDeployments([]);
    setDeploymentsLoadError(false);
    setProductionDeploymentId(null);
    setDeploymentsPage(1);
    setDeploymentsHasMore(false);
    setLoading(true);
    setLoadingDeployments(false);
    setIsDeploying(false);
    setShowCreateModal(false);
    setNewProjectName('');
    setCreating(false);
    setCreateError(null);
    return undefined;
  }, [sessionActive]);

  const beginDeploymentsFetch = (projectName, { append = false, page = 1 } = {}) => {
    clearScheduledDeploymentsRefresh();
    deploymentsGenerationRef.current += 1;
    deploymentsAbortControllerRef.current?.abort();
    const nextController = new AbortController();
    deploymentsAbortControllerRef.current = nextController;
    return loadDeployments(projectName, { append, page, signal: nextController.signal });
  };

  const handleTriggerDeploy = async () => {
    if (!selectedProject) {
      return;
    }
    const projectName = selectedProject.name;
    const generationAtTrigger = deploymentsGenerationRef.current;

    setIsDeploying(true);

    try {
      await easyPagesClient.triggerDeployment({
        projectName,
        csrfToken,
      });

      onNotify('success', t('deploy_success'));
      clearScheduledDeploymentsRefresh();
      deploymentsRefreshTimeoutRef.current = setTimeout(() => {
        if (generationAtTrigger !== deploymentsGenerationRef.current) {
          return;
        }
        beginDeploymentsFetch(projectName);
      }, DEPLOYMENTS_LIST_REFRESH_DELAY_MS);
    } catch (error) {
      if (!isSecurityError(error)) {
        onNotify('error', dashboardErrorMessage(error, 'deploy_error', t));
      }
    } finally {
      setIsDeploying(false);
    }
  };

  const handleCreateProject = async (event) => {
    event.preventDefault();
    setCreating(true);
    setCreateError(null);

    try {
      await easyPagesClient.createProject({
        csrfToken,
        name: newProjectName,
      });

      onNotify('success', t('create_success'));
      setShowCreateModal(false);
      setNewProjectName('');
      setCreateError(null);
      await loadProjects();
    } catch (error) {
      if (!isSecurityError(error)) {
        const message = dashboardErrorMessage(error, 'create_error', t);
        setCreateError(message);
        onNotify('error', message);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleProjectClick = (project) => {
    clearScheduledDeploymentsRefresh();
    deploymentsGenerationRef.current += 1;
    deploymentsAbortControllerRef.current?.abort();
    setSelectedProject(project);
    setView('detail');
    setActiveTab('deployments');
  };

  const handleBack = () => {
    clearScheduledDeploymentsRefresh();
    deploymentsGenerationRef.current += 1;
    deploymentsAbortControllerRef.current?.abort();
    setSelectedProject(null);
    setView('list');
    setDeployments([]);
    setDeploymentsLoadError(false);
    setProductionDeploymentId(null);
    setDeploymentsPage(1);
    setDeploymentsHasMore(false);
    setIsDeploying(false);
  };

  const handleUploadSuccess = () => {
    if (!selectedProject) {
      return;
    }

    beginDeploymentsFetch(selectedProject.name);
    setActiveTab('deployments');
    onNotify('success', t('upload_success_msg'));
  };

  const openCreateModal = () => {
    setCreateError(null);
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    if (creating) {
      return;
    }
    setShowCreateModal(false);
    setCreateError(null);
  };

  return {
    activeTab,
    beginDeploymentsFetch,
    createError,
    creating,
    deployments,
    deploymentsHasMore,
    deploymentsLoadError,
    handleBack,
    handleCreateProject,
    handleProjectClick,
    handleTriggerDeploy,
    handleUploadSuccess,
    isDeploying,
    loadMoreDeployments,
    loadProjects,
    loading,
    loadingDeployments,
    newProjectName,
    openCreateModal,
    closeCreateModal,
    productionDeploymentId,
    projects,
    projectsLoadError,
    selectedProject,
    setActiveTab,
    setNewProjectName,
    setShowCreateModal,
    showCreateModal,
    view,
  };
};
