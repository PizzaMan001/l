export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    // Cloudflare automatically decodes URL-encoded characters here
    const targetUrl = url.searchParams.get('url');

    // 1. Basic usage check
    if (!targetUrl) {
      return new Response('Usage: /?url=https://example.com/video.m3u8', { 
        status: 400,
        headers: { "Content-Type": "text/plain" }
      });
    }

    try {
      const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);

      // 2. Define headers required by the source
      const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
        "Referer": "https://profamouslife.com/",
        "Origin": "https://profamouslife.com",
      };

      // 3. Fetch the content
      const response = await fetch(targetUrl, { headers });

      if (!response.ok) {
        return new Response(`Source returned error: ${response.status}`, { status: response.status });
      }

      // 4. Handle M3U8 Rewriting
      if (targetUrl.includes('.m3u8')) {
        let manifest = await response.text();

        // Rewrite .ts lines to point back to this worker WITHOUT base64
        const rewrittenManifest = manifest.replace(/^(.*\.ts.*)$/gm, (match) => {
          const segment = match.trim();
          const fullSegmentUrl = segment.startsWith('http') ? segment : baseUrl + segment;
          
          // Use encodeURIComponent to safely nest the URL
          return `?url=${encodeURIComponent(fullSegmentUrl)}`;
        });

        return new Response(rewrittenManifest, {
          headers: { 
            "Content-Type": "application/vnd.apple.mpegurl",
            "Access-Control-Allow-Origin": "*" 
          }
        });
      }

      // 5. Handle TS Segments (Direct stream)
      return new Response(response.body, {
        headers: { 
          "Content-Type": response.headers.get("Content-Type") || "video/mp2t",
          "Access-Control-Allow-Origin": "*" 
        }
      });

    } catch (e) {
      return new Response("Proxy Error: " + e.message, { status: 500 });
    }
  }
};
