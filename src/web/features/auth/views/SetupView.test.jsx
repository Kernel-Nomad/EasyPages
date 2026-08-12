import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from '../../../shared/i18n';
import { EasyPagesApiError } from '../../../../api/client/easyPagesApi.js';
import SetupView from './SetupView';

const fill = ({ password = 'a-password', repeat = password, username = 'admin' } = {}) => {
  fireEvent.change(screen.getByLabelText('Username'), { target: { value: username } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Repeat password'), { target: { value: repeat } });
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
};

describe('SetupView', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('creates the account with a username and password', async () => {
    const onSubmit = vi.fn().mockResolvedValue({});
    render(<SetupView onSubmit={onSubmit} onToggleLanguage={() => {}} />);

    fill();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
      password: 'a-password',
      username: 'admin',
    }));
  });

  it('catches mismatched passwords without reaching the server', async () => {
    const onSubmit = vi.fn();
    render(<SetupView onSubmit={onSubmit} onToggleLanguage={() => {}} />);

    fill({ password: 'a-password', repeat: 'something-else' });

    expect(await screen.findByRole('alert')).toHaveTextContent('The passwords do not match.');
    // The backend never reflects a submitted password, so it could not say which failed.
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('warns about the claim window before the account exists', () => {
    render(<SetupView onSubmit={vi.fn()} onToggleLanguage={() => {}} />);

    expect(screen.getByText(/anyone who can reach this port/i)).toBeInTheDocument();
  });

  it('enforces the username and password policy in the form itself', () => {
    render(<SetupView onSubmit={vi.fn()} onToggleLanguage={() => {}} />);

    const username = screen.getByLabelText('Username');
    expect(username).toHaveAttribute('minlength', '3');
    expect(username).toHaveAttribute('maxlength', '64');
    expect(username).toHaveAttribute('pattern', '[A-Za-z0-9._@+-]+');
    expect(screen.getByLabelText('Password')).toHaveAttribute('minlength', '8');
  });

  it('explains an already completed setup with its own message', async () => {
    const onSubmit = vi.fn().mockRejectedValue(
      new EasyPagesApiError('already', { code: 'setup_already_completed', status: 409 }),
    );
    render(<SetupView onSubmit={onSubmit} onToggleLanguage={() => {}} />);

    fill();

    expect(await screen.findByRole('alert'))
      .toHaveTextContent('Initial setup is already complete.');
  });

  it('gives an actionable hint when the volume is not writable', async () => {
    const onSubmit = vi.fn().mockRejectedValue(
      new EasyPagesApiError('nope', { code: 'storage_unwritable', status: 500 }),
    );
    render(<SetupView onSubmit={onSubmit} onToggleLanguage={() => {}} />);

    fill();

    // The most likely failure on a fresh install with a bind mount.
    expect(await screen.findByRole('alert')).toHaveTextContent('chown -R 1000:1000');
  });
});
