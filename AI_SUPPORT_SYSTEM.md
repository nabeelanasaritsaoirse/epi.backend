# AI Support System Architecture & Roadmap

## 1. System Topology

The system uses a hybrid architecture where the existing Node.js backend serves as the primary API Gateway and State Manager, integrating with a specialized AI Service and a Vector Database for retrieval.

```mermaid
graph TD
    User[Flutter App User] -->|WebSocket/REST| NodeAPI[Node.js Backend]
    NodeAPI -->|Auth & State| MongoDB[(MongoDB - Main DB)]
    NodeAPI -->|Vector Search| VectorDB[(Qdrant/Pinecone)]
    NodeAPI -->|LLM Query| AI_Engine[AI Service (LLM Wrapper)]
    
    NodeAPI -->|Escalation| LiveAgent[Support Agent Dashboard]
    LiveAgent -->|Response| NodeAPI
    
    subgraph "Data Sync"
        MongoDB -->|ETL Pipeline| VectorDB
    end
```

## 2. Database Schema Extensions

We need to extend the `User` role and introduce new models for the Support System.

### 2.1 User Role Update
Add `support_agent` to the `role` enum in `models/User.js`.

### 2.2 Support Ticket Model (`models/SupportTicket.js`)
Tracks the lifecycle of a support interaction.
```javascript
const SupportTicketSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  assignedAgent: { type: Schema.Types.ObjectId, ref: 'User' },
  status: { 
    type: String, 
    enum: ['open', 'in_progress', 'resolved', 'closed'], 
    default: 'open' 
  },
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  category: { type: String }, // e.g., 'payment', 'technical', 'inquiry'
  tags: [String],
  messages: [{
    sender: { type: String, enum: ['user', 'bot', 'agent'], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    meta: { type: Map, of: String } // e.g., confidence_score for bot
  }],
  confidenceScore: { type: Number }, // Moving average of bot certainty
  isEscalated: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
```

### 2.3 Knowledge Base Model (`models/KnowledgeNode.js`)
Stores the original content that is vectorized.
```javascript
const KnowledgeNodeSchema = new Schema({
  title: { type: String, required: true },
  content: { type: String, required: true }, // Markdown/Text
  source: { type: String }, // URL or Doc ID
  tags: [String],
  vectorId: { type: String }, // ID in Vector DB
  lastSyncedAt: { type: Date }
});
```

## 3. API Specifications

### 2.4 Dynamic Context & Tools
The bot must access real-time user data. We define "Tools" that the AI can call.

**Tool Definitions (Virtual Functions):**
1.  `getUserOrders(userId)`: Returns list of recent orders with status (`pending`, `shipped`) and delivery dates.
2.  `getWalletSummary(userId)`: Returns balance, commission earned, and recent transactions.
3.  `explainCommission(userId)`: Analyzes `wallet.transactions` to explain *how* a specific commission was calculated (e.g., "Referral Bonus from User X").

**Context Injection Strategy:**
Before sending the prompt to the LLM, we append a **System Context Block**:
```json
{
  "user_context": {
    "name": "John Doe",
    "role": "user",
    "recent_orders": [ ... ], // Result of getUserOrders
    "wallet": { ... } // Result of getWalletSummary
  },
  "tools_available": ["check_order_status", "explain_commission"]
}
```

## 3. API Specifications

### 3.1 Chat Interface
*   **POST** `/api/support/query`
    *   **Body**: `{ "message": "Where is my commission from?", "clientTime": "..." }`
    *   **Logic**:
        1.  **Context Assembly**: Fetch User Profile + Last 3 Orders + Wallet Summary.
        2.  **Vector Retrieval**: Fetch relevant policy docs (e.g., "Commission Logic.md") from Vector DB.
        3.  **LLM Call**: Send `(System Prompt + User Data + Vector Docs + User Query)`.
        4.  **Tool Execution**: If LLM response indicates a need for more specific data (e.g., "I need to check order #123"), the backend executes the specific DB query and re-prompts the LLM.
        5.  **Response**: Return the final natural language answer.
        6.  **Learning Loop**: If the answer is marked "Helpful" by the user, store the Q&A pair in Vector DB for future "Similar Query" short-circuiting.

### 3.2 Escalation & Agent
*   **POST** `/api/support/escalate`
    *   **Body**: `{ "ticketId": "...", "reason": "User requested" }`
    *   **Logic**: Update status to `open`, notify available agents via Socket/FCM.
    *   **Context Passing**: The agent sees the *entire* Bot-User conversation history to avoid "Repeat yourself" frustration.

*   **GET** `/api/support/agent/queue`
    *   **Logic**: List unassigned, open tickets (Agent Only).

*   **POST** `/api/support/agent/take`
    *   **Body**: `{ "ticketId": "..." }`
    *   **Logic**: Assign ticket to current agent.

## 4. Scalability & Offline Handling

*   **Offline Fallback**:
    *   If no agents are online (checked via Redis Presence or DB 'last_seen'), the system switches to **Async Mode**.
    *   The Bot informs the user: "Our agents are offline. I've created Ticket #123. We'll email you shortly."
    *   The ticket is flagged as `offline_queued`.

*   **Auto-Resolution & Learning**:
    *   **RLHF Lite**: When a human agent acts (e.g., "Refunded Order #555"), the system records the *Action* and the *User Query*.
    *   **Feedback Loop**: A nightly job vectorizes these "Human Resolved" interactions. Next time a user asks "Refund my order," the Bot sees the historical precedent and can say, "I see we usually process this manually. I've flagged this for an agent." rather than hallucinating a policy.

## 5. Implementation Roadmap

### Phase 1: Foundation (Week 1)
1.  [ ] Setup Vector Database (Pinecone/Qdrant).
2.  [ ] Create `KnowledgeNode` model and script to ingest current docs (`.md` files).
3.  [ ] Implement generic `readUserContext` helper function (Orders + Wallet).

### Phase 2: Bot Intelligence (Week 2)
1.  [ ] Create `SupportTicket` model.
2.  [ ] Implement RAG Pipeline: `Retrieval` -> `Context Injection` -> `LLM Generation`.
3.  [ ] **Tooling**: Implement `get_order_status` and `get_commission_details` tool logic for the Bot.

### Phase 3: Agent & Learning (Week 3)
1.  [ ] Build "Agent Dashboard" (Frontend).
2.  [ ] Implement "Convert Resolution to Knowledge" pipeline (Auto-learning).
3.  [ ] Add WebSocket support for real-time Agent <-> User chat.

### Phase 4: Polish (Week 4)
1.  [ ] Implement 'Offline' fallback emails.
2.  [ ] Analytics Dashboard (Common topics, Bot success rate).
