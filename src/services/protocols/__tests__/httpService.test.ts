import { buildRequest, buildResponse, formatMessage, reasonPhrase } from '../httpService';

describe('httpService', () => {
  it('builds a GET request without body headers', () => {
    const request = buildRequest('GET', '/index.html');

    expect(request.startLine).toBe('GET /index.html HTTP/1.1');
    expect(request.headers).toEqual(expect.arrayContaining([
      ['Host', 'example.com'],
      ['Connection', 'keep-alive'],
    ]));
    expect(request.body).toBe('');
    expect(request.headers.some(([name]) => name === 'Content-Length')).toBe(false);
  });

  it('adds content headers for POST', () => {
    const request = buildRequest('POST', '/login', 'user=admin');

    expect(request.startLine).toBe('POST /login HTTP/1.1');
    expect(request.headers).toEqual(expect.arrayContaining([
      ['Content-Type', 'application/x-www-form-urlencoded'],
      ['Content-Length', '10'],
    ]));
    expect(request.body).toBe('user=admin');
  });

  it('builds a 200 response with a matching content length', () => {
    const response = buildResponse(200, 'hello');

    expect(response.startLine).toBe('HTTP/1.1 200 OK');
    expect(response.headers).toEqual(expect.arrayContaining([['Content-Length', '5']]));
  });

  it('maps known status codes to reason phrases', () => {
    expect(reasonPhrase(200)).toBe('OK');
    expect(reasonPhrase(404)).toBe('Not Found');
    expect(reasonPhrase(500)).toBe('Internal Server Error');
  });

  it('formats raw HTTP text with a blank line before the body', () => {
    const text = formatMessage(buildResponse(200, 'hi'));

    expect(text.startsWith('HTTP/1.1 200 OK')).toBe(true);
    expect(text).toContain('Content-Type: text/html; charset=utf-8');
    expect(text).toContain('\n\nhi');
  });

  it('omits the blank line when there is no body', () => {
    const text = formatMessage(buildRequest('GET', '/'));

    expect(text).toContain('GET / HTTP/1.1');
    expect(text).not.toContain('\n\n');
  });

  it('uses a default body that matches the status code', () => {
    const notFound = buildResponse(404);
    const serverError = buildResponse(500);

    expect(notFound.startLine).toBe('HTTP/1.1 404 Not Found');
    expect(notFound.body).toContain('404 Not Found');
    expect(serverError.body).toContain('500 Internal Server Error');
  });

  it('accepts a custom response body', () => {
    const response = buildResponse(200, 'ok');

    expect(response.body).toBe('ok');
    expect(response.headers).toEqual(expect.arrayContaining([['Content-Length', '2']]));
  });

  it('adds cache headers to successful and 304 responses', () => {
    const ok = buildResponse(200);
    const notModified = buildResponse(304);

    expect(ok.headers).toEqual(expect.arrayContaining([['ETag', '"6f-5e8a1c"'], ['Cache-Control', 'max-age=60']]));
    expect(notModified.startLine).toBe('HTTP/1.1 304 Not Modified');
    expect(notModified.body).toBe('');
    expect(notModified.headers).toEqual(expect.arrayContaining([['ETag', '"6f-5e8a1c"']]));
    expect(notModified.headers.some(([name]) => name === 'Content-Length')).toBe(false);
  });

  it('does not cache error responses', () => {
    expect(buildResponse(500).headers).toEqual(expect.arrayContaining([['Cache-Control', 'no-store']]));
  });

  it('appends extra request headers such as If-None-Match', () => {
    const request = buildRequest('GET', '/index.html', '', [['If-None-Match', '"6f-5e8a1c"']]);

    expect(request.headers).toEqual(expect.arrayContaining([['If-None-Match', '"6f-5e8a1c"']]));
  });

  it('appends custom response headers and overrides existing ones', () => {
    const response = buildResponse(200, undefined, [
      ['X-Cache', 'HIT'],
      ['Content-Type', 'application/json'],
    ]);

    expect(response.headers).toEqual(expect.arrayContaining([['X-Cache', 'HIT']]));
    expect(response.headers.filter(([name]) => name === 'Content-Type')).toEqual([
      ['Content-Type', 'application/json'],
    ]);
  });
});
