import { beforeEach, describe, expect, it } from 'vitest';
import { EasyPagesApiError } from '../../../api/client/easyPagesApi.js';
import i18n from './index.js';
import { dashboardErrorMessage } from './dashboardErrors.js';

describe('dashboardErrorMessage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('es');
  });

  it('uses the fallback key when the code is unknown, not the English message', () => {
    const error = new EasyPagesApiError('Error loading projects.', { code: 'REQUEST_FAILED' });
    expect(dashboardErrorMessage(error, 'project_list_error', i18n.t.bind(i18n))).toBe(
      'No se pudieron cargar los proyectos.',
    );
  });

  it('translates a mapped Cloudflare code', () => {
    const error = new EasyPagesApiError('Timed out connecting to Cloudflare', { code: 'cf_timeout' });
    expect(dashboardErrorMessage(error, 'project_list_error', i18n.t.bind(i18n))).toBe(
      'Se agotó el tiempo de espera al conectar con Cloudflare.',
    );
  });

  it('interpolates retry seconds for a dashboard rate limit', () => {
    const error = new EasyPagesApiError('Too many requests.', {
      code: 'rate_limited',
      retryAfter: 42,
    });
    expect(dashboardErrorMessage(error, 'create_error', i18n.t.bind(i18n))).toBe(
      'Demasiadas peticiones. Inténtalo de nuevo en 42 segundos.',
    );
  });
});
