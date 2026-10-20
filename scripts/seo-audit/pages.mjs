import { mkdir, writeFile } from 'node:fs/promises';

const BASE_URL = 'https://certify.cx';
const REPORT_DIR = '.local-reports';

function extract(html, regex) {
  return regex.exec(html)?.[1]?.trim() ?? null;
}

async function fetchPage(url) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      redirect: 'follow',
      headers: {
        'User-Agent': 'CertifyCX-ReadOnly-SEO-Audit/1.0',
      },
    });

    const html = await response.text();

    const title = extract(html, /<title\b[^>]*>([\s\S]*?)<\/title>/i);
    const description = extract(
      html,
      /<meta\b(?=[^>]*\bname=["']description["'])[^>]*\bcontent=["']([^"']*)["'][^>]*>/i
    );
    const canonical = extract(
      html,
      /<link\b(?=[^>]*\brel=["']canonical["'])[^>]*\bhref=["']([^"']*)["'][^>]*>/i
    );
    const h1Count = [...html.matchAll(/<h1\b[^>]*>/gi)].length;

    return {
      url,
      status: response.status,
      finalUrl: response.url,
      redirected: response.redirected,
      title,
      metaDescription: description,
      canonical,
      rawHtmlH1Count: h1Count,
      note: 'Metadata and H1 count are from raw server HTML, not browser-rendered React content.',
    };
  } catch (error) {
    return {
      url,
      error: error.message,
    };
  }
}

async function main() {
  const sitemapResponse = await fetch(`${BASE_URL}/sitemap.xml`, {
    signal: AbortSignal.timeout(15000),
  });

  if (!sitemapResponse.ok) {
    throw new Error(`Sitemap returned HTTP ${sitemapResponse.status}`);
  }

  const xml = await sitemapResponse.text();
  const urls = [...xml.matchAll(/<loc>\s*([\s\S]*?)\s*<\/loc>/gi)]
    .map(match => match[1].trim())
    .filter(url => {
      try {
        return new URL(url).origin === BASE_URL;
      } catch {
        return false;
      }
    });

  const results = [];
  const concurrency = 4;

  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    results.push(...await Promise.all(batch.map(fetchPage)));
  }

  const report = {
    audit: 'Certify.cx public page status and raw HTML metadata',
    generatedAt: new Date().toISOString(),
    totalUrls: urls.length,
    scope: 'GET requests only; no login, writes, or deployment',
    results,
  };

  await mkdir(REPORT_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = `${REPORT_DIR}/seo-pages-${timestamp}.json`;

  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`Pages checked: ${results.length}`);
  console.log(`HTTP errors: ${results.filter(r => r.status && r.status >= 400).length}`);
  console.log(`Fetch errors: ${results.filter(r => r.error).length}`);
  console.log(`Missing raw HTML title: ${results.filter(r => !r.title).length}`);
  console.log(`Missing raw HTML meta description: ${results.filter(r => !r.metaDescription).length}`);
  console.log(`Missing raw HTML canonical: ${results.filter(r => !r.canonical).length}`);
  console.log(`Report saved: ${reportPath}`);
  console.log('\nPer-page results:');
  console.table(results.map(({ url, status, redirected, title, metaDescription, canonical, rawHtmlH1Count, error }) => ({
    path: new URL(url).pathname,
    status: status ?? 'ERROR',
    redirected: redirected ?? false,
    title: title ? 'Present' : 'Missing in raw HTML',
    description: metaDescription ? 'Present' : 'Missing in raw HTML',
    canonical: canonical ? 'Present' : 'Missing in raw HTML',
    rawH1s: rawHtmlH1Count ?? '-',
    error: error ?? '',
  })));
}

main().catch(error => {
  console.error('Page audit failed:', error.message);
  process.exitCode = 1;
});
