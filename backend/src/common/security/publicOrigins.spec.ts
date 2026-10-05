import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { corsOptionsForRequest } from './publicOrigins';

const optionsFor = (url: string): CorsOptions => {
  let options: CorsOptions = {};
  corsOptionsForRequest({ url }, (_error, result) => {
    options = result as CorsOptions;
  });
  return options;
};

describe('corsOptionsForRequest', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it('allows only the marketing site on /public/*, without credentials', () => {
    process.env.CORS_ALLOWED_ORIGINS =
      'https://quiptechfield.com.au, https://www.quiptechfield.com.au';
    process.env.PORTAL_ORIGIN = 'https://portal.example';
    expect(optionsFor('/public/demo-requests')).toEqual({
      origin: [
        'https://quiptechfield.com.au',
        'https://www.quiptechfield.com.au',
      ],
      methods: ['POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type'],
      credentials: false,
    });
  });

  it('keeps every other route on the portal origin only', () => {
    process.env.PUBLIC_CORS_ORIGINS = 'https://quiptechfield.com.au';
    process.env.PORTAL_ORIGIN = 'https://portal.example';
    for (const url of ['/admin/demo-requests', '/auth/login', '/publicity']) {
      expect(optionsFor(url)).toEqual({
        origin: ['https://portal.example'],
        credentials: true,
      });
    }
  });

  it('still reads the earlier PUBLIC_CORS_ORIGINS name', () => {
    delete process.env.CORS_ALLOWED_ORIGINS;
    process.env.PUBLIC_CORS_ORIGINS = 'https://quiptechfield.com.au';
    expect(optionsFor('/public/demo-requests').origin).toEqual([
      'https://quiptechfield.com.au',
    ]);
  });

  it('defaults to the local landing app in development', () => {
    delete process.env.CORS_ALLOWED_ORIGINS;
    delete process.env.PUBLIC_CORS_ORIGINS;
    expect(optionsFor('/public/demo-requests').origin).toEqual([
      'http://localhost:3000',
    ]);
  });
});
