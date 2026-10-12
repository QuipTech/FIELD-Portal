import { buildAlertEmail } from './alertEmailTemplate';

const MESSAGE = {
  title: 'CAT 793F <b>down</b>',
  body: 'Pit 4',
  url: 'https://portal.example.com/machines/1/history',
  ruleName: 'Machine down too long',
  organisationName: 'TRT',
  accentColor: '#123456',
};

describe('buildAlertEmail', () => {
  it('includes the direct link in both the HTML and the text', () => {
    const email = buildAlertEmail(MESSAGE, 'Ada');
    expect(email.html).toContain(`href="${MESSAGE.url}"`);
    expect(email.text).toContain(MESSAGE.url);
  });

  it('escapes typed text and uses the accent colour', () => {
    const email = buildAlertEmail(MESSAGE, 'Ada');
    expect(email.html).toContain('CAT 793F &lt;b&gt;down&lt;/b&gt;');
    expect(email.html).toContain('background:#123456');
  });

  it('ignores a colour that is not plain hex', () => {
    const email = buildAlertEmail(
      { ...MESSAGE, accentColor: 'red;background:url(x)' },
      'Ada',
    );
    expect(email.html).not.toContain('url(x)');
    expect(email.html).toContain('#4F39F6');
  });
});
