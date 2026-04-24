# AI Chatbot - Technology Stack Recommendation

**Document Version:** 1.0
**Date:** December 31, 2025
**Prepared By:** Technical Architecture Team
**Project:** EPI (Epielio) E-commerce & Investment Platform
**Status:** For Senior Review & Approval

---

## 1. Executive Summary

### 1.1 Project Context

EPI (Epielio) is a production e-commerce and gold/jewelry investment platform built on **Node.js + Express.js + MongoDB** with 150+ API endpoints. The platform currently serves customers through a mobile app with features including:
- Installment-based product purchases (Daily SIP, Monthly EMI)
- Wallet and referral commission system
- Firebase-based authentication and push notifications
- Existing basic chat system for user-to-admin communication

### 1.2 Business Objective

Implement an AI-powered chatbot to enhance customer experience, reduce support workload, and provide 24/7 assistance for:
- Order tracking and status inquiries
- Product recommendations and catalog queries
- Payment and installment schedule questions
- Referral program information
- KYC verification assistance
- General FAQ responses

### 1.3 Key Recommendation

**Primary Choice: n8n + OpenAI GPT-4/GPT-4o Integration**

This recommendation is based on:
- Seamless integration with existing Node.js/MongoDB stack
- Self-hosting capability for cost control and data privacy
- Visual workflow builder for non-technical team updates
- Native integrations with Firebase, MongoDB, and REST APIs
- Flexible LLM provider switching (OpenAI, Claude, local models)

**Alternative Choice: Custom Node.js Solution with LangChain.js**

For teams preferring maximum control and customization with developer-first approach.

---

## 2. Project Requirements Analysis

### 2.1 Business Objectives

| Objective | Priority | Success Metric |
|-----------|----------|----------------|
| Reduce customer support tickets | High | 40% reduction in common queries |
| 24/7 availability | High | 99.9% uptime |
| Faster response time | High | < 3 second average response |
| Personalized assistance | Medium | Product recommendations based on history |
| Support multiple languages | Medium | Hindi + English initially |
| Seamless handoff to human agents | High | < 2 click escalation |

### 2.2 Functional Requirements

Based on analysis of the existing codebase and features:

| Feature | Description | Integration Points |
|---------|-------------|-------------------|
| **Order Tracking** | Check order status, payment schedules, delivery updates | `InstallmentOrder`, `PaymentRecord` models |
| **Product Queries** | Search products, get details, availability, pricing | `Product`, `Category` models |
| **Payment Assistance** | Installment due dates, payment history, wallet balance | `WalletTransaction`, `PaymentRecord` |
| **Referral Information** | Commission status, referral code, earnings | `Referral`, `DailyCommission` models |
| **KYC Support** | Verification status, document requirements | `Kyc` model |
| **Account Help** | Profile updates, address management, password reset | `User` model |
| **FAQ Responses** | Common questions about platform, policies, returns | Static knowledge base |
| **Human Escalation** | Transfer to live agent when AI cannot resolve | Existing `Chat`, `Conversation` services |

### 2.3 Non-Functional Requirements

| Requirement | Specification | Notes |
|-------------|--------------|-------|
| **Scalability** | 1,000+ concurrent users | Current user base + growth projection |
| **Response Time** | < 3 seconds | Critical for user experience |
| **Availability** | 99.9% uptime | 24/7 operation required |
| **Security** | End-to-end encryption, PII protection | Financial data handling |
| **Data Residency** | India preferred | Compliance considerations |
| **Cost Efficiency** | < $500/month operational | Budget conscious for MVP |

### 2.4 Integration Requirements

| System | Integration Type | Priority |
|--------|-----------------|----------|
| **MongoDB** | Direct database queries for user data | Critical |
| **Firebase Auth** | User authentication and session | Critical |
| **Firebase FCM** | Push notification triggers | High |
| **Razorpay** | Payment status verification | High |
| **AWS S3** | Product images, documents | Medium |
| **Existing Chat API** | Human handoff integration | High |
| **REST API** | Access all 150+ existing endpoints | Critical |

### 2.5 Team Capabilities Assessment

Based on existing codebase analysis:

