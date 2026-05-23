// Small helpers to safely postMessage to iframes and optionally log failures.
export const safePostToIframe = (iframe, payload, targetOrigin = '*') => {
  try {
    iframe?.contentWindow?.postMessage(payload, targetOrigin);
  } catch (e) {
    // swallow — caller can use debug helper if needed
  }
};

export const safePostToIframeDebug = (iframe, payload, targetOrigin = '*') => {
  try {
    iframe?.contentWindow?.postMessage(payload, targetOrigin);
  } catch (e) {
    try {
      console.warn('[postMessageSafe] failed', { src: iframe?.src, payload, targetOrigin, error: e && e.message });
    } catch {}
  }
};

export default safePostToIframe;
