# 📊 User Behavior Logging & Analytics System — Research Document

> **Platform**: Epi E-commerce/Fintech Backend (Node.js Monolithic)
> **Prepared By**: Senior Solutions Architect
> **Date**: January 2025
> **Version**: 1.0

---

## 1. EXECUTIVE SUMMARY

### Problem Statement

The Epi platform currently lacks a structured user behavior tracking system. Current observability is limited to:
- **5,952+ console.log() statements** scattered across 215 files
- No structured event logging or analytics pipeline
- No real-time dashboards or user journey visualization
- No performance monitoring or APM integration
- Manual database queries required for any insights

This makes it impossible to:
- Understand user journeys and drop-off points
- Analyze conversion funnels (signup → order → payment)
- Track feature adoption and engagement
- Identify performance bottlenecks
- Make data-driven product decisions

### Key Recommendations (Top 3 Approaches)

| Rank | Approach | Best For | Setup Time | Monthly Cost (10K users) |
|------|----------|----------|------------|--------------------------|
| 🥇 | **PostHog (Cloud/Self-hosted)** | Balanced cost, features, and control | 1-2 weeks | ₹0 - ₹15K |
| 🥈 | **RudderStack + ClickHouse** | Full data ownership, scale-ready | 3-4 weeks | ₹10K - ₹25K |
| 🥉 | **Segment + Mixpanel** | Fastest setup, enterprise features | 1 week | ₹30K - ₹80K |

### Expected Outcomes

After implementation:
- ✅ Complete user journey visibility (signup → payment → referral)
- ✅ Real-time conversion funnel analysis
- ✅ Autopay success/failure rate tracking
- ✅ Referral program effectiveness metrics
- ✅ Feature adoption and engagement scores
- ✅ A/B testing infrastructure
- ✅ GDPR/privacy compliant data collection
- ✅ Research-ready data warehouse

---

## 2. CURRENT PLATFORM ANALYSIS

### Tech Stack Summary

| Component | Technology | Notes |
|-----------|------------|-------|
| Runtime | Node.js (Express.js) | Monolithic architecture |
| Database | MongoDB (Mongoose) | Primary data store |
| Auth | Firebase + JWT | Firebase tokens for users, JWT for admins |
| Payments | Razorpay | Payment gateway integration |
| Notifications | Firebase FCM | Push notifications |
| File Storage | AWS S3 | User uploads, documents |
| Scheduling | node-cron | Autopay, notifications |

### Key Business Flows to Track

Based on codebase analysis, these are the critical user journeys:

```
1. ONBOARDING JOURNEY
   app_open → signup → phone_verify → profile_complete → first_product_view

2. PURCHASE JOURNEY
   product_view → add_to_cart → apply_coupon → checkout_start →
   payment_method_select → payment_complete → order_confirmed

3. DAILY PAYMENT JOURNEY (Core Feature)
   app_open → view_pending_payments → select_installment →
   choose_payment_method (wallet/razorpay) → payment_success/failure

4. AUTOPAY JOURNEY
   enable_autopay → set_time_preference → set_minimum_balance →
   autopay_triggered → autopay_success/failure → streak_update

5. REFERRAL JOURNEY
   view_referral_code → share_code → friend_signup →
   friend_first_payment → commission_earned → commission_withdrawal

6. WALLET JOURNEY
   add_funds_start → payment_method_select → funds_added →
   wallet_used_for_payment → withdrawal_request → withdrawal_completed
```

### Current Data Points Available (but not tracked)

From MongoDB schemas, we can enrich events with:
- User: `wallet.balance`, `referralCode`, `kycStatus`, `streakData`
- Orders: `totalDays`, `paidInstallments`, `orderStatus`
- Payments: `paymentMethod`, `status`, `commissionEarned`
- Products: `category`, `installmentConfig`, `variants`

---

## 3. WHAT TO TRACK — EVENT TAXONOMY

### User Journey Events

| Event Category | Event Names | Data Points to Capture |
|----------------|-------------|------------------------|
| **Session** | `app_open`, `app_close`, `session_start`, `session_end` | `device_id`, `platform`, `app_version`, `os_version`, `timestamp` |
| **Authentication** | `signup_start`, `signup_complete`, `login`, `logout`, `phone_verify` | `auth_method`, `success`, `error_code`, `time_taken_ms` |
| **Navigation** | `screen_view`, `page_exit`, `back_press` | `screen_name`, `previous_screen`, `time_spent_ms`, `scroll_depth` |
| **Product** | `product_view`, `product_list_view`, `product_search`, `filter_apply` | `product_id`, `category`, `price`, `position`, `search_query` |
| **Cart** | `add_to_cart`, `remove_from_cart`, `cart_view`, `apply_coupon` | `product_id`, `quantity`, `cart_value`, `coupon_code`, `discount` |
| **Checkout** | `checkout_start`, `payment_method_select`, `payment_initiate` | `order_value`, `payment_method`, `installment_days` |
| **Payment** | `payment_success`, `payment_failure`, `payment_pending` | `amount`, `payment_id`, `razorpay_order_id`, `error_code` |
| **Installment** | `installment_due`, `installment_paid`, `installment_missed` | `installment_number`, `days_remaining`, `total_paid` |
| **Autopay** | `autopay_enabled`, `autopay_disabled`, `autopay_triggered`, `autopay_success`, `autopay_failed` | `time_preference`, `wallet_balance`, `payment_amount`, `failure_reason` |
| **Referral** | `referral_view`, `referral_share`, `referral_applied`, `commission_earned` | `referral_code`, `share_method`, `commission_amount` |
| **Wallet** | `wallet_view`, `add_funds`, `funds_added`, `wallet_payment`, `withdrawal_request` | `amount`, `payment_method`, `balance_after` |
| **KYC** | `kyc_start`, `kyc_document_upload`, `kyc_complete`, `kyc_rejected` | `document_type`, `verification_status` |
| **Errors** | `api_error`, `payment_error`, `network_error`, `app_crash` | `error_code`, `error_message`, `screen_name`, `stack_trace` |
| **Engagement** | `notification_received`, `notification_clicked`, `push_permission` | `notification_type`, `action`, `permission_status` |

### Event Schema (Industry Standard — Segment Spec Compatible)

```javascript
{
  // Core identifiers
  "event_id": "evt_uuid_v4",
  "event_name": "payment_success",
  "timestamp": "2025-01-04T10:30:00.000Z",

  // User identifiers
  "user_id": "user_mongodb_id",
  "anonymous_id": "device_fingerprint",
  "session_id": "sess_uuid",

  // Event-specific properties
  "properties": {
    "amount": 299,
    "currency": "INR",
    "payment_method": "WALLET",
    "installment_number": 15,
    "order_id": "order_mongodb_id",
    "product_id": "product_mongodb_id",
    "product_name": "Gold Savings Plan",
    "days_completed": 15,
    "days_remaining": 15,
    "streak_count": 15
  },

  // User traits (enriched)
  "user_properties": {
    "wallet_balance": 1500,
    "total_orders": 3,
    "referral_count": 5,
    "kyc_status": "VERIFIED",
    "user_segment": "power_user"
  },

  // Context (auto-captured)
  "context": {
    "device": {
      "type": "mobile",
      "manufacturer": "Samsung",
      "model": "Galaxy S21",
      "os": "Android",
      "os_version": "13"
    },
    "app": {
      "name": "Epi",
      "version": "2.1.0",
      "build": "156"
    },
    "location": {
      "country": "IN",
      "region": "Maharashtra",
      "city": "Mumbai"
    },
    "network": {
      "type": "wifi",
      "carrier": "Jio"
    },
    "screen": {
      "name": "payment_confirmation",
      "previous": "payment_method_select"
    }
  }
}
```

