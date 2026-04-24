/**
 * Temporal Worker Configuration
 *
 * This file sets up the Temporal worker that executes workflows and activities.
 * Run this as a separate process from your Express server.
 *
 * Usage:
 *   npx ts-node workers/worker.ts
 *
 * Or in production:
 *   node dist/workers/worker.js
 */

import { NativeConnection, Worker } from '@temporalio/worker';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Import all activities
import * as autopayActivities from '../activities/autopayActivities';
// import * as paymentActivities from '../activities/paymentActivities';
// import * as orderActivities from '../activities/orderActivities';

// ============================================
// CONFIGURATION
// ============================================

interface WorkerConfig {
  temporalAddress: string;
  namespace: string;
  taskQueue: string;
  maxConcurrentActivities: number;
  maxConcurrentWorkflows: number;
}

const config: WorkerConfig = {
  temporalAddress: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
  namespace: process.env.TEMPORAL_NAMESPACE || 'default',
  taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'epi-backend',
  maxConcurrentActivities: parseInt(process.env.MAX_CONCURRENT_ACTIVITIES || '100'),
  maxConcurrentWorkflows: parseInt(process.env.MAX_CONCURRENT_WORKFLOWS || '100'),
};

// ============================================
// WORKER INITIALIZATION
// ============================================

async function run() {
  console.log('========================================');
  console.log('[Temporal Worker] Starting worker...');
  console.log(`[Temporal Worker] Address: ${config.temporalAddress}`);
  console.log(`[Temporal Worker] Namespace: ${config.namespace}`);
  console.log(`[Temporal Worker] Task Queue: ${config.taskQueue}`);
  console.log('========================================');

  // Connect to Temporal server
  const connection = await NativeConnection.connect({
    address: config.temporalAddress,
  });

  // Create worker
  const worker = await Worker.create({
    connection,
    namespace: config.namespace,
    taskQueue: config.taskQueue,

    // Workflows are loaded from files
    workflowsPath: resolve(__dirname, '../workflows'),

    // Activities are passed directly
    activities: {
      ...autopayActivities,
      // ...paymentActivities,
      // ...orderActivities,
    },

    // Concurrency settings
    maxConcurrentActivityTaskExecutions: config.maxConcurrentActivities,
    maxConcurrentWorkflowTaskExecutions: config.maxConcurrentWorkflows,

    // Graceful shutdown
    shutdownGraceTime: '30 seconds',
  });

  console.log('[Temporal Worker] Worker created successfully');
  console.log('[Temporal Worker] Listening for tasks...');

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log('[Temporal Worker] Shutting down...');
    await worker.shutdown();
    await connection.close();
    console.log('[Temporal Worker] Shutdown complete');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Run the worker
  await worker.run();
}

// ============================================
// ERROR HANDLING
// ============================================

run().catch((err) => {
  console.error('[Temporal Worker] Fatal error:', err);
  process.exit(1);
});
