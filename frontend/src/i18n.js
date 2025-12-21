import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  es: {
    translation: {
      loading: "Cargando...",
      save: "Guardar",
      cancel: "Cancelar",
      delete: "Eliminar",
      add: "Agregar",
      actions: "Acciones",
      unknown: "Desconocido",
      
      logout: "Salir",
      
      status_success: "Exitoso",
      status_failure: "Fallido",
      status_pending: "Pendiente",
      status_active: "Activo",
      
      create_project_btn: "Crear nuevo proyecto",
      refresh_list: "Refrescar lista",
      project_list_error: "No se pudieron cargar los proyectos.",
      
      back_to_list: "Volver",
      visit_site: "Visitar",
      deploy_prod_btn: "Desplegar Producción",
      deploying_btn: "Desplegando...",
      deploy_success: "¡Nuevo despliegue iniciado exitosamente!",
      deploy_error: "Hubo un error al iniciar el despliegue.",
      
      tab_deployments: "Despliegues",
      tab_domains: "Dominios",
      tab_upload: "Subir Archivos",
      tab_settings: "Configuración",
      
      new_project_title: "Nuevo Proyecto",
      project_name_label: "Nombre del Proyecto",
      project_create_hint: "Se creará como \"Direct Upload\" en Cloudflare Pages.",
      create_btn: "Crear Proyecto",
      create_success: "Proyecto creado exitosamente",
      create_error: "Error al crear proyecto. Verifica el nombre.",
      
      no_domain: "Sin dominio",
      source_label: "Origen",
      unknown_repo: "Repo desconocido",
      direct_upload: "Direct Upload",
      
      history_title: "Historial de Despliegues",
      results_count: "resultados",
      manual_deploy: "Despliegue manual",
      no_history: "No hay historial de despliegues disponible.",
      loading_history: "Cargando historial...",
      view_deploy: "Ver este despliegue",
      
      build_config_title: "Configuración de Build",
      build_command_label: "Comando de Build",
      output_dir_label: "Directorio de Salida",
      loading_config: "Cargando configuración...",
      config_saved: "Build config guardada",
      config_save_error: "Error al guardar",
      
      domains_title: "Dominios Personalizados",
      no_domains: "No hay dominios configurados.",
      domain_placeholder: "ejemplo.com",
      confirm_delete_domain: "¿Eliminar {{domain}}?",
      error_add_domain: "Error al agregar dominio",
      error_delete_domain: "Error al eliminar",
      
      upload_title: "Subir Archivos (Direct Upload)",
      drop_hint: "Haz clic para seleccionar un archivo .ZIP",
      drop_subhint: "Solo archivos comprimidos",
      upload_btn: "Desplegar",
      upload_success_msg: "¡Despliegue completado con éxito!",
      upload_error_msg: "Error al subir archivos. Verifica tu ZIP.",
      
      tip_me: "Tip me"
    }
  },
  en: {
    translation: {
      loading: "Loading...",
      save: "Save",
      cancel: "Cancel",
      delete: "Delete",
      add: "Add",
      actions: "Actions",
      unknown: "Unknown",
      
      logout: "Logout",
      
      status_success: "Success",
      status_failure: "Failed",
      status_pending: "Pending",
      status_active: "Active",
      
      create_project_btn: "Create New Project",
      refresh_list: "Refresh List",
      project_list_error: "Could not load projects.",
      
      back_to_list: "Back",
      visit_site: "Visit",
      deploy_prod_btn: "Deploy Production",
      deploying_btn: "Deploying...",
      deploy_success: "New deployment started successfully!",
      deploy_error: "There was an error triggering the deployment.",
      
      tab_deployments: "Deployments",
      tab_domains: "Domains",
      tab_upload: "Upload Files",
      tab_settings: "Settings",
      
      new_project_title: "New Project",
      project_name_label: "Project Name",
      project_create_hint: "Will be created as \"Direct Upload\" in Cloudflare Pages.",
      create_btn: "Create Project",
      create_success: "Project created successfully",
      create_error: "Error creating project. Check the name.",
      
      no_domain: "No domain",
      source_label: "Source",
      unknown_repo: "Unknown repo",
      direct_upload: "Direct Upload",
      
      history_title: "Deployment History",
      results_count: "results",
      manual_deploy: "Manual deployment",
      no_history: "No deployment history available.",
      loading_history: "Loading history...",
      view_deploy: "View this deployment",
      
      build_config_title: "Build Configuration",
      build_command_label: "Build Command",
      output_dir_label: "Output Directory",
      loading_config: "Loading configuration...",
      config_saved: "Build config saved",
      config_save_error: "Error saving config",
      
      domains_title: "Custom Domains",
      no_domains: "No domains configured.",
      domain_placeholder: "example.com",
      confirm_delete_domain: "Delete {{domain}}?",
      error_add_domain: "Error adding domain",
      error_delete_domain: "Error deleting domain",
      
      upload_title: "Upload Files (Direct Upload)",
      drop_hint: "Click to select a .ZIP file",
      drop_subhint: "Compressed files only",
      upload_btn: "Deploy",
      upload_success_msg: "Deployment completed successfully!",
      upload_error_msg: "Error uploading files. Check your ZIP.",
      
      tip_me: "Tip me"
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'es',
    interpolation: {
      escapeValue: false 
    }
  });

export default i18n;