| Skill | Current Level | Notes |
|-------|---------------|-------|
| **Node.js/Express** | Expert | Primary backend stack |
| **MongoDB/Mongoose** | Expert | All data layer |
| **REST API Development** | Expert | 150+ endpoints |
| **Python** | Limited | No Python code in current stack |
| **DevOps/CI-CD** | Basic | Manual deployment, PM2 |
| **AI/ML** | Beginner | No existing AI implementation |

### 2.6 Constraints

1. **Budget:** Cost-effective solution required; avoid high per-message fees at scale
2. **Timeline:** MVP needed within 4-6 weeks
3. **Team:** No dedicated ML engineers; solution must be maintainable by existing Node.js team
4. **Infrastructure:** Preference for self-hosted or hybrid to control costs
5. **Data Privacy:** User financial data must not leave controlled environment

---

## 3. Technology Options Evaluated

### 3.1 Comparison Matrix

| Criteria | n8n + OpenAI | LangChain.js | Botpress | Dialogflow CX | Rasa | Flowise | MS Bot Framework |
|----------|-------------|--------------|----------|---------------|------|---------|------------------|
| **Ease of Setup** | 9/10 | 7/10 | 8/10 | 8/10 | 5/10 | 9/10 | 6/10 |
| **AI/LLM Integration** | 10/10 | 10/10 | 8/10 | 7/10 | 6/10 | 9/10 | 7/10 |
| **Customization** | 9/10 | 10/10 | 7/10 | 6/10 | 10/10 | 7/10 | 8/10 |
| **Scalability** | 8/10 | 9/10 | 8/10 | 10/10 | 9/10 | 7/10 | 9/10 |
| **Node.js Compatibility** | 10/10 | 10/10 | 8/10 | 7/10 | 3/10 | 10/10 | 8/10 |
| **MongoDB Integration** | 9/10 | 10/10 | 6/10 | 5/10 | 7/10 | 8/10 | 6/10 |
| **Learning Curve** | Low | Medium | Low | Medium | High | Low | High |
| **Self-Hosting** | Yes | Yes | Yes | No | Yes | Yes | Partial |
| **Community/Support** | Strong | Strong | Moderate | Strong | Strong | Growing | Strong |
| **Cost (Monthly)** | $20-100* | $50-200* | $0-500 | $300-2000+ | $0* | $0-100* | $200-1000+ |

*Plus LLM API costs (OpenAI: ~$0.01-0.03 per 1K tokens)

### 3.2 Scoring Legend

- **10/10:** Excellent, perfect fit
- **8-9/10:** Very good, minor limitations
- **6-7/10:** Good, some compromises needed
- **4-5/10:** Acceptable, significant effort required
- **1-3/10:** Poor fit, not recommended

---

## 4. Detailed Analysis of Each Option

### 4.1 n8n + OpenAI GPT Integration (RECOMMENDED)

**Overview:**
n8n is an open-source workflow automation platform that can be self-hosted. Combined with OpenAI's GPT models, it provides a powerful no-code/low-code solution for building AI chatbots with deep system integrations.

**Architecture:**
```
[Mobile App] --> [n8n Webhook] --> [AI Processing Node]
                      |                    |
                      v                    v
               [MongoDB Query]      [OpenAI API]
                      |                    |
                      v                    v
               [User Context]       [Response Gen]
                      |                    |
                      +-----> [Response] <-+
```

**Pros:**
- Visual workflow builder for easy updates
- Native MongoDB, HTTP, and webhook nodes
- Self-hosted option for data privacy and cost control
- Supports multiple LLM providers (OpenAI, Anthropic, local)
- 400+ pre-built integrations
- Active community with 40K+ GitHub stars
- JavaScript/TypeScript compatible (aligns with team skills)
- Built-in error handling and retry logic
- Credential management and encryption
- Queue system for handling bursts

**Cons:**
- Requires self-hosting for production (or paid cloud at $50+/month)
- Complex workflows can become visually cluttered
- Limited native NLP preprocessing compared to dedicated platforms
- May require custom nodes for specific integrations

**Best Suited For:**
- Teams wanting rapid development with visual workflows
- Projects requiring deep integration with existing systems
- Organizations prioritizing cost control and self-hosting
- MVP development with iteration capability

**Implementation Complexity:** Low-Medium

