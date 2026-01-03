/**
 * Sentry Configuration
 * Initializes error logging for CEPID Infoviz
 */
window.Sentry = window.Sentry || {};

// Initialize if Sentry is loaded
if (typeof Sentry !== 'undefined' && Sentry.init) {
    Sentry.init({
        dsn: "https://examplePublicKey@o0.ingest.sentry.io/0", // PLACEHOLDER: Replace with actual DSN
        integrations: [],
        tracesSampleRate: 1.0,
        // Filter out noise
        ignoreErrors: [
            // Common noise
            'ResizeObserver loop limit exceeded',
            'Network request failed',
            'Failed to fetch'
        ],
        beforeSend(event) {
            // Check if it looks like the D3 viewBox error
            if (event.exception && event.exception.values) {
                const exception = event.exception.values[0];
                if (exception.value && exception.value.includes('Unexpected end of attribute')) {
                    event.tags = { ...event.tags, type: 'd3_svg_error' };
                }
            }
            return event;
        }
    });
    console.log('[Sentry] Initialized');
} else {
    // Graceful fallback dummy object if script fails to load
    window.Sentry = {
        captureException: (e) => console.error('[Sentry Fallback]', e),
        captureMessage: (m) => console.log('[Sentry Fallback]', m)
    };
}
