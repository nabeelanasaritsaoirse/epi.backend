# Temporal Workflows for EPI Backend

This directory contains sample Temporal workflow implementations that demonstrate how to migrate the existing cron-based and service-layer logic to Temporal's durable execution model.

## Directory Structure

```
temporal-examples/
├── workflows/           # Temporal workflow definitions
│   ├── autopayWorkflow.ts    # Daily autopay processing
│   └── paymentWorkflow.ts    # Payment saga with compensation
├── activities/          # Temporal activities (business logic)
│   ├── autopayActivities.ts  # Autopay-related activities
│   └── paymentActivities.ts  # Payment-related activities
├── workers/             # Temporal worker configuration
│   └── worker.ts             # Main worker process
├── package.json         # Dependencies
└── README.md           # This file
```

## Getting Started

### 1. Install Temporal Server (Development)

```bash
# Using Docker Compose
git clone https://github.com/temporalio/docker-compose.git
cd docker-compose
docker-compose up -d
```

Access Temporal UI at: http://localhost:8080

### 2. Install Dependencies

```bash
cd temporal-examples
npm install
```

### 3. Start the Worker

```bash
npm run start:worker
```

### 4. Trigger a Workflow (from your Express app)

```typescript
import { Client, Connection } from '@temporalio/client';

// In your Express controller
async function triggerAutopay(timeSlot: string) {
  const connection = await Connection.connect({
    address: 'localhost:7233',
  });

  const client = new Client({ connection });

  const handle = await client.workflow.start('autopayWorkflow', {
    args: [{
      timeSlot,
      date: new Date().toISOString().split('T')[0]
    }],
    taskQueue: 'epi-backend',
    workflowId: `autopay-${timeSlot}-${Date.now()}`,
  });

  return { workflowId: handle.workflowId };
}
```

## Key Concepts

### Workflows vs Activities

- **Workflows**: Orchestration logic, must be deterministic, can sleep/wait for signals
- **Activities**: Business logic, can call databases/APIs, automatically retried

### Saga Pattern (paymentWorkflow.ts)

The payment workflow demonstrates the saga pattern:

1. Each step registers a compensation action
2. On failure, compensations run in reverse order
3. Ensures consistency even with partial failures

```
[Wallet Deduct] → [Create Payment] → [Update Order] → Success
       ↓                ↓                  ↓
    Refund           Void Record      Revert Schedule
       ↑                ↑                  ↑
       └────────────────┴──────────────────┘
                   (on failure)
```

### Signals for Human-in-the-Loop

Workflows can receive external signals for:
- Pausing/resuming autopay processing
- Admin approval for deliveries
- Cancellation requests

```typescript
// From your API
await client.workflow.signalWithStart('orderWorkflow', {
  signal: 'approveDelivery',
  signalArgs: [{ adminId: 'admin123' }],
  workflowId: 'order-123',
  // ...
});
```

## Migrating from Current Implementation

### Before (autopayCron.js)

```javascript
cron.schedule("30 0 * * *", async () => {
  const users = await User.find({ ... });
  for (const user of users) {
    try {
      await processAutopayForUser(user);
    } catch (error) {
      console.error(error); // Lost progress on crash!
    }
  }
});
```

### After (autopayWorkflow.ts)

```typescript
export async function autopayWorkflow(input) {
  const users = await getUsersForAutopay(input.timeSlot);

  for (const user of users) {
    // Pause support via signals
    if (isPaused) await condition(() => !isPaused);

    // Each user processed with automatic retries
    const result = await processUserAutopay(user);

    // Crash? Resume from last checkpoint!
  }
}
```

## Benefits Over Current Implementation

| Feature | Current (node-cron) | Temporal |
|---------|---------------------|----------|
| Server crash | Lost progress | Auto-resume |
| Retry failed users | Manual | Automatic |
| Pause/Resume | Not possible | Built-in signals |
| Debugging | Read logs | Time-travel debug |
| Observability | Custom metrics | Full event history |

## Configuration

Environment variables:

```bash
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default
TEMPORAL_TASK_QUEUE=epi-backend
MAX_CONCURRENT_ACTIVITIES=100
MAX_CONCURRENT_WORKFLOWS=100
```

## Production Considerations

1. **Use Temporal Cloud** for managed hosting
2. **Run multiple workers** for high availability
3. **Set appropriate retry policies** per activity type
4. **Monitor workflow metrics** through Temporal UI or Prometheus

## Further Reading

- [Temporal Documentation](https://docs.temporal.io/)
- [TypeScript SDK Guide](https://docs.temporal.io/typescript)
- [Saga Pattern](https://docs.temporal.io/workflows#saga-pattern)
