import { useEffect, useId, useRef, useState } from 'react';
import { ExternalLink, WifiOff, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useFocusTrap } from '../hooks/useFocusTrap';

// Verbatim from Ko-fi's embed snippet. Do not touch the query string: `widget`, `embed` and
// `hidefeed` are what make the page framable and strip its site chrome.
const KOFI_SRC = 'https://ko-fi.com/kn990x/?hidefeed=true&widget=true&embed=true&preview=true';
// The plain page, for when the frame never arrives.
const KOFI_URL = 'https://ko-fi.com/kn990x';

const EXIT_MS = 200;
// Long enough for a slow connection, short enough that a homelab with no route out is not
// left staring at a skeleton.
const FRAME_TIMEOUT_MS = 8000;

const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/*
 * There is no reliable way to ask a cross-origin frame whether it actually loaded.
 * Measured in Chrome, all three of these are indistinguishable from the parent: a real
 * ko-fi.com load, a frame cancelled by an ad blocker, and a DNS failure. `load` fires in
 * every case, and reading `contentWindow.location` throws SecurityError in every case —
 * the blocked ones commit an opaque error document rather than staying on about:blank.
 *
 * So detection covers only the one honest signal, a `load` that never comes, and the way
 * out is unconditional instead: the link at the foot of the panel is always there.
 */

/**
 * The Ko-fi widget, framed in place instead of navigating away.
 *
 * The caller mounts this only after the first click, which is what keeps ko-fi.com out of
 * every page load. From then on it stays mounted and merely hides itself, so the iframe is
 * fetched once and reopening keeps whatever the visitor had already typed.
 */
