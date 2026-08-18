import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useFocusTrap } from './useFocusTrap';

const Dialog = ({ onClose, disableLast = false }) => {
  const { dialogRef, initialFocusRef } = useFocusTrap({ open: true, onClose });

  return (
    <div ref={dialogRef} role="dialog" aria-label="test">
      <input ref={initialFocusRef} aria-label="first" />
      <button type="button">middle</button>
      <button type="submit" disabled={disableLast}>last</button>
    </div>
  );
};

describe('useFocusTrap', () => {
  it('focuses the element marked as the initial target', () => {
    render(<Dialog onClose={() => {}} />);
    expect(screen.getByLabelText('first')).toHaveFocus();
  });

  it('closes on Escape, wherever focus happens to be', () => {
    const onClose = vi.fn();
    render(<Dialog onClose={onClose} />);
    // Dispatched on document, not on the dialog: the previous per-element onKeyDown only
    // fired while focus was already inside.
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('wraps Tab from the last element back to the first', () => {
    render(<Dialog onClose={() => {}} />);
    screen.getByText('last').focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.getByLabelText('first')).toHaveFocus();
  });

  it('wraps Shift+Tab from the first element to the last', () => {
    render(<Dialog onClose={() => {}} />);
    screen.getByLabelText('first').focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(screen.getByText('last')).toHaveFocus();
  });

  it('skips a disabled last element instead of letting Tab escape', () => {
    // The regression this exists for: a submit button disabled while submitting can never
    // hold focus, so "focus is on the last element" never matched and Tab walked out.
    render(<Dialog onClose={() => {}} disableLast />);
    screen.getByText('middle').focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.getByLabelText('first')).toHaveFocus();
  });

  it('lets Tab reach an iframe inside the dialog', () => {
    // The Ko-fi support dialog is an iframe plus a close button. Without `iframe` in the
    // selector the wrap-around treated the button as both first and last, so Tab bounced
    // off it and the keyboard never reached the donation form.
    const FramedDialog = () => {
      const { dialogRef, initialFocusRef } = useFocusTrap({ open: true, onClose: () => {} });
      return (
        <div ref={dialogRef} role="dialog" aria-label="framed">
          <button ref={initialFocusRef} type="button">close</button>
          <iframe title="widget" src="about:blank" />
        </div>
      );
    };

    render(<FramedDialog />);
    expect(screen.getByText('close')).toHaveFocus();

    // Focus is on the first element, so a forward Tab must not be intercepted at all.
    const tab = fireEvent.keyDown(document, { key: 'Tab' });
    expect(tab).toBe(true);

    // ...and Shift+Tab from it wraps onto the iframe rather than back onto the button.
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(screen.getByTitle('widget')).toHaveFocus();
  });

  it('restores focus to whatever was focused before it opened', () => {
    render(<button type="button">outside</button>);
    const outside = screen.getByText('outside');
    outside.focus();

    const { unmount } = render(<Dialog onClose={() => {}} />);
    expect(screen.getByLabelText('first')).toHaveFocus();

    unmount();
    expect(outside).toHaveFocus();
  });
});
