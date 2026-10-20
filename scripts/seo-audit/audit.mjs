import { mkdir, writeFile } from 'node:fs/promises';

const BASE_URL = 'https://certify.cx';
const REPORT_DIR = '.local-reports';

async function fetchText(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    redirect: 'follow',
    headers: { 'User-Agent': 'CertifyCX-ReadOnly-SEO-Audit/1.0' },
  });

  return {
    requestedUrl: url,
    finalUrl: response.url,
    status: response.status,
    ok: response.ok,
    body: await response.text(),
  };
}

async function main() {
  const checks = [];
  let sitemapUrls = [];
  let robotsBody = '';

  for (const path of ['/robots.txt', '/sitemap.xml']) {
    try {
      const result = await fetchText(`${BASE_URL}${path}`);

      checks.push({
        check: `${path} availability`,
        status: result.status,
        ok: result.ok,
        requestedUrl: result.requestedUrl,
        finalUrl: result.finalUrl,
      });

      if (path === '/robots.txt' && result.ok) {
        robotsBody = result.body;
      }

      if (path === '/sitemap.xml' && result.ok) {
        const locations = [...result.body.matchAll(
          /<loc>\s*([\s\S]*?)\s*<\/loc>/gi
        )];

        sitemapUrls = locations.map(match => match[1].trim());
        checks.push({
          check: 'Sitemap contains URLs',
          count: sitemapUrls.length,
          ok: sitemapUrls.length > 0,
        });
      }
    } catch (error) {
      checks.push({
        check: `${path} availability`,
        ok: false,
        error: error.message,
      });
    }
  }

  const normalizedUrls = sitemapUrls.map(value => {
    try {
      return new URL(value);
    } catch {
      return null;
    }
  });

  const invalidUrls = sitemapUrls.filter((_, index) => {
    const url = normalizedUrls[index];
    return !url || !['http:', 'https:'].includes(url.protocol);
  });

  const duplicateUrls = sitemapUrls.filter(
    (url, index) => sitemapUrls.indexOf(url) !== index
  );

  checks.push({
    check: 'Sitemap URLs are valid absolute HTTP(S) URLs',
    ok: invalidUrls.length === 0,
    count: invalidUrls.length,
    examples: invalidUrls.slice(0, 10),
  });

  checks.push({
    check: 'Sitemap has no duplicate URL entries',
    ok: duplicateUrls.length === 0,
    count: duplicateUrls.length,
    examples: [...new Set(duplicateUrls)].slice(0, 10),
  });

  const sitemapDirective = robotsBody
    .split(/\r?\n/)
    .filter(line => /^\s*Sitemap\s*:/i.test(line));

  checks.push({
    check: 'robots.txt references a sitemap',
    ok: sitemapDirective.length > 0,
    entries: sitemapDirective,
  });

  const report = {
    audit: 'Certify.cx read-only SEO baseline',
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    scope: 'robots.txt and sitemap.xml; no website changes',
    summary: {
      checks: checks.length,
      passed: checks.filter(check => check.ok).length,
      failed: checks.filter(check => check.ok === false).length,
    },
    checks,
    sitemapUrlCount: sitemapUrls.length,
  };

  await mkdir(REPORT_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = `${REPORT_DIR}/seo-audit-${timestamp}.json`;

  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(JSON.stringify(report, null, 2));
  console.log(`\nReport saved locally: ${reportPath}`);
}

main().catch(error => {
  console.error('SEO audit failed:', error.message);
  process.exitCode = 1;
});
