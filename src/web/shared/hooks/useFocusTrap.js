import { useEffect, useRef } from 'react';

// `:not([disabled])` matters: the submit button is last in the account dialog and disabled
// while submitting. It can never hold focus, so "focus is on the last element" never
// matched and Tab walked out.
const FOCUSABLE = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Trap Tab inside a dialog, close it on Escape, and restore focus on the way out.
 *
 * The listener goes on `document`: with `onKeyDown` on the dialog, Escape only worked while
 * focus was already inside, and jsx-a11y flags a keyboard handler on a non-interactive
 * `role="dialog"`. `onClose` is held in a ref so callers can pass an inline arrow — as a
 * dependency it re-ran the effect on every parent render, stealing focus mid-keystroke.
 *
 * @param {{ open: boolean, onClose: () => void }} options
 * @returns {{ dialogRef: React.RefObject<HTMLElement>, initialFocusRef: React.RefObject<HTMLElement> }}
 */
export const useFocusTrap = ({ open, onClose }) => {
  const dialogRef = useRef(null);
  const initialFocusRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousFocused = document.activeElement;
    // Falls back to the first focusable node when no explicit target was marked.
    const target = initialFocusRef.current
      ?? dialogRef.current?.querySelector(FOCUSABLE);
    target?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) {
        return;
      }

      // No visibility filtering: `offsetParent` is null inside a `fixed` container — which
      // these dialogs are — and always null under jsdom. Only the wrap-around is ours.
      const focusable = Array.from(dialogRef.current.querySelectorAll(FOCUSABLE));
      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;

      // `!focusable.includes(current)` covers focus having escaped already, e.g. because
      // the element holding it was disabled after it was focused.
      if (event.shiftKey && (current === first || !focusable.includes(current))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (current === last || !focusable.includes(current))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocused instanceof HTMLElement) {
        previousFocused.focus();
      }
    };
  }, [open]);

  return { dialogRef, initialFocusRef };
};
