import prisma from './prisma';
import logger from './logger';

export const connectDatabase = async (): Promise<void> => {
  try {
    logger.info('Connecting to Supabase PostgreSQL via Prisma...');
    await prisma.$connect();
    logger.info('Supabase PostgreSQL connected successfully.');
  } catch (error) {
    logger.error('Failed to connect to Supabase PostgreSQL: %O', error);
    process.exit(1);
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  await prisma.$disconnect();
  logger.info('Supabase PostgreSQL disconnected.');
};
