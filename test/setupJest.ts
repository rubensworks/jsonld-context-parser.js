import {readFileSync} from "fs";

// Mock fetch to our local files
(<any> global).fetch = jest.fn().mockImplementation((url) => {
  let data: any;
  try {
    const filePath: string = url.replace('http://example.org/', __dirname + '/http/');
    data = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (e) {
    return Promise.resolve({
      json: () => Promise.reject(new Error('Invalid request')),
      ok: false,
    });
  }
  return Promise.resolve({
    json: () => data,
    ok: true,
  });
});
