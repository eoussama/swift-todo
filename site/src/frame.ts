/**
 * Wraps work done on scroll or resize so it runs at most once a frame,
 * however often it's asked for.
 *
 * @param run The work.
 * @returns What to call instead, as often as needed.
 */
export function perFrame(run: () => void): () => void {
  let queued = false;

  return () => {
    if (!queued) {
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        run();
      });
    }
  };
}
