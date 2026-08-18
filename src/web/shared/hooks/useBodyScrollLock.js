import { useEffect } from 'react';

/**
 * Freeze the page behind a modal while it is open, restoring whatever `overflow` the body
 * carried before. The previous value is captured per-effect rather than assumed to be `''`,
 * so a second lock opening on top of a first one cannot leave the page permanently frozen.
 *
 * @param {boolean} locked
 */
export const useBodyScrollLock = (locked) => {
  useEffect(() => {
    if (!locked) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [locked]);
};
