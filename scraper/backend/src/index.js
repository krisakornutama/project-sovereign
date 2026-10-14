import 'dotenv/config';
import { createApp } from './app.js';

const PORT = parseInt(process.env.PORT || '4000', 10);
const app = createApp();

const server = app.listen(PORT, () => {
  console.log(`Sovereign Scraper API listening on :${PORT}`);
});

function shutdown(signal) {
  console.log(`Received ${signal}, shutting down...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
