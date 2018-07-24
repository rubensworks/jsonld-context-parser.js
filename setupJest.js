// Mock fetch to our local files
global.fetch = jest.fn().mockImplementation((url) => {
  let data;
  try {
    const filePath = url.replace('http://example.org/', __dirname + '/test/http/');
    data = JSON.parse(require('fs').readFileSync(filePath, 'utf8'));
  } catch (e) {
    return Promise.resolve({
      json: null,
      ok: false,
    });
  }
  return Promise.resolve({
    json: () => data,
    ok: true,
  });
});
