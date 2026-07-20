import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { config } from './config.js';

let memoryServer: MongoMemoryServer | null = null;

export async function connectDb(): Promise<void> {
  if (config.useMemoryDb) {
    memoryServer = await MongoMemoryServer.create();
    const uri = memoryServer.getUri('dockx');
    await mongoose.connect(uri);
    console.log('[db] connected (in-memory MongoDB)');
    return;
  }

  try {
    await mongoose.connect(config.mongoUri);
    const host = config.mongoUri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
    console.log('[db] connected', host);
  } catch (err) {
    if (!config.useMemoryDb) {
      console.error('[db] MongoDB connection failed (USE_MEMORY_DB=false):', err);
      throw err;
    }
    console.warn('[db] MongoDB unavailable, falling back to in-memory:', err);
    memoryServer = await MongoMemoryServer.create();
    await mongoose.connect(memoryServer.getUri('dockx'));
    console.log('[db] connected (in-memory MongoDB fallback)');
  }
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}
