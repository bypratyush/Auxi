// ScreenshotOne — returns a hosted URL of a full-page PNG.
// Free tier uses the access_key as a query param (no signature needed).
// Docs: https://screenshotone.com/docs/options/

const ENDPOINT = 'https://api.screenshotone.com/take';

export interface ScreenshotResult {
  url: string;
  fetchedAt: string;
}

export async function captureScreenshot(targetUrl: string): Promise<ScreenshotResult> {
  const accessKey = process.env.SCREENSHOTONE_ACCESS_KEY;
  if (!accessKey) throw new Error('SCREENSHOTONE_ACCESS_KEY is not set');

  const params = new URLSearchParams({
    access_key: accessKey,
    url: targetUrl,
    format: 'png',
    viewport_width: '1280',
    viewport_height: '800',
    device_scale_factor: '1',
    full_page: 'true',
    full_page_scroll: 'true',
    block_cookie_banners: 'true',
    block_ads: 'true',
    block_chats: 'true',
    cache: 'true',
    cache_ttl: '86400',
    response_type: 'by_format',
    image_quality: '80',
  });

  const url = `${ENDPOINT}?${params.toString()}`;
  return { url, fetchedAt: new Date().toISOString() };
}