const SupportModal = ({ open, onClose }) => {
  const { t } = useTranslation();
  const titleId = useId();
  // 'closing' is the window where the exit animation runs and the panel is still in the DOM.
  const [phase, setPhase] = useState(open ? 'open' : 'closed');
  const [frameStatus, setFrameStatus] = useState('loading');
  // Bumped to force a remount, which is the only way to make a frame retry its request.
  const [reloadKey, setReloadKey] = useState(0);
  const closeTimer = useRef(null);
  const frameStatusRef = useRef(frameStatus);
  const { dialogRef, initialFocusRef } = useFocusTrap({ open: phase === 'open', onClose });
  useBodyScrollLock(phase !== 'closed');

  // Declared above the open effect so it has already run by the time that one reads it.
  useEffect(() => {
    frameStatusRef.current = frameStatus;
  }, [frameStatus]);

  useEffect(() => {
    clearTimeout(closeTimer.current);

    if (open) {
      setPhase('open');
      // A frame that failed holds nothing worth preserving, so reopening is a free retry:
      // the blocker may be off now, or the network back.
      if (frameStatusRef.current === 'unreachable') {
        setFrameStatus('loading');
        setReloadKey((key) => key + 1);
      }
      return undefined;
    }

    // A timer, not `animationend`: jsdom never fires animation events, so the dialog would
    // stay in the tree forever under test.
    setPhase((current) => (current === 'closed' ? 'closed' : 'closing'));
    closeTimer.current = setTimeout(
      () => setPhase('closed'),
      prefersReducedMotion() ? 0 : EXIT_MS,
    );

    return () => clearTimeout(closeTimer.current);
  }, [open]);

  // Nothing else will tell us the frame is never coming.
  useEffect(() => {
    if (frameStatus !== 'loading') {
      return undefined;
    }
    const timer = setTimeout(() => setFrameStatus('unreachable'), FRAME_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [frameStatus, reloadKey]);

  const closing = phase === 'closing';
  const settled = frameStatus === 'loaded';

  return (
    <div
      // `hidden` rather than unmounting: display:none does not discard the iframe, so the
      // widget is never re-fetched, and a hidden overlay cannot swallow clicks.
      hidden={phase === 'closed'}
      className={`fixed inset-0 z-50 flex items-end justify-center bg-black/30 backdrop-blur-sm sm:items-center sm:p-4 ${
        closing ? 'animate-backdrop-out' : 'animate-backdrop-in'
      }`}
    >
      {/* A button, not an onClick on the overlay: jsx-a11y rejects a click handler on a
          non-interactive div. It sits outside `dialogRef`, so the focus trap ignores it. */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:max-h-[88vh] sm:max-w-[560px] sm:rounded-xl ${
          closing ? 'animate-sheet-out sm:animate-panel-out' : 'animate-sheet-in sm:animate-panel-in'
        }`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
          <div className="min-w-0">
            <h3 id={titleId} className="text-lg font-semibold text-gray-900">
              {t('support_title')}
            </h3>
            <p className="mt-0.5 text-xs text-gray-500">{t('support_subtitle')}</p>
          </div>
          {/* Focus lands here rather than on the iframe: a cross-origin frame swallows the
              keydown, and Escape would be dead the moment the dialog opened. */}
          <button
            ref={initialFocusRef}
            type="button"
            onClick={onClose}
            aria-label={t('support_close')}
            className="-mr-1 shrink-0 rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div
          className={`relative flex-1 bg-gray-50 p-1 ${
            settled ? 'overflow-y-auto overscroll-contain' : 'overflow-hidden'
          }`}
        >
          <iframe
            key={reloadKey}
            id="kofiframe"
            src={KOFI_SRC}
            height="712"
            title="kn990x"
            // Only ever promotes a frame still being waited on. Past the timeout a `load`
            // is far more likely to be the browser's own error page than a slow widget,
            // and letting that replace the fallback puts a blank panel back on screen.
            onLoad={() => setFrameStatus((current) => (current === 'loading' ? 'loaded' : current))}
            // Keeps a blank frame from being a dead stop in the Tab cycle.
            tabIndex={settled ? undefined : -1}
            className="w-full border-0 bg-gray-50"
          />

          {frameStatus === 'loading' && (
            <div
              role="status"
              className="absolute inset-0 flex flex-col items-center gap-4 bg-gray-50 px-6 py-8"
            >
              <span className="sr-only">{t('support_loading')}</span>
              <div className="h-16 w-16 animate-pulse rounded-full bg-gray-200" />
              <div className="h-4 w-44 animate-pulse rounded bg-gray-200" />
              <div className="h-10 w-full animate-pulse rounded-full bg-gray-200" />
              <div className="h-10 w-full animate-pulse rounded-lg bg-gray-200" />
              <div className="h-10 w-full animate-pulse rounded-lg bg-gray-200" />
              <div className="h-16 w-full animate-pulse rounded-lg bg-gray-200" />
              <div className="h-11 w-full animate-pulse rounded-full bg-gray-300" />
            </div>
          )}

          {frameStatus === 'unreachable' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-50 px-6 py-8 text-center">
              <div className="rounded-full bg-orange-100 p-3 text-orange-700">
                <WifiOff size={20} aria-hidden="true" />
              </div>
              <h4 className="text-sm font-semibold text-gray-900">
                {t('support_unavailable_title')}
              </h4>
              <p className="max-w-xs text-xs text-gray-600">{t('support_unavailable_body')}</p>
              <a
                href={KOFI_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
              >
                {t('support_open_kofi')}
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            </div>
          )}
        </div>

        {/* Shown for every state but the one that already offers a bigger version of the
            same link. An ad blocker or a host with no route out leaves a silent blank frame
            the parent cannot detect, so this cannot be conditional on detecting it. */}
        {frameStatus !== 'unreachable' && (
        <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 border-t border-gray-200 bg-white px-5 py-2.5 text-xs text-gray-500">
          <span>{t('support_not_loading')}</span>
          <a
            href={KOFI_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-sm font-semibold text-orange-700 transition-colors hover:text-orange-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
          >
            {t('support_open_kofi')}
            <ExternalLink size={12} aria-hidden="true" />
          </a>
        </div>
        )}
      </div>
    </div>
  );
};

export default SupportModal;
