import o from 'ospec';
import { handler } from '../index.js';
import { mockRequest } from './xyz.util.js';

o.spec('LambdaXyz index', () => {
  o('should export handler', async () => {
    const foo = await import('../index.js');
    o(typeof foo.handler).equals('function');
  });

  o.spec('version', () => {
    const origVersion: any = process.env.GIT_VERSION;
    const origHash: any = process.env.GIT_HASH;
    o.after(() => {
      process.env.GIT_VERSION = origVersion;
      process.env.GIT_HASH = origHash;
    });

    o('should return version', async () => {
      process.env.GIT_VERSION = '1.2.3';
      process.env.GIT_HASH = 'abc456';

      const response = await handler.router.handle(mockRequest('/v1/version'));

      o(response.status).equals(200);
      o(response.statusDescription).equals('ok');
      o(response.header('cache-control')).equals('no-store');
      o(JSON.parse(response.body as string)).deepEquals({
        version: '1.2.3',
        hash: 'abc456',
      });
    });
  });

  o('should respond to /ping', async () => {
    const res = await handler.router.handle(mockRequest('/v1/ping'));
    o(res.status).equals(200);
    o(res.statusDescription).equals('ok');
    o(res.header('cache-control')).equals('no-store');
  });
});