**Sample Workflow:**
```javascript
// n8n Custom Function Node Example
const userMessage = $input.first().json.message;
const userId = $input.first().json.userId;

// Fetch user context from MongoDB
const userContext = await $db.collection('users').findOne({ _id: userId });
const recentOrders = await $db.collection('installmentorders')
  .find({ user: userId })
  .limit(5)
  .toArray();

// Build context for GPT
const systemPrompt = `You are EPI's customer assistant.
User: ${userContext.name}
Wallet Balance: Rs. ${userContext.wallet.balance}
Recent Orders: ${JSON.stringify(recentOrders)}
Always be helpful and concise.`;

return { systemPrompt, userMessage };
```

---

### 4.2 Custom Node.js + LangChain.js (ALTERNATIVE)

**Overview:**
LangChain.js is the JavaScript/TypeScript port of the popular LangChain framework for building LLM-powered applications. It provides building blocks for chains, agents, memory, and tool integration.

**Architecture:**
```
[Mobile App] --> [Express API] --> [LangChain Agent]
                      |                    |
                      v                    v
               [Custom Tools]        [Vector Store]
                      |                    |
                      v                    v
               [MongoDB/APIs]        [Embeddings]
                      |                    |
                      +-----> [Response] <-+
```

**Pros:**
- Maximum flexibility and customization
- Native Node.js/TypeScript - perfect team skill match
- Direct integration with Express.js API
- Powerful agent and chain abstractions
- Support for RAG (Retrieval Augmented Generation)
- Local embedding options (reduce API costs)
- Fine-grained control over prompts and responses
- Memory management built-in
- Growing ecosystem with active development

**Cons:**
- Requires more development effort
- No visual interface for non-technical updates
- Steeper learning curve for LangChain concepts
- More code to maintain
- Debugging complex chains can be challenging

**Best Suited For:**
- Teams with strong development resources
- Projects requiring highly customized AI behavior
- Complex multi-step reasoning requirements
- Maximum control over every component

**Implementation Complexity:** Medium-High

**Sample Implementation:**
```javascript
// LangChain.js Agent Setup
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";

const llm = new ChatOpenAI({
  modelName: "gpt-4o",
  temperature: 0.7
});

// Custom tools for EPI platform
const tools = [
  new OrderStatusTool(mongoClient),
  new WalletBalanceTool(mongoClient),
  new ProductSearchTool(mongoClient),
  new PaymentScheduleTool(mongoClient),
  new EscalateToHumanTool(chatService)
];

const agent = createReactAgent({
  llm,
  tools,
  systemMessage: `You are EPI's AI assistant for gold investments...`
});

