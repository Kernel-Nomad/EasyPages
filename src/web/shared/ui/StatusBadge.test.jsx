import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n';
import StatusBadge from './StatusBadge.jsx';
import ProjectCard from '../../features/projects/components/ProjectCard.jsx';

const wrap = (ui) => render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);

describe('StatusBadge', () => {
  it('maps Cloudflare stage statuses', async () => {
    await i18n.changeLanguage('en');
    const { rerender } = wrap(<StatusBadge status="success" />);
    expect(screen.getByText('Success')).toBeInTheDocument();

    rerender(
      <I18nextProvider i18n={i18n}>
        <StatusBadge status="active" />
      </I18nextProvider>,
    );
    expect(screen.getByText('In progress')).toBeInTheDocument();

    rerender(
      <I18nextProvider i18n={i18n}>
        <StatusBadge status="canceled" />
      </I18nextProvider>,
    );
    expect(screen.getByText('Canceled')).toBeInTheDocument();

    rerender(
      <I18nextProvider i18n={i18n}>
        <StatusBadge status="idle" />
      </I18nextProvider>,
    );
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });
});

describe('ProjectCard', () => {
  it('shows github owner/repo from mapped source and latest_stage status', async () => {
    await i18n.changeLanguage('en');
    wrap(
      <ProjectCard
        project={{
          name: 'demo',
          subdomain: 'demo.pages.dev',
          source: { type: 'github', repo: 'acme/demo' },
          latest_deployment: { status: 'success' },
        }}
        onClick={() => {}}
      />,
    );

    expect(screen.getByText('acme/demo')).toBeInTheDocument();
    expect(screen.getByText('Success')).toBeInTheDocument();
  });

  it('treats gitlab like git-connected (not Direct Upload)', async () => {
    await i18n.changeLanguage('en');
    wrap(
      <ProjectCard
        project={{
          name: 'gitlab-site',
          subdomain: 'gitlab-site.pages.dev',
          source: { type: 'gitlab', repo: 'acme/gitlab-site' },
          latest_deployment: { status: 'failure' },
        }}
        onClick={() => {}}
      />,
    );

    expect(screen.getByText('acme/gitlab-site')).toBeInTheDocument();
    expect(screen.queryByText('Direct Upload')).not.toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });
});
