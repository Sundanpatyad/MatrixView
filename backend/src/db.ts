import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { config } from './config.js';

let memoryServer: MongoMemoryServer | null = null;

export async function connectDb(): Promise<void> {
  if (config.isProduction && config.useMemoryDb) {
    throw new Error('Refusing in-memory MongoDB in production — data would be wiped on every restart.');
  }

  if (config.useMemoryDb) {
    memoryServer = await MongoMemoryServer.create();
    const uri = memoryServer.getUri('dockx');
    await mongoose.connect(uri);
    console.warn(
      '[db] connected (IN-MEMORY MongoDB) — data is discarded when this process exits. Set USE_MEMORY_DB=false and MONGODB_URI to keep data.',
    );
    return;
  }

  await mongoose.connect(config.mongoUri);
  const host = config.mongoUri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
  console.log('[db] connected (persistent)', host);
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}