// Express endpoint
app.post('/api/chat/ai', async (req, res) => {
  const { message, userId } = req.body;
  const result = await agent.invoke({
    messages: [{ role: "user", content: message }],
    userId
  });
  res.json({ response: result.output });
});
```

---

### 4.3 Botpress

**Overview:**
Botpress is an open-source conversational AI platform with visual flow builder and built-in NLU.

**Pros:**
- Visual conversation flow designer
- Built-in NLU engine
- Self-hosted option available
- Good documentation and tutorials
- Channel integrations (web, WhatsApp, etc.)

**Cons:**
- Less flexible for deep custom integrations
- NLU may not match GPT quality
- Limited MongoDB native support
- Cloud pricing can escalate quickly
- Smaller community than n8n

**Best Suited For:**
- Simple FAQ bots with defined conversation flows
- Projects where visual design is priority
- Teams with limited development resources

**Implementation Complexity:** Low

---

### 4.4 Google Dialogflow CX

**Overview:**
Enterprise-grade conversational AI platform from Google with advanced NLU and multi-turn conversation support.

**Pros:**
- Enterprise-grade reliability
- Excellent NLU capabilities
- Multi-language support out of box
- Google Cloud integration
- Advanced conversation flows

**Cons:**
- No self-hosting option
- Pricing can be expensive at scale ($0.007/request + text analysis)
- Data leaves your infrastructure
- Vendor lock-in concerns
- Less flexible for custom LLM integration
- Requires Google Cloud expertise

**Best Suited For:**
- Enterprise projects with Google Cloud stack
- Teams prioritizing reliability over customization
- Projects with significant budget

**Implementation Complexity:** Medium

---

### 4.5 Rasa

**Overview:**
Open-source conversational AI framework focused on on-premise deployment and customization.

**Pros:**
- Fully open-source and self-hosted
- Complete control over data
- Highly customizable
- Strong community
- No per-message pricing

**Cons:**
- Python-based (team skill mismatch)
- Steep learning curve
- Requires ML expertise for training
- Complex infrastructure setup
- Rasa Pro (enterprise) is expensive

**Best Suited For:**
- Teams with Python/ML expertise
- Strict data privacy requirements
- Projects needing custom NLU models

**Implementation Complexity:** High

---

### 4.6 Flowise

**Overview:**
Open-source UI visual tool to build customized LLM flows using LangChain.

**Pros:**
- Visual LangChain builder
- Self-hosted and open-source
- Easy to get started
- Node.js based
- Good for prototyping

**Cons:**
- Less mature than n8n
- Limited production-grade features
- Smaller community
- Less robust error handling
- Limited enterprise features

**Best Suited For:**
- Rapid prototyping
- Teams wanting visual LangChain without coding
- POC development

**Implementation Complexity:** Low

---

### 4.7 Microsoft Bot Framework

**Overview:**
Comprehensive framework for building enterprise-grade conversational bots with Azure integration.

**Pros:**
- Enterprise-grade security
- Azure AI integration
- Multi-channel support
- Comprehensive SDK
- Good for Microsoft ecosystem

**Cons:**
- Complex setup
- Azure dependency
- Steeper learning curve
- Less flexible for non-Azure deployments
- Can be expensive at scale

**Best Suited For:**
- Microsoft Azure shops
- Enterprise projects with compliance requirements
- Teams with Azure expertise

**Implementation Complexity:** High

---

## 5. Recommendation

### 5.1 Primary Recommendation: n8n + OpenAI GPT-4o

**Justification:**

| Factor | Rationale |
|--------|-----------|
| **Team Alignment** | JavaScript-based, minimal learning curve |
| **Integration Depth** | Native MongoDB, HTTP, webhook support matches existing stack |
| **Time to Market** | Visual builder enables faster iteration |
| **Cost Control** | Self-hosted option eliminates platform fees |
| **Flexibility** | Easy to switch LLM providers (OpenAI, Claude, local) |
| **Maintainability** | Non-technical team members can update flows |
| **Scalability** | Worker queues handle traffic spikes |

**Recommended Architecture:**

```
                    +------------------+
                    |   Mobile App     |
                    +--------+---------+
                             |
                             v
                    +------------------+
                    | Firebase FCM +   |
                    | Existing API     |
                    +--------+---------+
                             |
              +--------------+--------------+
              |                             |
              v                             v
     +----------------+           +------------------+
     | Existing Chat  |           | n8n Webhook      |
     | System (Human) |           | (AI Chatbot)     |
     +----------------+           +--------+---------+
                                           |
                    +----------------------+----------------------+
                    |                      |                      |
                    v                      v                      v
           +----------------+    +------------------+    +----------------+
           | Context Loader |    | OpenAI GPT-4o    |    | Tool Executor  |
           | (MongoDB)      |    | (Response Gen)   |    | (Actions)      |
           +----------------+    +------------------+    +----------------+
                    |                      |                      |
                    v                      v                      v
           +----------------+    +------------------+    +----------------+
           | User Profile   |    | Knowledge Base   |    | Order Status   |
           | Order History  |    | Product Catalog  |    | Wallet Balance |
           | Wallet Balance |    | FAQ Database     |    | Human Handoff  |
           +----------------+    +------------------+    +----------------+