### Event Naming Conventions

Follow these rules for consistency:

```
Format: {object}_{action} (snake_case)

✅ GOOD:
- product_view
- payment_success
- cart_add
- autopay_enable

❌ BAD:
- ProductViewed (PascalCase)
- view-product (kebab-case)
- viewProduct (camelCase)
- product_was_viewed (passive voice)
```

---

## 4. ARCHITECTURE OPTIONS

### Option A: Third-Party SaaS Analytics Platform

**Overview**: Use managed analytics platforms that handle collection, storage, and visualization.

#### Tool Comparison

| Tool | Best For | Free Tier | Paid Starting | Scalability | Self-Host |
|------|----------|-----------|---------------|-------------|-----------|
| [**Mixpanel**](https://mixpanel.com) | Product analytics, funnels | 20M events/mo | $24/mo | ⭐⭐⭐⭐ | ❌ |
| [**Amplitude**](https://amplitude.com) | User behavior, cohorts | 50K MTU | $49/mo | ⭐⭐⭐⭐⭐ | ❌ |
| [**PostHog**](https://posthog.com) | All-in-one (analytics + flags + replay) | 1M events/mo | $0 (usage-based) | ⭐⭐⭐⭐ | ✅ |
| [**Heap**](https://heap.io) | Auto-capture everything | Limited | $12K+/yr | ⭐⭐⭐⭐ | ❌ |
| [**Google Analytics 4**](https://analytics.google.com) | Web traffic, basic mobile | Unlimited | Free | ⭐⭐⭐ | ❌ |

#### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │ Flutter App  │    │   Web App    │    │  Admin Panel │                  │
│  │   (Mobile)   │    │   (React)    │    │   (React)    │                  │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘                  │
│         │                   │                   │                           │
│         └───────────────────┴───────────────────┘                           │
│                             │                                               │
│                    [SDK: Mixpanel/Amplitude/PostHog]                        │
│                             │                                               │
└─────────────────────────────┼───────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ANALYTICS PLATFORM (SaaS)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     Mixpanel / Amplitude / PostHog                   │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  • Event Ingestion      • User Profiles     • Dashboards            │   │
│  │  • Funnel Analysis      • Cohort Analysis   • A/B Testing           │   │
│  │  • Retention Charts     • User Paths        • Alerts                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                     ┌──────────────┴──────────────┐                        │
│                     ▼                              ▼                        │
│            [Data Export API]              [Warehouse Sync]                  │
│                     │                              │                        │
└─────────────────────┼──────────────────────────────┼────────────────────────┘
                      │                              │
                      ▼                              ▼
            ┌─────────────────┐            ┌─────────────────┐
            │  Custom Reports │            │  Data Warehouse │
            │   (via API)     │            │ (BigQuery/S3)   │
            └─────────────────┘            └─────────────────┘
```

#### Pros
- ✅ Fastest time-to-value (1-2 weeks)
- ✅ No infrastructure management
- ✅ Built-in visualizations and dashboards
- ✅ Automatic scaling
- ✅ Pre-built integrations (Slack, Email, etc.)
- ✅ Session replay (PostHog, Heap)
- ✅ Feature flags (PostHog, Amplitude)

#### Cons
- ❌ Vendor lock-in
- ❌ Limited data ownership
- ❌ Costs scale with usage (can get expensive)
- ❌ Limited customization
- ❌ Data residency concerns (GDPR)
- ❌ Query limitations on raw data

#### Best For
- Teams wanting quick setup with minimal engineering effort
- Early-stage startups needing immediate insights
- Companies okay with vendor dependency

#### Estimated Costs (Monthly)

| Users | Mixpanel | Amplitude | PostHog Cloud |
|-------|----------|-----------|---------------|
| 10K | Free | Free | Free |
| 50K | ₹10K-20K | ₹15K-25K | ₹5K-15K |
| 100K | ₹30K-50K | ₹40K-60K | ₹15K-30K |
| 500K | ₹1L-2L | ₹1.5L-2.5L | ₹50K-1L |
| 1M | ₹2L-4L | ₹3L-5L | ₹1L-2L |

---

### Option B: Self-Hosted Open Source Stack

**Overview**: Build your own analytics infrastructure using open-source tools for full control and cost efficiency at scale.

#### Component Stack

| Layer | Tool Options | Purpose | Recommendation |
|-------|--------------|---------|----------------|
| **Collection** | PostHog, RudderStack, Jitsu | Event ingestion SDK | **RudderStack** (best Segment alternative) |
| **Streaming** | Kafka, RabbitMQ, Redis Streams | Event queue/buffer | **Redis Streams** (for <1M events/day) or **Kafka** (for scale) |
| **Processing** | Node.js Workers, Apache Flink | Transform & enrich | **Node.js Bull Queue** (simple) |
| **Storage** | ClickHouse, TimescaleDB, Elasticsearch | Analytics database | **ClickHouse** (best for analytics) |
| **Visualization** | Grafana, Metabase, Superset | Dashboards | **Metabase** (easiest) or **Superset** (powerful) |

#### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │ Flutter App  │    │   Web App    │    │  Admin Panel │                  │
│  │   (Mobile)   │    │   (React)    │    │   (React)    │                  │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘                  │
│         │                   │                   │                           │
│         └───────────────────┴───────────────────┘                           │
│                             │                                               │
│              [RudderStack SDK / Custom Event SDK]                           │
│                             │                                               │
└─────────────────────────────┼───────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EVENT INGESTION LAYER                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Node.js Event API (Express)                       │   │
│  │                                                                      │   │
│  │    POST /api/v1/events/track     POST /api/v1/events/batch          │   │
│  │    POST /api/v1/events/identify  POST /api/v1/events/page           │   │
│  │                                                                      │   │
│  │  • Request validation       • Rate limiting                         │   │
│  │  • Schema validation        • Authentication (API Key)              │   │
│  │  • Context enrichment       • Async acknowledgment                  │   │
│  └──────────────────────────────────┬──────────────────────────────────┘   │
│                                     │                                       │
└─────────────────────────────────────┼───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MESSAGE QUEUE LAYER                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │               Redis Streams / Kafka / RabbitMQ                       │   │
│  │                                                                      │   │
│  │   Queue: events.raw          Queue: events.enriched                 │   │
│  │   Queue: events.failed       Queue: events.processed                │   │
│  │                                                                      │   │
│  │  • Persistent storage       • At-least-once delivery                │   │
│  │  • Consumer groups          • Dead letter queue                     │   │
│  └──────────────────────────────────┬──────────────────────────────────┘   │
│                                     │                                       │
└─────────────────────────────────────┼───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        EVENT PROCESSING LAYER                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Node.js Worker (Bull Queue)                       │   │
│  │                                                                      │   │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐           │   │
│  │  │   Enricher    │  │  Transformer  │  │   Router      │           │   │
│  │  │               │  │               │  │               │           │   │
│  │  │ • Add user    │  │ • Clean data  │  │ • ClickHouse  │           │   │
│  │  │   properties  │  │ • Validate    │  │ • MongoDB     │           │   │
│  │  │ • Add geo     │  │ • Normalize   │  │ • S3 backup   │           │   │
│  │  │ • Add device  │  │ • Dedupe      │  │ • Webhooks    │           │   │
│  │  └───────────────┘  └───────────────┘  └───────────────┘           │   │
│  └──────────────────────────────────┬──────────────────────────────────┘   │
│                                     │                                       │
└─────────────────────────────────────┼───────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
                    ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DATA STORAGE LAYER                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐       │
│  │    ClickHouse     │  │      MongoDB      │  │      AWS S3       │       │
│  │  (Analytics DB)   │  │   (Raw Events)    │  │   (Cold Storage)  │       │
│  │                   │  │                   │  │                   │       │
│  │ • Fast OLAP       │  │ • 30-day hot      │  │ • Archive >30d    │       │
│  │ • Aggregations    │  │ • Debug/replay    │  │ • Parquet format  │       │
│  │ • Time-series     │  │ • Schema-less     │  │ • Athena queries  │       │
│  └─────────┬─────────┘  └───────────────────┘  └───────────────────┘       │
│            │                                                                 │
│            │                                                                 │
└────────────┼─────────────────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       VISUALIZATION LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐       │
│  │     Metabase      │  │      Grafana      │  │   Custom Admin    │       │
│  │   (BI Reports)    │  │   (Monitoring)    │  │    Dashboard      │       │
│  │                   │  │                   │  │                   │       │
│  │ • Funnels         │  │ • Real-time       │  │ • React-based     │       │
│  │ • Cohorts         │  │ • Alerts          │  │ • Custom charts   │       │
│  │ • Dashboards      │  │ • Time-series     │  │ • Tailored UX     │       │
│  └───────────────────┘  └───────────────────┘  └───────────────────┘       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Database Comparison for Analytics

| Database | Write Speed | Query Speed | Compression | Best For | Self-Host Cost |
|----------|-------------|-------------|-------------|----------|----------------|
| [**ClickHouse**](https://clickhouse.com) | 1M+ events/sec | ⚡⚡⚡ | 10-30x | Analytics, aggregations | ₹5K-20K/mo |
| [**TimescaleDB**](https://timescale.com) | 100K+ events/sec | ⚡⚡ | 90-95% | Time-series, PostgreSQL-compatible | ₹8K-25K/mo |
| [**Elasticsearch**](https://elastic.co) | 500K+ events/sec | ⚡⚡ | 3-5x | Full-text search, logs | ₹15K-50K/mo |
| **MongoDB** | 50K+ events/sec | ⚡ | 3-5x | Flexible schema, existing stack | Already using |

**Recommendation**: **ClickHouse** for analytics queries (fast aggregations), keep MongoDB for hot data/debugging.

#### Visualization Tools Comparison

| Tool | Best For | Ease of Use | Query Power | Self-Host | Cost |
|------|----------|-------------|-------------|-----------|------|
| [**Metabase**](https://metabase.com) | Non-technical users | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Easy | Free |
| [**Apache Superset**](https://superset.apache.org) | Data teams, scale | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Medium | Free |
| [**Grafana**](https://grafana.com) | Time-series, monitoring | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Easy | Free |

**Recommendation**: **Metabase** for business users, **Grafana** for technical monitoring.

#### Pros
- ✅ Full data ownership and control
- ✅ No vendor lock-in
- ✅ Cost-effective at scale (10x cheaper at 1M+ users)
- ✅ Unlimited customization
- ✅ GDPR-friendly (data stays in your infrastructure)
- ✅ Can use existing MongoDB for initial storage

#### Cons
- ❌ Higher initial setup effort (3-4 weeks)
- ❌ Requires DevOps expertise
- ❌ Maintenance overhead
- ❌ Need to build some features yourself
- ❌ Monitoring and alerting setup required

#### Best For
- Companies with engineering capacity
- Scale-focused teams expecting 100K+ users
- Privacy-conscious businesses (fintech, healthcare)
- Cost-sensitive organizations at scale

#### Estimated Costs (Monthly — Self-Hosted on AWS/GCP)

| Component | 10K Users | 100K Users | 1M Users |
|-----------|-----------|------------|----------|
| ClickHouse (3-node cluster) | ₹5K | ₹15K | ₹50K |
| Redis/Kafka | ₹2K | ₹5K | ₹15K |
| Metabase/Grafana | ₹1K | ₹3K | ₹8K |
| S3 Storage | ₹500 | ₹2K | ₹10K |
| **Total Infrastructure** | **₹8.5K** | **₹25K** | **₹83K** |
| Engineering time (ongoing) | ₹10K | ₹15K | ₹25K |
| **Total** | **₹18.5K** | **₹40K** | **₹1.08L** |

---

### Option C: Custom Node.js Solution + Managed Cloud Services

**Overview**: Build lightweight custom SDK with cloud-managed infrastructure (AWS/GCP) for balance of control and convenience.

#### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │ Flutter App  │    │   Web App    │    │  Admin Panel │                  │
│  │   (Mobile)   │    │   (React)    │    │   (React)    │                  │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘                  │
│         │                   │                   │                           │
│         └───────────────────┴───────────────────┘                           │
│                             │                                               │
│                  [Custom Lightweight Event SDK]                             │
│                   (npm package / Flutter plugin)                            │
│                             │                                               │
└─────────────────────────────┼───────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    NODE.JS EVENT API (Express Middleware)                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  // Integrated into existing Epi backend                            │   │
│  │                                                                      │   │
│  │  POST /api/v1/analytics/track    (event tracking)                   │   │
│  │  POST /api/v1/analytics/batch    (batch events)                     │   │
│  │  POST /api/v1/analytics/identify (user properties)                  │   │
│  │                                                                      │   │
│  │  + Middleware hooks in existing controllers:                        │   │
│  │    - paymentController → track payment events                       │   │
│  │    - orderController → track order events                           │   │
│  │    - authController → track auth events                             │   │
│  └──────────────────────────────────┬──────────────────────────────────┘   │
│                                     │                                       │
└─────────────────────────────────────┼───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       AWS MANAGED SERVICES                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        AWS Kinesis Data Streams                      │   │
│  │                    (Real-time event streaming)                       │   │
│  │                                                                      │   │
│  │  • Auto-scaling shards     • 24-hour retention (configurable)       │   │
│  │  • 1MB/sec per shard       • Cross-region replication               │   │
│  └──────────────────────────────────┬──────────────────────────────────┘   │
│                                     │                                       │
│                    ┌────────────────┼────────────────┐                     │
│                    │                │                │                      │
│                    ▼                ▼                ▼                      │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐      │
│  │   AWS Lambda      │  │    AWS Kinesis    │  │   AWS Kinesis     │      │
│  │  (Transformer)    │  │    Firehose       │  │   Analytics       │      │
│  │                   │  │                   │  │                   │      │
│  │ • Enrich events   │  │ • Batch to S3     │  │ • SQL queries     │      │
│  │ • Validate        │  │ • Parquet format  │  │ • Real-time       │      │
│  │ • Route           │  │ • Compression     │  │ • Sliding window  │      │
│  └─────────┬─────────┘  └─────────┬─────────┘  └─────────┬─────────┘      │
│            │                      │                      │                  │
│            │                      ▼                      │                  │
│            │           ┌───────────────────┐             │                  │
│            │           │      AWS S3       │             │                  │
│            │           │   (Data Lake)     │             │                  │
│            │           │                   │             │                  │
│            │           │ • Raw events      │             │                  │
│            │           │ • Partitioned     │             │                  │
│            │           │ • Parquet format  │             │                  │
│            │           └─────────┬─────────┘             │                  │
│            │                     │                       │                  │
│            │                     ▼                       │                  │
│            │  ┌─────────────────────────────────────┐   │                  │
│            └──►       AWS Athena / Redshift         ◄───┘                  │
│               │         (Query Engine)              │                       │
│               │                                     │                       │
│               │ • SQL queries on S3                 │                       │
│               │ • Pay per query (Athena)            │                       │
│               │ • Scheduled reports                 │                       │
│               └───────────────┬─────────────────────┘                       │
│                               │                                             │
└───────────────────────────────┼─────────────────────────────────────────────┘
                                │
                                ▼
                  ┌───────────────────────────────┐
                  │       AWS QuickSight          │
                  │      (Visualization)          │
                  │                               │
                  │ • Interactive dashboards      │
                  │ • Scheduled reports           │
                  │ • Embedded analytics          │
                  └───────────────────────────────┘
```

#### Components

| Component | AWS Service | Purpose | Pricing Model |
|-----------|-------------|---------|---------------|
| Event Ingestion | Custom Node.js API | Receive events | Included in backend |
| Streaming | Kinesis Data Streams | Real-time buffer | Per shard-hour |
| Processing | Lambda | Transform, enrich | Per invocation |
| Delivery | Kinesis Firehose | Batch to S3 | Per GB ingested |
| Storage | S3 | Data lake | Per GB stored |
| Query | Athena | SQL on S3 | Per TB scanned |
| Visualization | QuickSight | Dashboards | Per user/month |

#### Pros
- ✅ Fully managed infrastructure (no ops)
- ✅ Pay-per-use pricing (cost-effective at low scale)
- ✅ Auto-scaling built-in
- ✅ Native AWS integration (already using S3)
- ✅ Full data ownership (data in your AWS account)
- ✅ Serverless (Lambda) = no server management

#### Cons
- ❌ AWS vendor lock-in
- ❌ Costs can spike with traffic surges
- ❌ Kinesis learning curve
- ❌ Cold start latency with Lambda
- ❌ QuickSight less powerful than Metabase/Superset
- ❌ Complex pricing model

#### Best For
- Teams already invested in AWS ecosystem
- Variable traffic patterns (pay for what you use)
- Companies wanting managed infrastructure with data ownership

#### Estimated Costs (Monthly — AWS)

| Component | 10K Users | 100K Users | 1M Users |
|-----------|-----------|------------|----------|
| Kinesis (1-2 shards) | ₹2.5K | ₹5K | ₹15K |
| Lambda | ₹500 | ₹2K | ₹8K |
| Firehose | ₹500 | ₹3K | ₹15K |
| S3 Storage | ₹500 | ₹2K | ₹10K |
| Athena Queries | ₹500 | ₹3K | ₹15K |
| QuickSight (5 users) | ₹4K | ₹4K | ₹8K |
| **Total** | **₹8.5K** | **₹19K** | **₹71K** |

---

### Option D: Hybrid Approach (RECOMMENDED)

**Overview**: Best-of-breed approach combining PostHog for product analytics with custom infrastructure for data ownership and scale.

#### Why Hybrid?

Different needs require different tools:
- **Product Analytics** (funnels, retention, A/B tests) → Specialized platform
- **Raw Event Storage** (research, custom analysis) → Data warehouse
- **Real-time Monitoring** (errors, performance) → Time-series database

#### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │ Flutter App  │    │   Web App    │    │  Admin Panel │                  │
│  │   (Mobile)   │    │   (React)    │    │   (React)    │                  │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘                  │
│         │                   │                   │                           │
│         └───────────────────┴───────────────────┘                           │
│                             │                                               │
│              [PostHog SDK / RudderStack SDK (unified)]                      │
│                             │                                               │
└─────────────────────────────┼───────────────────────────────────────────────┘
                              │
                              │
          ┌───────────────────┴───────────────────┐
          │                                       │
          ▼                                       ▼
┌─────────────────────────┐           ┌─────────────────────────┐
│      PostHog Cloud      │           │   Node.js Backend API   │
│   (Product Analytics)   │           │   (Server-side events)  │
├─────────────────────────┤           ├─────────────────────────┤
│                         │           │                         │
│  • Funnels              │           │  POST /api/analytics    │
│  • Retention            │           │                         │
│  • Session Replay       │           │  Server-side tracking:  │
│  • Feature Flags        │           │  • payment_success      │
│  • A/B Testing          │           │  • order_created        │
│  • User Paths           │           │  • autopay_triggered    │
│  • Cohort Analysis      │           │  • commission_earned    │
│                         │           │                         │
└───────────┬─────────────┘           └───────────┬─────────────┘
            │                                     │
            │                                     │
            ▼                                     ▼
┌─────────────────────────┐           ┌─────────────────────────┐
│   PostHog Data Export   │           │     Redis Queue         │
│      (Webhook/API)      │           │   (Event Buffer)        │
└───────────┬─────────────┘           └───────────┬─────────────┘
            │                                     │
            └───────────────┬─────────────────────┘
                            │
                            ▼
          ┌─────────────────────────────────────────┐
          │           EVENT PROCESSOR               │
          │         (Node.js Worker)                │
          ├─────────────────────────────────────────┤
          │                                         │
          │  • Merge client + server events         │
          │  • Enrich with user properties          │
          │  • Validate and deduplicate             │
          │  • Route to destinations                │
          │                                         │
          └──────────────────┬──────────────────────┘
                             │
           ┌─────────────────┼─────────────────┐
           │                 │                 │
           ▼                 ▼                 ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   ClickHouse    │ │    MongoDB      │ │      S3         │
│ (Analytics DB)  │ │  (Hot Events)   │ │ (Cold Storage)  │
│                 │ │                 │ │                 │
│ • 90-day data   │ │ • 7-day data    │ │ • Archive       │
│ • Fast queries  │ │ • Debug         │ │ • Parquet       │
│ • Aggregations  │ │ • Replay        │ │ • Research      │
└────────┬────────┘ └─────────────────┘ └────────┬────────┘
         │                                       │
         │                                       │
         ▼                                       ▼
┌─────────────────┐                    ┌─────────────────┐
│    Metabase     │                    │     Athena      │
│  (Dashboards)   │                    │ (Ad-hoc Query)  │
│                 │                    │                 │
│ • Business KPIs │                    │ • Data Science  │
│ • Custom SQL    │                    │ • ML Training   │
│ • Scheduled     │                    │ • Custom        │
└─────────────────┘                    └─────────────────┘
```

#### Component Breakdown

| Layer | Tool | Purpose | Why This Choice |
|-------|------|---------|-----------------|
| Client SDK | PostHog JS/Flutter | Event capture | Best balance of features + cost |
| Product Analytics | PostHog Cloud | Funnels, retention, replay | 1M events free, excellent UI |
| Server Tracking | Custom Express middleware | Critical business events | Full control, reliability |
| Event Queue | Redis Streams | Buffer and decouple | Already familiar, low latency |
| Processing | Node.js Worker (Bull) | Transform and route | Consistent with existing stack |
| Analytics Storage | ClickHouse Cloud | Fast OLAP queries | Best price/performance |
| Hot Storage | MongoDB (existing) | Recent events, debugging | No additional infrastructure |
| Cold Storage | S3 + Parquet | Archive, research | Cost-effective long-term |
| Visualization | Metabase | Business dashboards | Easy for non-technical users |

#### Pros
- ✅ Best of both worlds (SaaS convenience + data ownership)
- ✅ PostHog free tier covers MVP (1M events/month)
- ✅ Full data ownership for research and compliance
- ✅ Gradual migration path (start with PostHog, add infra later)
- ✅ Session replay and feature flags included
- ✅ Cost-effective at all scales

#### Cons
- ⚠️ More components to manage
- ⚠️ Requires some engineering effort
- ⚠️ Potential data duplication

#### Best For
- **Most teams** — balanced approach that scales
- Growing startups needing quick wins + long-term flexibility
- Fintech companies needing data ownership for compliance

#### Estimated Costs (Monthly)

| Component | 10K Users | 100K Users | 1M Users |
|-----------|-----------|------------|----------|
| PostHog Cloud | Free | ₹10K | ₹50K |
| ClickHouse Cloud | ₹3K | ₹15K | ₹40K |
| Redis (existing) | ₹0 | ₹2K | ₹5K |
| S3 Storage | ₹500 | ₹2K | ₹8K |
| Metabase (self-hosted) | Free | Free | Free |
| **Total** | **₹3.5K** | **₹29K** | **₹1.03L** |

---

## 5. SCALABILITY CONSIDERATIONS

### Event Volume Estimation for Epi

Based on current user flows and industry benchmarks:

| User Scale | Daily Active Users | Events/User/Day | Daily Events | Monthly Events | Storage/Month |
|------------|-------------------|-----------------|--------------|----------------|---------------|
| Current | 1K | 30 | 30K | 900K | 500 MB |
| 6 months | 10K | 40 | 400K | 12M | 5 GB |
| 1 year | 50K | 50 | 2.5M | 75M | 30 GB |
| 2 years | 200K | 50 | 10M | 300M | 120 GB |
| Goal | 1M | 50 | 50M | 1.5B | 600 GB |

### Event Breakdown per User Session

```
Typical User Session (Daily Payment Flow):
├── app_open                    (1 event)
├── screen_view (home)          (1 event)
├── screen_view (payments)      (1 event)
├── payment_list_view           (1 event)
├── installment_select          (1 event)
├── payment_method_select       (1 event)
├── payment_initiate            (1 event)
├── payment_success/failure     (1 event)
├── screen_view (confirmation)  (1 event)
└── app_close                   (1 event)
                                ─────────
                                10 events

Power User (with browsing):
├── All above                   (10 events)
├── product_view (3x)           (3 events)
├── wishlist_add                (1 event)
├── referral_view               (1 event)
├── notification_click          (1 event)
└── wallet_view                 (1 event)
                                ─────────
                                17 events

Average: ~12 events/user/session
Sessions/day: 3-4 for daily payers
Total: ~40-50 events/user/day
```

### Scaling Strategies

#### 1. Async Processing (Critical)

```javascript
// ❌ BAD: Blocking event tracking
app.post('/api/payment', async (req, res) => {
  const payment = await processPayment(req.body);
  await analyticsService.track('payment_success', payment); // Blocks response!
  res.json({ success: true });
});

// ✅ GOOD: Non-blocking with queue
app.post('/api/payment', async (req, res) => {
  const payment = await processPayment(req.body);
  eventQueue.add('payment_success', payment); // Fire and forget
  res.json({ success: true });
});
```

#### 2. Client-Side Batching

```javascript
// PostHog/SDK config for mobile
posthog.init('YOUR_API_KEY', {
  flushAt: 20,        // Send when 20 events accumulated
  flushInterval: 30000 // Or every 30 seconds
});
```

#### 3. Sampling for High-Volume Events

```javascript
// 100% tracking for critical events
const ALWAYS_TRACK = ['payment_success', 'order_created', 'signup_complete'];

// 10% sampling for frequent events
const SAMPLE_EVENTS = {
  'screen_view': 0.1,
  'scroll': 0.01,
  'button_click': 0.1
};

function shouldTrack(eventName) {
  if (ALWAYS_TRACK.includes(eventName)) return true;
  const sampleRate = SAMPLE_EVENTS[eventName] || 1.0;
  return Math.random() < sampleRate;
}
```

#### 4. Data Partitioning

```sql
-- ClickHouse table partitioned by day
CREATE TABLE events (
    event_id UUID,
    event_name String,
    user_id String,
    timestamp DateTime,
    properties String,
    ...
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (user_id, timestamp)
TTL timestamp + INTERVAL 90 DAY;
```

#### 5. TTL & Data Lifecycle

| Storage Tier | Retention | Purpose | Cost |
|--------------|-----------|---------|------|
| MongoDB (hot) | 7 days | Debugging, replay | Existing |
| ClickHouse | 90 days | Active analytics | Medium |
| S3 (warm) | 1 year | Research, compliance | Low |
| S3 Glacier | 3+ years | Legal requirement | Very low |

---

## 6. IMPLEMENTATION IN NODE.js MONOLITH

### Approach 1: Express Middleware for Auto-Tracking

```javascript
// middlewares/analyticsMiddleware.js

const eventQueue = require('../queues/eventQueue');

/**
 * Auto-tracks API requests for analytics
 */
const analyticsMiddleware = (options = {}) => {
  const {
    excludePaths = ['/health', '/api/health-check'],
    includeBody = false
  } = options;

  return (req, res, next) => {
    // Skip excluded paths
    if (excludePaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    const startTime = Date.now();

    // Capture response
    res.on('finish', () => {
      const event = {
        event_name: 'api_request',
        timestamp: new Date().toISOString(),
        user_id: req.user?.id || null,
        anonymous_id: req.headers['x-device-id'] || req.ip,
        session_id: req.headers['x-session-id'],
        properties: {
          method: req.method,
          path: req.path,
          status_code: res.statusCode,
          response_time_ms: Date.now() - startTime,
          user_agent: req.headers['user-agent'],
          ...(includeBody && { request_body: sanitize(req.body) })
        },
        context: extractContext(req)
      };

      // Non-blocking queue
      eventQueue.add(event).catch(err =>
        console.error('[Analytics] Queue error:', err)
      );
    });

    next();
  };
};

function extractContext(req) {
  return {
    ip: req.ip,
    device: parseUserAgent(req.headers['user-agent']),
    app: {
      version: req.headers['x-app-version'],
      build: req.headers['x-app-build'],
      platform: req.headers['x-platform']
    }
  };
}

module.exports = analyticsMiddleware;
```

### Approach 2: Controller-Level Event Tracking

```javascript
// services/analyticsService.js

const eventQueue = require('../queues/eventQueue');
const { enrichUserProperties } = require('../utils/userEnricher');

class AnalyticsService {
  constructor() {
    this.queue = eventQueue;
  }

  /**
   * Track a custom event
   */
  async track(eventName, properties = {}, context = {}) {
    const event = {
      event_id: generateUUID(),
      event_name: eventName,
      timestamp: new Date().toISOString(),
      properties,
      context
    };

    // Add to queue (non-blocking)
    return this.queue.add('track', event, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 }
    });
  }

  /**
   * Identify/update user properties
   */
  async identify(userId, traits = {}) {
    return this.queue.add('identify', {
      user_id: userId,
      traits,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Track page/screen view
   */
  async page(userId, screenName, properties = {}) {
    return this.track('screen_view', {
      screen_name: screenName,
      ...properties
    }, { user_id: userId });
  }
}

module.exports = new AnalyticsService();

// Usage in controller:
// controllers/installmentPaymentController.js

const analytics = require('../services/analyticsService');

exports.processPayment = async (req, res) => {
  try {
    const { orderId, amount, paymentMethod } = req.body;
    const userId = req.user.id;

    // Process payment...
    const result = await paymentService.process({ orderId, amount });

    // Track success (non-blocking)
    analytics.track('payment_success', {
      order_id: orderId,
      amount,
      payment_method: paymentMethod,
      installment_number: result.installmentNumber,
      days_remaining: result.daysRemaining
    }, {
      user_id: userId,
      session_id: req.headers['x-session-id']
    });

    res.json({ success: true, data: result });
  } catch (error) {
    // Track failure
    analytics.track('payment_failure', {
      order_id: req.body.orderId,
      error_code: error.code,
      error_message: error.message
    }, { user_id: req.user.id });

    throw error;
  }
};
```

### Approach 3: Event Queue with Bull

```javascript
// queues/eventQueue.js

const Queue = require('bull');
const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL);

const eventQueue = new Queue('analytics-events', {
  redis: process.env.REDIS_URL,
  defaultJobOptions: {
    removeOnComplete: 1000,
    removeOnFail: 5000,
    attempts: 3
  }
});

// Process events in batches
eventQueue.process('track', 50, async (job) => {
  const events = await eventQueue.getJobs(['waiting'], 0, 49);
  if (events.length >= 10) {
    await sendBatch(events.map(j => j.data));
    await Promise.all(events.map(j => j.remove()));
  }
});

// Or process individually
eventQueue.process('track', async (job) => {
  await sendToDestinations(job.data);
});

async function sendToDestinations(event) {
  // Send to multiple destinations in parallel
  await Promise.allSettled([
    sendToPostHog(event),
    sendToClickHouse(event),
    saveToMongoDB(event)
  ]);
}

module.exports = eventQueue;
```

### Key Integration Points in Epi Codebase

| File | Events to Track |
|------|-----------------|
| `routes/auth.js` | `signup_start`, `signup_complete`, `login`, `logout` |
| `controllers/installmentPaymentController.js` | `payment_initiate`, `payment_success`, `payment_failure` |
| `controllers/installmentOrderController.js` | `order_created`, `order_cancelled` |
| `services/autopayService.js` | `autopay_triggered`, `autopay_success`, `autopay_failed` |
| `controllers/referralController.js` | `referral_applied`, `commission_earned` |
| `routes/wallet.js` | `add_funds`, `wallet_payment`, `withdrawal_request` |
| `jobs/autopayCron.js` | `autopay_batch_start`, `autopay_batch_complete` |
| `services/fcmService.js` | `notification_sent`, `notification_failed` |

---

## 7. INDUSTRY STANDARDS & BEST PRACTICES

### How Top Companies Do It

#### Netflix (2 Trillion Events/Day)

- **Architecture**: Apache Kafka → Apache Flink → S3/Iceberg
- **Key Insight**: Separate streaming (real-time personalization) from batch (model training)
- **Lesson for Epi**: Even Netflix uses dual paths — real-time for immediate needs, batch for deep analysis

> "Netflix's Keystone pipeline processes up to 2 trillion messages per day, with around 3 petabytes of data ingested daily."
> — [Monte Carlo Data](https://www.montecarlodata.com/blog-data-engineering-architecture/)

#### Uber (Millions of Rides/Day)

- **Architecture**: Kafka → Flink → Hadoop/Cassandra
- **Key Insight**: Built DataCentral for data observability
- **Lesson for Epi**: Invest in data quality monitoring early

> "When you request a ride, Uber grabs your location and streams it through Kafka to Flink for real-time driver matching."
> — [Uber Engineering Blog](https://www.uber.com/blog/streaming-real-time-analytics/)

#### Spotify

- **Architecture**: Google Cloud Pub/Sub → Dataflow → BigQuery
- **Key Insight**: Heavy use of A/B testing for every feature
- **Lesson for Epi**: Feature flags + analytics = data-driven decisions

### Standards to Follow

| Standard | Description | Applicable To |
|----------|-------------|---------------|
| [Segment Spec](https://segment.com/docs/connections/spec/) | Event naming and schema standard | Event design |
| [Google Analytics 4 Schema](https://developers.google.com/analytics/devguides/collection/ga4) | E-commerce event standard | E-commerce tracking |
| [Snowplow Schema](https://docs.snowplow.io/docs/understanding-your-pipeline/schemas/) | Self-describing JSON schema | Custom events |
| [GDPR](https://gdpr.eu/) | Data privacy regulation | EU users |
| [RBI Guidelines](https://www.rbi.org.in/) | Financial data requirements | Fintech compliance |

### Event Naming Best Practices

```
✅ DO:
- Use snake_case: payment_success
- Use object_action format: cart_add, order_create
- Be specific: checkout_step_1, checkout_step_2
- Keep names short: <30 characters

❌ DON'T:
- Use PascalCase: PaymentSuccess
- Use vague names: user_action, button_click
- Include dynamic values: product_123_view
- Use past tense: payment_was_successful
```

---

## 8. PRIVACY & COMPLIANCE

### GDPR Requirements

| Requirement | Implementation |
|-------------|----------------|
| **Consent** | Cookie banner with granular options before tracking |
| **Right to Access** | API endpoint to export user's event data |
| **Right to Erasure** | Delete user events within 30 days of request |
| **Data Minimization** | Only collect necessary data, avoid over-tracking |
| **Purpose Limitation** | Document why each event is needed |
| **Data Portability** | JSON export of user data |

### Implementation Checklist

```javascript
// Consent-aware tracking
const analyticsService = {
  track(event, properties, context) {
    const user = context.user;

    // Check consent
    if (!user.analyticsConsent) {
      return; // Don't track without consent
    }

    // Anonymize if partial consent
    if (!user.personalizedTrackingConsent) {
      properties = anonymize(properties);
    }

    return this.queue.add(event, properties);
  }
};

// Data anonymization
function anonymize(data) {
  return {
    ...data,
    user_id: hash(data.user_id), // Hash PII
    email: undefined,            // Remove email
    phone: undefined,            // Remove phone
    ip: maskIP(data.ip)          // Mask IP: 192.168.1.xxx
  };
}
```

### PII Handling

| Data Type | Handling | Storage |
|-----------|----------|---------|
| User ID | Hash for analytics, keep original in main DB | Hashed in ClickHouse |
| Email | Don't track in events | Only in MongoDB |
| Phone | Don't track in events | Only in MongoDB |
| IP Address | Mask last octet | Masked in events |
| Device ID | Okay to track | Analytics DB |
| Location | City-level only, no precise GPS | Analytics DB |

### Data Retention Policy

| Data Type | Retention | Justification |
|-----------|-----------|---------------|
| Raw events (MongoDB) | 7 days | Debugging, immediate replay |
| Analytics events (ClickHouse) | 90 days | Active analysis |
| Aggregated data | 2 years | Business trends |
| Archived events (S3) | 3 years | Legal/compliance |
| Personal data | Until deletion request | GDPR requirement |

---

## 9. COMPARISON MATRIX — ALL OPTIONS

| Criteria | Option A (SaaS) | Option B (Self-hosted) | Option C (AWS) | Option D (Hybrid) |
|----------|-----------------|------------------------|----------------|-------------------|
| **Setup Time** | 1-2 weeks | 4-6 weeks | 3-4 weeks | 2-3 weeks |
| **Engineering Effort** | Low | High | Medium | Medium |
| **Maintenance** | None | High | Low | Medium |
| **Scalability** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Customization** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Data Ownership** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **GDPR Compliance** | ⭐⭐⭐ (depends) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Feature Richness** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Session Replay** | ✅ (PostHog, Heap) | ❌ (needs extra) | ❌ | ✅ (via PostHog) |
| **Feature Flags** | ✅ (PostHog, Amplitude) | ❌ (needs extra) | ❌ | ✅ (via PostHog) |
| **A/B Testing** | ✅ | ❌ | ❌ | ✅ |
| **Research/BI Ready** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Vendor Lock-in** | High | None | Medium (AWS) | Low |

### Cost Comparison

| Users | Option A (Mixpanel) | Option B (Self-hosted) | Option C (AWS) | Option D (Hybrid) |
|-------|--------------------|-----------------------|----------------|-------------------|
| 10K | ₹15K-30K | ₹18K | ₹8.5K | ₹3.5K |
| 50K | ₹50K-80K | ₹30K | ₹15K | ₹18K |
| 100K | ₹1L-1.5L | ₹40K | ₹19K | ₹29K |
| 500K | ₹3L-5L | ₹70K | ₹45K | ₹65K |
| 1M | ₹5L-8L | ₹1.1L | ₹71K | ₹1L |

---

## 10. RECOMMENDED APPROACH

### For Immediate Start (MVP — Week 1-2)

**Recommendation: PostHog Cloud + Server-side Middleware**

```
Why:
✅ 1M events/month FREE (enough for 25K+ users)
✅ Includes funnels, retention, session replay, feature flags
✅ 30-minute setup for basic tracking
✅ Server-side Node SDK for critical events
✅ No infrastructure needed

Action Items:
1. Create PostHog account (US/EU cloud based on user location)
2. Install posthog-node in backend
3. Add tracking to critical flows (payment, signup, order)
4. Install Flutter SDK for mobile events
5. Set up basic dashboard (conversion funnel, daily active)
```

### For Growth Phase (Month 2-3)

**Recommendation: Add ClickHouse + Metabase for Research**

```
Why:
✅ PostHog has export limitations at scale
✅ Need custom SQL queries for deep analysis
✅ ClickHouse gives 10x better query performance
✅ Metabase empowers non-technical team

Action Items:
1. Set up ClickHouse Cloud (or self-hosted)
2. Create data pipeline: PostHog → ClickHouse
3. Install Metabase, connect to ClickHouse
4. Build research dashboards
5. Set up data retention policies
```

### For Scale (Month 4+)

**Recommendation: Full Hybrid Architecture**

```
Why:
✅ PostHog costs increase at scale
✅ Need full data ownership for compliance
✅ Custom processing for ML/recommendations
✅ Multi-destination routing (marketing, data science)

Action Items:
1. Add RudderStack or custom event API
2. Set up Redis Streams for buffering
3. Build event processor workers
4. Implement S3 cold storage
5. Set up data governance
```

### Phased Implementation Timeline

```
PHASE 1: MVP (Week 1-2)
├── Day 1-2: PostHog setup, API key, basic config
├── Day 3-4: Backend integration (payment, order, auth events)
├── Day 5-7: Flutter SDK integration
├── Day 8-10: Dashboard creation (funnels, retention)
└── Day 11-14: Testing, validation, team training

PHASE 2: Enhancement (Month 2)
├── Week 1: Server-side tracking for all critical events
├── Week 2: Session replay setup, error tracking
├── Week 3: Feature flags for A/B testing
└── Week 4: Team adoption, documentation

PHASE 3: Data Ownership (Month 3)
├── Week 1: ClickHouse setup
├── Week 2: Data pipeline (PostHog → ClickHouse)
├── Week 3: Metabase dashboards
└── Week 4: Research queries, SQL training

PHASE 4: Scale (Month 4+)
├── Custom event processor
├── Multi-destination routing
├── Cold storage (S3)
└── Data governance, compliance
```

---

## 11. NEXT STEPS & QUESTIONS FOR TEAM

### Decisions Needed

| Question | Options | Impact |
|----------|---------|--------|
| **SaaS vs Self-hosted?** | PostHog Cloud / Self-host PostHog / Full custom | Setup time, cost, control |
| **Monthly budget?** | ₹10K / ₹30K / ₹50K+ | Tool selection |
| **Data residency?** | India-only / EU / Global | GDPR, tool choice |
| **DevOps bandwidth?** | Minimal / Some / Dedicated | Self-host feasibility |
| **Real-time dashboards?** | Required / Nice-to-have / Batch is fine | Architecture complexity |
| **Session replay?** | Required / Not needed | Tool selection |
| **A/B testing?** | Required / Later / Not needed | Platform features |

### Immediate Action Items (After Approval)

1. [ ] Finalize approach (recommend: Option D Hybrid)
2. [ ] Create PostHog account
3. [ ] Define event taxonomy (prioritize top 20 events)
4. [ ] Add tracking to payment flow first
5. [ ] Set up conversion funnel dashboard
6. [ ] Train team on PostHog usage

### Technical Prerequisites

- [ ] Redis available for event queuing (or can add)
- [ ] Flutter team ready for SDK integration
- [ ] Web team ready for JS SDK integration
- [ ] DevOps for ClickHouse setup (if Phase 3)

---

## 12. REFERENCES & RESOURCES

### Documentation

- [PostHog Docs](https://posthog.com/docs) — Product analytics platform
- [PostHog Node.js SDK](https://posthog.com/docs/libraries/node) — Server-side integration
- [RudderStack Docs](https://www.rudderstack.com/docs/) — Open-source CDP
- [ClickHouse Docs](https://clickhouse.com/docs) — Analytics database
- [Metabase Docs](https://www.metabase.com/docs/) — BI dashboards

### Comparisons & Analysis

- [Amplitude vs Mixpanel vs PostHog](https://www.brainforge.ai/resources/amplitude-vs-mixpanel-vs-posthog) — Feature comparison
- [PostHog vs Mixpanel](https://posthog.com/blog/posthog-vs-mixpanel) — Detailed comparison
- [ClickHouse vs TimescaleDB](https://www.tinybird.co/blog/clickhouse-vs-timescaledb) — Database comparison
- [RudderStack vs Segment](https://www.rudderstack.com/competitors/rudderstack-vs-segment/) — CDP comparison
- [Best GDPR Compliant Analytics](https://posthog.com/blog/best-gdpr-compliant-analytics-tools) — Privacy-first tools

### Architecture & Case Studies

- [Netflix Data Architecture](https://www.montecarlodata.com/blog-data-engineering-architecture/) — 500B events/day
- [Uber Real-Time Analytics](https://www.uber.com/blog/streaming-real-time-analytics/) — Streaming architecture
- [Event-Driven Architecture in Node.js](https://dev.to/abdullah_tajudeen_a406597/event-driven-architecture-unlocking-scalable-systems-with-nodejs-4f3p) — Implementation guide
- [Kafka vs RabbitMQ vs Kinesis](https://aws.plainenglish.io/apache-kafka-vs-rabbitmq-vs-aws-kinesis-which-one-should-you-choose-354903d035d4) — Streaming comparison

### Best Practices

- [Event Tracking Schema Design](https://mixpanel.com/blog/build-event-tracking-scheme-business-metrics/) — Mixpanel guide
- [GDPR Compliance for Analytics](https://secureprivacy.ai/blog/privacy-friendly-analytics) — Privacy best practices
- [Real-time vs Batch Processing](https://www.pingcap.com/article/real-time-vs-batch-processing-comparison-2025/) — Architecture decisions
- [Self-hosted ClickHouse Costs](https://www.tinybird.co/blog/self-hosted-clickhouse-cost) — Infrastructure planning

### Tools & SDKs

- [posthog-node](https://www.npmjs.com/package/posthog-node) — npm package
- [Bull Queue](https://github.com/OptimalBits/bull) — Redis-based job queue
- [Metabase](https://github.com/metabase/metabase) — Open-source BI
- [Apache Superset](https://github.com/apache/superset) — Enterprise BI

---

## 13. APPENDIX

### A. Sample Event Implementations

<details>
<summary>Click to expand: Payment Success Event</summary>

```javascript
// In installmentPaymentController.js

const analytics = require('../services/analyticsService');

async function processPayment(req, res) {
  const { orderId, paymentMethod } = req.body;
  const user = req.user;

  try {
    const result = await paymentService.process(orderId, paymentMethod);

    // Track success
    await analytics.track('payment_success', {
      // Event properties
      order_id: orderId,
      amount: result.amount,
      currency: 'INR',
      payment_method: paymentMethod,
      installment_number: result.installmentNumber,
      total_installments: result.totalInstallments,
      days_remaining: result.daysRemaining,

      // Order context
      product_id: result.product.id,
      product_name: result.product.name,
      product_category: result.product.category,

      // User state
      wallet_balance_after: result.walletBalance,
      streak_count: result.streakCount,
      is_streak_milestone: result.isMilestone
    }, {
      user_id: user.id,
      session_id: req.headers['x-session-id'],
      device_id: req.headers['x-device-id']
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    // Track failure
    await analytics.track('payment_failure', {
      order_id: orderId,
      payment_method: paymentMethod,
      error_code: error.code,
      error_message: error.message,
      error_type: error.constructor.name
    }, {
      user_id: user.id,
      session_id: req.headers['x-session-id']
    });

    throw error;
  }
}
```
</details>

<details>
<summary>Click to expand: Autopay Event Tracking</summary>

```javascript
// In autopayService.js

const analytics = require('../services/analyticsService');

async function processAutopayForUser(user, installment) {
  const trackingContext = {
    user_id: user._id.toString(),
    trigger: 'cron',
    time_slot: getCurrentTimeSlot()
  };

  try {
    // Check balance
    if (user.wallet.balance < installment.amount) {
      await analytics.track('autopay_insufficient_balance', {
        required_amount: installment.amount,
        available_balance: user.wallet.balance,
        shortfall: installment.amount - user.wallet.balance,
        order_id: installment.orderId
      }, trackingContext);

      return { success: false, reason: 'insufficient_balance' };
    }

    // Process payment
    const result = await walletService.deduct(user._id, installment.amount);

    await analytics.track('autopay_success', {
      order_id: installment.orderId,
      amount: installment.amount,
      installment_number: installment.number,
      wallet_balance_after: result.newBalance,
      processing_time_ms: result.processingTime
    }, trackingContext);

    return { success: true };

  } catch (error) {
    await analytics.track('autopay_failure', {
      order_id: installment.orderId,
      amount: installment.amount,
      error_code: error.code,
      error_message: error.message
    }, trackingContext);

    throw error;
  }
}
```
</details>

### B. ClickHouse Schema

<details>
<summary>Click to expand: Events Table Schema</summary>

```sql
CREATE TABLE events (
    -- Identifiers
    event_id UUID DEFAULT generateUUIDv4(),
    event_name LowCardinality(String),

    -- User identification
    user_id String,
    anonymous_id String,
    session_id String,

    -- Timestamp
    timestamp DateTime64(3, 'UTC'),
    received_at DateTime64(3, 'UTC') DEFAULT now64(3),

    -- Event data (JSON)
    properties String,  -- JSON string

    -- Context
    context_device_type LowCardinality(String),
    context_device_os LowCardinality(String),
    context_app_version String,
    context_country LowCardinality(String),
    context_city String,

    -- Extracted for fast queries
    screen_name LowCardinality(String),
    product_id String,
    order_id String,
    amount Decimal(10, 2),
    payment_method LowCardinality(String),

    -- Metadata
    source LowCardinality(String) DEFAULT 'backend'
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (event_name, user_id, timestamp)
TTL timestamp + INTERVAL 90 DAY
SETTINGS index_granularity = 8192;

-- Materialized view for daily aggregates
CREATE MATERIALIZED VIEW daily_event_counts
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (date, event_name)
AS SELECT
    toDate(timestamp) AS date,
    event_name,
    count() AS event_count,
    uniqExact(user_id) AS unique_users
FROM events
GROUP BY date, event_name;
```
</details>

### C. PostHog Quick Setup

<details>
<summary>Click to expand: PostHog Integration Code</summary>

```javascript
// services/posthogService.js

const { PostHog } = require('posthog-node');

const posthog = new PostHog(
  process.env.POSTHOG_API_KEY,
  {
    host: process.env.POSTHOG_HOST || 'https://app.posthog.com',
    flushAt: 20,       // Batch size
    flushInterval: 10000  // 10 seconds
  }
);

// Graceful shutdown
process.on('SIGTERM', async () => {
  await posthog.shutdown();
});

module.exports = {
  track: (userId, event, properties = {}) => {
    posthog.capture({
      distinctId: userId,
      event,
      properties
    });
  },

  identify: (userId, properties = {}) => {
    posthog.identify({
      distinctId: userId,
      properties
    });
  },

  alias: (userId, previousId) => {
    posthog.alias({
      distinctId: userId,
      alias: previousId
    });
  }
};
```
</details>