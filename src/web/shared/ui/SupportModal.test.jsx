import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import i18n from '../i18n';
import Footer from '../layout/Footer';

const KOFI_SRC = 'https://ko-fi.com/kn990x/?hidefeed=true&widget=true&embed=true&preview=true';

const openSupport = () => fireEvent.click(screen.getByRole('button', { name: /Buy me a coffee/ }));

// The exit animation is driven by a timer, so closing only completes once it has run.
const settleClose = () => act(() => { vi.advanceTimersByTime(400); });

const frame = () => screen.getByTitle('kn990x');

/** The only success signal a cross-origin frame gives, and it fires even when blocked. */
const reportLoad = () => act(() => { fireEvent.load(frame()); });

describe('SupportModal', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not touch ko-fi.com until the button is clicked', () => {
    render(<Footer />);
    // The whole point of mounting the modal lazily: no iframe means no request on load.
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('opens a dialog with the Ko-fi widget, embed parameters untouched', () => {
    render(<Footer />);
    openSupport();

    expect(screen.getByRole('dialog')).toHaveAccessibleName('Buy me a coffee');
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    expect(frame()).toHaveAttribute('src', KOFI_SRC);
  });

  it('closes on Escape', () => {
    render(<Footer />);
    openSupport();

    fireEvent.keyDown(document, { key: 'Escape' });
    settleClose();

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes on the X button', () => {
    render(<Footer />);
    openSupport();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    settleClose();

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes on a click outside the panel but not inside it', () => {
    render(<Footer />);
    openSupport();

    fireEvent.click(screen.getByRole('dialog'));
    settleClose();
    expect(screen.queryByRole('dialog')).not.toBeNull();

    fireEvent.click(document.querySelector('[aria-hidden="true"].absolute'));
    settleClose();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps the iframe loaded across close and reopen', () => {
    render(<Footer />);
    openSupport();
    reportLoad();
    const loaded = frame();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    settleClose();
    openSupport();

    // Same node, so the widget was never re-fetched and whatever was typed survives.
    expect(frame()).toBe(loaded);
  });

  it('returns focus to the footer button on close', () => {
    render(<Footer />);
    const trigger = screen.getByRole('button', { name: /Buy me a coffee/ });
    trigger.focus();
    openSupport();
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    settleClose();

    expect(trigger).toHaveFocus();
  });

  it('freezes the page behind it and restores the scroll on close', () => {
    render(<Footer />);
    openSupport();
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.keyDown(document, { key: 'Escape' });
    settleClose();

    expect(document.body.style.overflow).toBe('');
  });

  describe('when the widget does not arrive', () => {
    it('shows a skeleton while the frame is still on its way', () => {
      render(<Footer />);
      openSupport();

      expect(screen.getByRole('status')).toHaveTextContent('Loading the Ko-fi widget');
    });

    it('clears the skeleton once the frame reports back', () => {
      render(<Footer />);
      openSupport();
      reportLoad();

      expect(screen.queryByRole('status')).toBeNull();
    });

    it('falls back to a prominent link when the frame stays silent', () => {
      render(<Footer />);
      openSupport();
      // No route out: no load event ever fires, and an iframe raises no error of its own.
      act(() => { vi.advanceTimersByTime(8000); });

      expect(screen.getByRole('heading', { name: 'The widget could not load' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Open Ko-fi/ })).toBeInTheDocument();
    });

    it('holds the fallback once it has given up', () => {
      render(<Footer />);
      openSupport();
      act(() => { vi.advanceTimersByTime(8000); });

      // Measured in Chrome: a frame pointed at an unreachable host eventually commits the
      // browser's own error page and fires `load`. Honouring that would swap the fallback
      // for a blank frame, which is exactly the state the fallback exists to replace.
      reportLoad();

      expect(screen.getByRole('heading', { name: 'The widget could not load' })).toBeInTheDocument();
    });

    it('retries on reopen after a failure', () => {
      render(<Footer />);
      openSupport();
      const first = frame();
      act(() => { vi.advanceTimersByTime(8000); });

      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      settleClose();
      openSupport();

      // A fresh element, because only a remount makes a frame request its src again.
      expect(frame()).not.toBe(first);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('offers the way out even when the frame claims it loaded', () => {
      // The case nothing can detect: a blocker cancels the request, `load` fires anyway and
      // the frame is silently blank. The escape hatch must not depend on spotting that.
      render(<Footer />);
      openSupport();
      reportLoad();

      expect(screen.queryByRole('status')).toBeNull();
      expect(screen.getByText('Not loading?')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Open Ko-fi/ }))
        .toHaveAttribute('href', 'https://ko-fi.com/kn990x');
    });

    it('keeps an unsettled frame out of the tab cycle', () => {
      render(<Footer />);
      openSupport();

      expect(frame()).toHaveAttribute('tabindex', '-1');
      reportLoad();
      expect(frame()).not.toHaveAttribute('tabindex');
    });
  });
});
