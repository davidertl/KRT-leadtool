/**
 * Voice module bootstrap.
 */

const { createVoiceRelay } = require('./relay');
const { createVoiceRoutes } = require('./routes');

function createVoiceModule({ query, valkey }) {
  const voiceRelay = createVoiceRelay({ query, valkey });

  return {
    id: 'voice',
    init() {
      voiceRelay.start();
    },
    routes() {
      return {
        basePath: '/api/voice',
        router: createVoiceRoutes({ voiceRelay }),
      };
    },
    handleUpgrade(pathname, req, socket, head) {
      if (pathname !== '/voice') return false;
      voiceRelay.handleUpgrade(req, socket, head);
      return true;
    },
    health() {
      return { status: 'ok' };
    },
    voiceRelay,
  };
}

module.exports = { createVoiceModule };