```

### 5.2 Alternative Recommendation: LangChain.js Custom Solution

**When to Choose This Instead:**

- Team prefers full code control over visual builders
- Requirement for complex multi-step reasoning chains
- Need for custom memory management
- Plan to build proprietary AI features
- Budget for additional development time

### 5.3 Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| OpenAI API downtime | Low | High | Implement fallback to Claude API |
| Cost overrun from API usage | Medium | Medium | Set rate limits, implement caching |
| AI hallucinations | Medium | High | Implement guardrails, human review |
| Integration complexity | Low | Medium | Use n8n's built-in MongoDB nodes |
| Performance under load | Medium | Medium | Implement response caching, queue management |
| Data privacy concerns | Low | High | Self-host n8n, use system prompts to prevent data leakage |

---

## 6. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

| Task | Duration | Owner | Deliverable |
|------|----------|-------|-------------|
| Set up n8n self-hosted instance | 2 days | DevOps | Running n8n on production server |
| Configure MongoDB connection | 1 day | Backend | Secure database access |
| Set up OpenAI API integration | 1 day | Backend | Working API connection |
| Create base webhook endpoint | 2 days | Backend | `/api/chat/ai` endpoint |
| Design system prompt | 2 days | Product + Dev | Optimized AI personality |
| Basic response flow | 2 days | Backend | Simple Q&A working |

### Phase 2: Core Features (Week 3-4)

| Task | Duration | Owner | Deliverable |
|------|----------|-------|-------------|
| Order status lookup tool | 2 days | Backend | Real-time order queries |
| Product search integration | 2 days | Backend | Product recommendations |
| Wallet balance queries | 1 day | Backend | Balance and transaction history |
| Payment schedule info | 2 days | Backend | Installment due dates |
| Context memory setup | 2 days | Backend | Conversation continuity |
| Error handling flows | 2 days | Backend | Graceful error responses |

### Phase 3: Enhancement (Week 5-6)

| Task | Duration | Owner | Deliverable |
|------|----------|-------|-------------|
| Human escalation flow | 2 days | Backend | Seamless handoff to existing chat |
| Multi-language support | 3 days | Backend | Hindi + English |
| Knowledge base (RAG) setup | 3 days | Backend | FAQ and policy answers |
| Analytics and logging | 2 days | Backend | Usage metrics dashboard |
| Rate limiting and guardrails | 1 day | Backend | Abuse prevention |
| Mobile app integration | 2 days | Mobile | Chat UI updates |

### Phase 4: Testing & Launch (Week 7-8)

| Task | Duration | Owner | Deliverable |
|------|----------|-------|-------------|
| Internal testing | 3 days | QA | Bug fixes and improvements |
| Beta testing with select users | 5 days | Product | User feedback |
| Performance optimization | 2 days | Backend | Response time < 3s |
| Documentation | 2 days | Backend | Admin guide, API docs |
| Production deployment | 1 day | DevOps | Live system |
| Monitoring setup | 1 day | DevOps | Alerts and dashboards |

---

## 7. Cost Estimation

### 7.1 Development Costs

| Item | Effort | Cost (Internal) |
|------|--------|-----------------|
| Backend Development | 160 hours | Internal team |
| DevOps Setup | 24 hours | Internal team |
| Mobile Integration | 40 hours | Internal team |
| QA Testing | 40 hours | Internal team |
| **Total Development** | **264 hours** | **Internal** |

### 7.2 Infrastructure Costs (Monthly)

| Component | Self-Hosted | Cloud Option |
|-----------|-------------|--------------|
| n8n Platform | $0 (self-hosted) | $50-200/month |
| Server (n8n hosting) | $20-50/month (existing) | N/A |
| OpenAI API (GPT-4o) | $100-300/month* | Same |
| MongoDB (existing) | $0 (already running) | Same |
| **Total Monthly** | **$120-350/month** | **$170-500/month** |

*Based on estimated 50,000-150,000 messages/month at $0.002-0.003/message avg

### 7.3 Cost Optimization Strategies

1. **Response Caching:** Cache common queries (FAQ, product info) - saves 30-40% API costs
2. **Tiered Model Usage:** Use GPT-3.5 for simple queries, GPT-4o for complex - saves 50%
3. **Context Truncation:** Limit conversation history to last 5 messages - saves 40%
4. **Local Embeddings:** Use local embedding models for RAG - reduces API calls

### 7.4 Cost Comparison: Build vs. Buy

| Approach | Year 1 | Year 2 | Year 3 |
|----------|--------|--------|--------|
| **n8n Self-Hosted** | $4,000 | $3,000 | $3,000 |
| **Dialogflow CX** | $12,000 | $15,000 | $18,000 |
| **Intercom AI** | $18,000 | $22,000 | $26,000 |
| **Zendesk AI** | $24,000 | $28,000 | $32,000 |

*n8n self-hosted provides 5-8x cost savings over commercial solutions*

---

## 8. Questions for Senior Review

### 8.1 Strategic Decisions Required

1. **Budget Approval:**
   - Approve monthly operational budget of $150-350 for AI services?
   - Approve development time investment of 264 hours (6-7 weeks)?

2. **Data Privacy:**
   - Confirm self-hosted n8n is preferred for data control?
   - Approve sending anonymized queries to OpenAI API?

3. **Scope Definition:**
   - Confirm initial feature set (order, wallet, product, FAQ)?
   - Prioritize languages: Start with English only or Hindi + English?

4. **Integration Priority:**
   - Should AI chatbot replace or supplement existing human chat?
   - Required response time SLA (recommendation: 3 seconds)?

5. **Success Metrics:**
   - Target support ticket reduction percentage?
   - Customer satisfaction score target?

### 8.2 Technical Decisions Required

1. **LLM Provider:**
   - Primary: OpenAI (GPT-4o) - Confirm?
   - Backup: Anthropic Claude - Approved as fallback?

2. **Deployment:**
   - Self-hosted n8n on existing infrastructure - Confirm?
   - Separate server for isolation - Required?

3. **Scaling Strategy:**
   - Initial capacity: 100 concurrent users - Sufficient?
   - Auto-scaling requirements?

### 8.3 Risk Acceptance

1. **AI Limitations:**
   - Accept that AI may occasionally provide incorrect information?
   - Approve human-in-the-loop for financial transactions?

2. **Vendor Dependencies:**
   - Accept OpenAI API dependency for core functionality?
   - Approve backup provider (Claude) for redundancy?

---

## 9. Appendix

### 9.1 Glossary

| Term | Definition |
|------|------------|
| **LLM** | Large Language Model (e.g., GPT-4, Claude) |
| **RAG** | Retrieval Augmented Generation - enhancing LLM with knowledge base |
| **n8n** | Open-source workflow automation platform |
| **LangChain** | Framework for building LLM-powered applications |
| **Token** | Basic unit of text processing (~4 characters) |
| **Embedding** | Vector representation of text for similarity search |
| **Context Window** | Maximum text an LLM can process at once |

### 9.2 Reference Links

- n8n Documentation: https://docs.n8n.io
- OpenAI API: https://platform.openai.com/docs
- LangChain.js: https://js.langchain.com
- MongoDB Atlas Vector Search: https://www.mongodb.com/atlas/search

### 9.3 Existing Integration Points

| Endpoint/Model | Purpose | AI Integration |
|----------------|---------|----------------|
| `GET /api/installment-orders/:userId` | Get user orders | Order status queries |
| `GET /api/users/:id` | Get user profile | Context building |
| `GET /api/wallet/balance` | Wallet balance | Balance queries |
| `GET /api/products` | Product catalog | Recommendations |
| `POST /api/chat/send` | Send message | Human escalation |
| `Referral` model | Commission data | Referral queries |
| `PaymentRecord` model | Payment history | Payment queries |

### 9.4 Security Considerations

1. **API Key Management:**
   - Store OpenAI keys in environment variables (already using dotenv)
   - Rotate keys quarterly
   - Use separate keys for dev/staging/production

2. **Data Protection:**
   - Never include sensitive data (passwords, full card numbers) in prompts
   - Log AI interactions for audit (exclude PII)
   - Implement prompt injection prevention

3. **Rate Limiting:**
   - 10 messages/minute per user
   - 1000 messages/hour globally
   - Automatic cooldown for abuse

---

## 10. Conclusion

The **n8n + OpenAI GPT-4o** combination offers the optimal balance of:

- **Speed:** Fastest time to market with visual workflows
- **Cost:** Self-hosted option eliminates platform fees
- **Flexibility:** Easy to iterate and update without code changes
- **Integration:** Native support for MongoDB and existing Node.js APIs
- **Team Fit:** Low learning curve for existing JavaScript developers

This solution positions EPI to deliver a modern AI chatbot experience while maintaining control over costs and data, with a clear path to enhancement as requirements evolve.

---

**Document Prepared By:** Technical Architecture Team
**Review Required By:** CTO, Product Head, Engineering Lead
**Decision Deadline:** [To be set by management]

---

*This document is confidential and intended for internal review only.*
