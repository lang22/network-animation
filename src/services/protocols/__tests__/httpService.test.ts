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
});
