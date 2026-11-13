export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // If the network sends a postback to /api/postback on pages.dev
    if (url.pathname === '/api/postback') {
      // Forward it to your real Worker URL with all the parameters intact
      const workerUrl = 'https://cryptonaira.zechi-dev.workers.dev/postback' + url.search;
      
      return fetch(workerUrl, {
        method: request.method,
        headers: request.headers
      });
    }
    
    // Otherwise, serve the normal app
    return env.ASSETS.fetch(request);
  }
};
