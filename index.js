export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const targetUrlParam = url.searchParams.get('url');

    // --- STEP 1: SCRAPER LOGIC (Ported from your PHP) ---
    // If no 'url' is provided, we fetch the HLS link from the target site first
    if (!targetUrlParam) {
      const channelId = url.searchParams.get('id') || "star1in";
      const targetPage = `https://executeandship.com/premium.php?player=desktop&live=${channelId}`;
      const referer = "https://streamcrichd.com/";

      try {
        const scraperHeaders = {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
          "Referer": referer,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        };

        const pageResponse = await fetch(targetPage, { headers: scraperHeaders });
        const html = await pageResponse.text();

        // 1. Regex to capture the URL array (Mirroring your PHP regex)
        const regex = /return\s*\(\s*\[\s*"h"\s*,\s*"t"\s*(.*?)\.join\(""\)/s;
        const matches = html.match(regex);

        if (matches && matches[1]) {
          let rawArrayContent = matches[1];
          let urlBody = rawArrayContent.replace(/[" ,\n\r\t[\]]/g, '');
          let baseUrl = "ht" + urlBody;

          // 2. Extract the Token using a simple string search (Cloudflare Workers don't have DOMDocument)
          let token = "";
          const tokenMatches = html.match(/id="(?:enscSiutarfBghaikt|suaeiikScntaBrfthg)">(.*?)<\/div>/i);
          if (tokenMatches) {
            token = tokenMatches[1].trim();
          }

          let finalHlsLink = baseUrl + token;
          let cleanLink = finalHlsLink.replace(/[\\\]"']/g, '').trim();

          // Instead of redirecting back to itself, we can now proceed to proxy this cleanLink directly
          return await this.proxyRequest(cleanLink, request.url);
        } else {
          return new Response("Error: HLS Link array not found in source.", { status: 404 });
        }
      } catch (e) {
        return new Response("Scraper Error: " + e.message, { status: 500 });
      }
    }

    // --- STEP 2: PROXY LOGIC ---
    return await this.proxyRequest(targetUrlParam, request.url);
  },

  async proxyRequest(targetUrl, workerUrl) {
    try {
      const urlObj = new URL(targetUrl);
      const workerBase = new URL(workerUrl).origin + "/";
      
      // Determine the base path for relative .ts segments
      const basePath = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);

      const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
        "Referer": "https://executeandship.com/",
        "Origin": "https://executeandship.com",
      };

      const response = await fetch(targetUrl, { headers });

      if (!response.ok) {
        return new Response(`Source Error: ${response.status}`, { status: response.status });
      }

      // M3U8 Rewriting Logic
      if (targetUrl.includes('.m3u8')) {
        let manifest = await response.text();

        const rewrittenManifest = manifest.split('\n').map(line => {
          line = line.trim();
          if (!line || line.startsWith('#')) return line;

          let fullSegmentUrl;
          if (line.startsWith('http')) {
            fullSegmentUrl = line;
          } else {
            fullSegmentUrl = basePath + line;
            // Append original tokens (md5/expires) if present in the master URL
            if (!line.includes('md5=') && urlObj.search) {
              fullSegmentUrl += (line.includes('?') ? '&' : '?') + urlObj.search.substring(1);
            }
          }
          // Route the segment back through this worker
          return `?url=${encodeURIComponent(fullSegmentUrl)}`;
        }).join('\n');

        return new Response(rewrittenManifest, {
          headers: {
            "Content-Type": "application/vnd.apple.mpegurl",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }

      // TS Segment / Binary Streaming
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
