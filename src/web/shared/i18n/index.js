import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

const resources = {
  es: {
    translation: {
      loading: 'Cargando...',
      save: 'Guardar',
      cancel: 'Cancelar',
      confirm: 'Confirmar',
      delete: 'Eliminar',
      add: 'Agregar',
      actions: 'Acciones',
      unknown: 'Desconocido',

      logout: 'Salir',
      logout_error: 'No se pudo cerrar la sesión.',

      status_success: 'Exitoso',
      status_failure: 'Fallido',
      status_pending: 'Pendiente',
      status_active: 'Activo',

      create_project_btn: 'Crear nuevo proyecto',
      refresh_list: 'Refrescar lista',
      project_list_error: 'No se pudieron cargar los proyectos.',

      back_to_list: 'Volver',
      visit_site: 'Visitar',
      deploy_prod_btn: 'Desplegar Producción',
      deploying_btn: 'Desplegando...',
      deploy_success: '¡Nuevo despliegue iniciado exitosamente!',
      deploy_error: 'Hubo un error al iniciar el despliegue.',
      deploy_load_error: 'No se pudieron cargar los despliegues.',

      tab_deployments: 'Despliegues',
      tab_domains: 'Dominios',
      tab_upload: 'Subir Archivos',
      tab_settings: 'Configuración',

      new_project_title: 'Nuevo Proyecto',
      project_name_label: 'Nombre del Proyecto',
      project_create_hint: 'Se creará como "Direct Upload" en Cloudflare Pages.',
      create_btn: 'Crear Proyecto',
      create_success: 'Proyecto creado exitosamente',
      create_error: 'Error al crear proyecto. Verifica el nombre.',

      no_domain: 'Sin dominio',
      source_label: 'Origen',
      unknown_repo: 'Repo desconocido',
      direct_upload: 'Direct Upload',

      history_title: 'Historial de Despliegues',
      results_count: 'resultados',
      manual_deploy: 'Despliegue manual',
      no_history: 'No hay historial de despliegues disponible.',
      loading_history: 'Cargando historial...',
      view_deploy: 'Ver este despliegue',
      no_deployments: 'No hay despliegues disponibles.',

      delete_selected: 'Eliminar seleccionados ({{count}})',
      selected_count: '{{count}} seleccionados',
      select_all: 'Seleccionar todo',
      delete_all_non_prod: 'Eliminar todo excepto producción',
      delete_all_history: 'Eliminar TODO el historial',
      confirm_delete_selected: '¿Estás seguro de que quieres eliminar {{count}} despliegues?',
      confirm_delete_selected_title: 'Eliminar despliegues seleccionados',
      confirm_delete_all: '⚠️ ACCIÓN CRÍTICA\n\nEsto eliminará TODOS los despliegues anteriores excepto el que está actualmente en producción.\nEsta acción no se puede deshacer.\n\n¿Estás completamente seguro?',
      confirm_delete_all_title: 'Eliminar historial de despliegues',
      deleting_msg: 'Eliminando...',
      deploy_delete_success: 'Se eliminaron {{count}} despliegues.',
      deploy_delete_partial: 'Se eliminaron {{success}} despliegues, pero {{failed}} fallaron.',
      deploy_delete_none: 'No hay despliegues para eliminar.',
      deploy_delete_error: 'No se pudieron eliminar los despliegues.',

      build_config_title: 'Configuración de Build',
      build_command_label: 'Comando de Build',
      output_dir_label: 'Directorio de Salida',
      loading_config: 'Cargando configuración...',
      config_saved: 'Build config guardada',
      config_load_error: 'No se pudo cargar la configuración del proyecto.',
      config_save_error: 'Error al guardar',

      domains_title: 'Dominios Personalizados',
      no_domains: 'No hay dominios configurados.',
      domain_placeholder: 'ejemplo.com',
      confirm_delete_domain: '¿Eliminar {{domain}}?',
      confirm_delete_domain_title: 'Eliminar dominio',
      domains_load_error: 'No se pudieron cargar los dominios.',
      domain_add_success: 'Dominio agregado correctamente.',
      domain_delete_success: 'Dominio eliminado correctamente.',
      error_add_domain: 'Error al agregar dominio',
      error_delete_domain: 'Error al eliminar',

      upload_title: 'Subir Archivos (Direct Upload)',
      drop_hint: 'Haz clic para seleccionar un archivo .ZIP',
      drop_subhint: 'Solo archivos .zip',
      upload_btn: 'Desplegar',
      upload_success_msg: '¡Despliegue completado con éxito!',
      upload_zip_only: 'Solo se permiten archivos .zip.',
      upload_error_msg: 'Error al subir archivos. Verifica tu ZIP.',

      tip_me: 'Tip me',
    },
  },
  en: {
    translation: {
      loading: 'Loading...',
      save: 'Save',
      cancel: 'Cancel',
      confirm: 'Confirm',
      delete: 'Delete',
      add: 'Add',
      actions: 'Actions',
      unknown: 'Unknown',

      logout: 'Logout',
      logout_error: 'Could not log out.',

      status_success: 'Success',
      status_failure: 'Failed',
      status_pending: 'Pending',
      status_active: 'Active',

      create_project_btn: 'Create New Project',
      refresh_list: 'Refresh List',
      project_list_error: 'Could not load projects.',

      back_to_list: 'Back',
      visit_site: 'Visit',
      deploy_prod_btn: 'Deploy Production',
      deploying_btn: 'Deploying...',
      deploy_success: 'New deployment started successfully!',
      deploy_error: 'There was an error triggering the deployment.',
      deploy_load_error: 'Could not load deployments.',

      tab_deployments: 'Deployments',
      tab_domains: 'Domains',
      tab_upload: 'Upload Files',
      tab_settings: 'Settings',

      new_project_title: 'New Project',
      project_name_label: 'Project Name',
      project_create_hint: 'Will be created as "Direct Upload" in Cloudflare Pages.',
      create_btn: 'Create Project',
      create_success: 'Project created successfully',
      create_error: 'Error creating project. Check the name.',

      no_domain: 'No domain',
      source_label: 'Source',
      unknown_repo: 'Unknown repo',
      direct_upload: 'Direct Upload',

      history_title: 'Deployment History',
      results_count: 'results',
      manual_deploy: 'Manual deployment',
      no_history: 'No deployment history available.',
      loading_history: 'Loading history...',
      view_deploy: 'View this deployment',
      no_deployments: 'No deployments available.',

      delete_selected: 'Delete selected ({{count}})',
      selected_count: '{{count}} selected',
      select_all: 'Select all',
      delete_all_non_prod: 'Delete all except production',
      delete_all_history: 'Delete ALL history',
      confirm_delete_selected: 'Are you sure you want to delete {{count}} deployments?',
      confirm_delete_selected_title: 'Delete selected deployments',
      confirm_delete_all: '⚠️ CRITICAL ACTION\n\nThis will delete ALL previous deployments except the one currently in production.\nThis action cannot be undone.\n\nAre you completely sure?',
      confirm_delete_all_title: 'Delete deployment history',
      deleting_msg: 'Deleting...',
      deploy_delete_success: 'Deleted {{count}} deployments.',
      deploy_delete_partial: 'Deleted {{success}} deployments, but {{failed}} failed.',
      deploy_delete_none: 'There are no deployments to delete.',
      deploy_delete_error: 'Could not delete deployments.',

      build_config_title: 'Build Configuration',
      build_command_label: 'Build Command',
      output_dir_label: 'Output Directory',
      loading_config: 'Loading configuration...',
      config_saved: 'Build config saved',
      config_load_error: 'Could not load project configuration.',
      config_save_error: 'Error saving config',

      domains_title: 'Custom Domains',
      no_domains: 'No domains configured.',
      domain_placeholder: 'example.com',
      confirm_delete_domain: 'Delete {{domain}}?',
      confirm_delete_domain_title: 'Delete domain',
      domains_load_error: 'Could not load domains.',
      domain_add_success: 'Domain added successfully.',
      domain_delete_success: 'Domain deleted successfully.',
      error_add_domain: 'Error adding domain',
      error_delete_domain: 'Error deleting domain',

      upload_title: 'Upload Files (Direct Upload)',
      drop_hint: 'Click to select a .ZIP file',
      drop_subhint: 'Only .zip files',
      upload_btn: 'Deploy',
      upload_success_msg: 'Deployment completed successfully!',
      upload_zip_only: 'Only .zip files are allowed.',
      upload_error_msg: 'Error uploading files. Check your ZIP.',

      tip_me: 'Tip me',
    },
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'es',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
