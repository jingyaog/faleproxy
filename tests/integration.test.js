const request = require('supertest');
const cheerio = require('cheerio');
const { sampleHtmlWithYale } = require('./test-utils');
const nock = require('nock');

// Import the app directly (no server spawning needed)
const app = require('../app');

describe('Integration Tests', () => {
  beforeAll(() => {
    // Mock external HTTP requests
    nock.disableNetConnect();
    // Allow localhost connections for supertest
    nock.enableNetConnect('127.0.0.1');
  });

  afterAll(() => {
    // Clean up nock
    nock.cleanAll();
    nock.enableNetConnect();
  });

  afterEach(() => {
    // Clear any lingering nock interceptors after each test
    nock.cleanAll();
  });

  test('Should replace Yale with Fale in fetched content', async () => {
    // Setup mock for example.com
    nock('https://example.com')
      .get('/')
      .reply(200, sampleHtmlWithYale);

    // Make a request to our proxy app using supertest
    const response = await request(app)
      .post('/fetch')
      .send({ url: 'https://example.com/' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Verify Yale has been replaced with Fale in text
    const $ = cheerio.load(response.body.content);
    expect($('title').text()).toBe('Fale University Test Page');
    expect($('h1').text()).toBe('Welcome to Fale University');
    expect($('p').first().text()).toContain('Fale University is a private');

    // Verify URLs remain unchanged
    const links = $('a');
    let hasYaleUrl = false;
    links.each((i, link) => {
      const href = $(link).attr('href');
      if (href && href.includes('yale.edu')) {
        hasYaleUrl = true;
      }
    });
    expect(hasYaleUrl).toBe(true);

    // Verify link text is changed
    expect($('a').first().text()).toBe('About Fale');
  });

  test('Should handle invalid URLs', async () => {
    // Mock an external URL that returns an error
    nock('https://invalid-url.com')
      .get('/')
      .replyWithError('Connection refused');

    const response = await request(app)
      .post('/fetch')
      .send({ url: 'https://invalid-url.com/' });

    expect(response.status).toBe(500);
    expect(response.body.error).toContain('Failed to fetch content');
  });

  test('Should handle missing URL parameter', async () => {
    const response = await request(app)
      .post('/fetch')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('URL is required');
  });

  test('Should handle mixed case Yale variations', async () => {
    // HTML with mixed case variations like YaLe, yAlE
    const mixedCaseHtml = `
      <!DOCTYPE html>
      <html>
      <head><title>Test</title></head>
      <body>
        <p>Testing YaLe and yAlE and YAlE variations.</p>
      </body>
      </html>
    `;

    nock('https://mixed.com')
      .get('/')
      .reply(200, mixedCaseHtml);

    const response = await request(app)
      .post('/fetch')
      .send({ url: 'https://mixed.com/' });

    expect(response.status).toBe(200);
    const $ = cheerio.load(response.body.content);
    const text = $('p').text();

    // YaLe -> FaLe, yAlE -> fAlE, YAlE -> FAlE
    expect(text).toContain('FaLe');
    expect(text).toContain('fAlE');
    expect(text).toContain('FAlE');
  });

  test('Should serve the main page', async () => {
    const response = await request(app)
      .get('/');

    expect(response.status).toBe(200);
    expect(response.type).toMatch(/html/);
  });
});
