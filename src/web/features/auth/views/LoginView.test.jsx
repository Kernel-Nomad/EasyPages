import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from '../../../shared/i18n';
import { EasyPagesApiError } from '../../../../api/client/easyPagesApi.js';
import LoginView from './LoginView';

const fillAndSubmit = ({ password = 'a-password', username = 'admin' } = {}) => {
  fireEvent.change(screen.getByLabelText('Username'), { target: { value: username } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
};

describe('LoginView', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('submits the username and password', async () => {
    const onSubmit = vi.fn().mockResolvedValue({});
    render(<LoginView onSubmit={onSubmit} onToggleLanguage={() => {}} />);

    fillAndSubmit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
      password: 'a-password',
      username: 'admin',
    }));
  });

  it('uses type=password and the right autocomplete hints', () => {
    render(<LoginView onSubmit={vi.fn()} onToggleLanguage={() => {}} />);

    const password = screen.getByLabelText('Password');
    expect(password).toHaveAttribute('type', 'password');
    expect(password).toHaveAttribute('autocomplete', 'current-password');
    expect(screen.getByLabelText('Username')).toHaveAttribute('autocomplete', 'username');
  });

  it('treats wrong credentials as a form error, not a redirect', async () => {
    const onSubmit = vi.fn().mockRejectedValue(
      new EasyPagesApiError('Wrong username or password.', {
        code: 'invalid_credentials',
        status: 401,
      }),
    );
    render(<LoginView onSubmit={onSubmit} onToggleLanguage={() => {}} />);

    fillAndSubmit({ password: 'wrong' });

    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong username or password.');
    // Still the login screen, with the form ready for another attempt.
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  it('shows how long the rate limit has left', async () => {
    const onSubmit = vi.fn().mockRejectedValue(
      new EasyPagesApiError('Too many attempts.', { code: 'rate_limited', retryAfter: 90, status: 429 }),
    );
    render(<LoginView onSubmit={onSubmit} onToggleLanguage={() => {}} />);

    fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent('90 seconds');
  });

  it('tells an unreachable backend apart from wrong credentials', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    render(<LoginView onSubmit={onSubmit} onToggleLanguage={() => {}} />);

    fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the server.');
  });

  it('translates when the language changes', async () => {
    render(<LoginView onSubmit={vi.fn()} onToggleLanguage={() => {}} />);
    await i18n.changeLanguage('es');

    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument();
    expect(screen.getByLabelText('Usuario')).toBeInTheDocument();
  });
});
