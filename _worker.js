export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname === '/' ? '/index.html' : url.pathname;
    
    try {
      const response = await fetch(`https://your-site.pages.dev${path}`);
      return response;
    } catch {
      return new Response('Not Found', { status: 404 });
    }
  }
}
