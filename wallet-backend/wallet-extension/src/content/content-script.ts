/**
 * Content Script - Bridge between injected script and service worker
 */

// Inject the provider script into the page
function injectScript() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('content/injected.js');
  script.type = 'module';
  (document.head || document.documentElement).appendChild(script);
  script.onload = () => script.remove();
}

injectScript();

// Listen for messages from the injected script
window.addEventListener('message', async (event) => {
  // Only accept messages from the same window
  if (event.source !== window) return;

  // Only accept messages from our provider
  if (event.data?.source !== 'valtix-provider') return;

  const { id, type, payload } = event.data;

  try {
    // Forward message to service worker
    const response = await chrome.runtime.sendMessage({
      id,
      type,
      payload,
      origin: window.location.origin,
    });

    // Send response back to injected script
    window.postMessage(
      {
        id,
        source: 'valtix-content-script',
        ...response,
      },
      '*'
    );
  } catch (error) {
    window.postMessage(
      {
        id,
        source: 'valtix-content-script',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      '*'
    );
  }
});

// Listen for messages from service worker (for events like disconnect)
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'DISCONNECT_EVENT') {
    window.postMessage(
      {
        source: 'valtix-content-script',
        type: 'disconnect',
      },
      '*'
    );
  }
});
