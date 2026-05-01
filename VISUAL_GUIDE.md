/**
 * VISUAL GUIDE - Shared Visibility System
 * Diagrams and flowcharts for easy understanding
 */

# Visual Implementation Guide

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                          WEB APPLICATION                         │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Browser / Frontend                       │  │
│  │                                                             │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │  │
│  │  │ Session Mgr  │  │ Data Sync    │  │ Realtime Syn │   │  │
│  │  │ • User info  │  │ • Fetch data │  │ • Subscribe  │   │  │
│  │  │ • Companies  │  │ • Create/Upd │  │ • Auto-refresh   │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │  │
│  └────────────────────────┬───────────────────────────────────┘  │
│                           │                                       │
│                    API Calls & Events                             │
│                           │                                       │
│  ┌────────────────────────▼───────────────────────────────────┐  │
│  │              Vercel API Layer (Node.js)                    │  │
│  │                                                             │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐      │  │
│  │  │ Companies    │ │ Team Members │ │ Activity     │      │  │
│  │  │ Endpoint     │ │ Endpoint     │ │ Logs Endpoint    │  │
│  │  └──────────────┘ └──────────────┘ └──────────────┘      │  │
│  │        │                 │                   │              │  │
│  │        ├─ Visibility     ├─ Auth checks     ├─ Audit      │  │
│  │        ├─ Filters data   ├─ User creation  └─ Logging   │  │
│  │        └─ Logging       └─ Company assign                │  │
│  └────────────────────────┬───────────────────────────────────┘  │
│                           │                                       │
└───────────────────────────┼───────────────────────────────────────┘
                            │
              ┌─────────────▼─────────────┐
              │   Supabase (Database)     │
              │                           │
              │ ┌─────────────────────┐   │
              │ │  companies          │   │
              │ │  team_members       │   │
              │ │  invoices           │   │
              │ │  ...                │   │
              │ └─────────────────────┘   │
              │                           │
              │ ┌─────────────────────┐   │
              │ │ NEW TABLES:         │   │
              │ │ • user_company_...  │   │
              │ │ • activity_logs     │   │
              │ └─────────────────────┘   │
              │                           │
              │ ┌─────────────────────┐   │
              │ │  Realtime Events    │   │
              │ │  (broadcast changes)│   │
              │ └─────────────────────┘   │
              └───────────────────────────┘
```

---

## User Access Control Model

```
                            ┌─────────────────────┐
                            │   Current User      │
                            └──────────┬──────────┘
                                       │
                          ┌────────────┼────────────┐
                          │                         │
                    ┌─────▼─────┐            ┌─────▼─────┐
                    │ User Type? │            │ Logged In?│
                    └─────┬─────┘            └─────┬─────┘
                          │                        │
                ┌─────────┴─────────┐    ┌────────┴────────┐
                │                   │    │                 │
            ┌───▼────┐          ┌───▼────▼──┐        ┌────▼────┐
            │ ADMIN   │          │ Regular    │        │  NO     │
            │         │          │  User      │        │  (→Log) │
            └───┬────┘          └───┬────────┘        └─────────┘
                │                   │
        ┌───────┴────────┐  ┌───────┴────────┐
        │                │  │                │
    ┌───▼──┐        ┌───▼──▼──┐        ┌───▼──┐
    │ ALL  │        │ASSIGNED  │        │NONE  │
    │COMPA │        │COMPANIES │        │ACCESS│
    │NIES  │        │ ONLY     │        │      │
    └──────┘        └──────────┘        └──────┘

Examples:
- Admin user → sees ALL companies
- User1 (assigned Co.A, Co.B) → sees ONLY Co.A, Co.B
- User2 (assigned nothing) → sees NO data
```

---

## Company Assignment Flow

```
ADMIN DASHBOARD                   BACKEND                    DATABASE
     │                              │                            │
     ├─ Select User1                │                            │
     ├─ Select Co.A, Co.B           │                            │
     │                              │                            │
     └─→ API: PUT /team_members     │                            │
            {id: user1, companies:  │                            │
             [Co.A, Co.B]}          │                            │
                                    │                            │
                                    ├─ Validate user is admin    │
                                    │                            │
                                    ├─ Delete old assignments    │
                                    │                            │
                                    └─→ Create new assignments   │
                                           [user1, Co.A]         │
                                           [user1, Co.B]         │
                                                                  │
                                                    ┌────────────▼──┐
                                                    │ user_company_  │
                                                    │ assignments    │
                                                    │ table updated  │
                                                    └────────────────┘
```

---

## Data Visibility Control - Three Layers

```
                    USER REQUESTS DATA (e.g., companies)
                               │
                               ▼
                    ┌──────────────────────┐
                    │   Layer 1: Frontend  │
                    │                      │
                    │ Check session        │
                    │ canViewCompany?      │
                    │ Validate access      │
                    └──────────┬───────────┘
                               │
                     NO  ◄─────┴─────► YES
                     │                  │
                ┌────▼────┐       ┌────▼──────────────────┐
                │ Show    │       │ Layer 2: API          │
                │ "Access │       │                       │
                │ Denied" │       │ Check user_type       │
                │ Message │       │ Filter by company_id  │
                └─────────┘       │ Validate permissions  │
                                  └────────┬──────────────┘
                                           │
                               NO  ◄───────┴─────► YES
                               │                   │
                        ┌──────▼─────┐     ┌──────▼────────────┐
                        │ Return     │     │ Layer 3: Database │
                        │ Error      │     │                   │
                        │ Response   │     │ RLS Policies      │
                        └────────────┘     │ (Additional check)│
                                           │ Return filtered   │
                                           │ rows only         │
                                           └──────┬───────────┘
                                                  │
                                           ┌──────▼────────┐
                                           │ Return Results │
                                           │ to Frontend    │
                                           └────────────────┘
```

---

## Real-Time Sync Flow

```
USER A MAKES CHANGE        USER B WATCHING SAME DATA
        │                            │
        │                            │
    ┌───▼──────────────────────────────────────────────┐
    │ Tab A                                  Tab B      │
    │ Click Save Invoice                     Dashboard  │
    └───┬──────────────────────────────────────┬────────┘
        │                                      │
        │                                      │
    ┌───▼───────────────────────────────────────────────┐
    │ API Updates Database                             │
    │ /api/invoices (PUT)                              │
    └───┬───────────────────────────────────────────────┘
        │
        ▼
    ┌──────────────────────────────────────────────────┐
    │ Supabase Database                                │
    │ invoices table UPDATED                           │
    │ activity_logs table LOGGED                       │
    └───┬───────────────┬──────────────────────────────┘
        │               │
        │               │ Realtime Broadcast
        │               │
        │       ┌───────▼──────────┐
        │       │ Event triggered  │
        │       │ "invoice-update" │
        │       └───────┬──────────┘
        │               │
        │               │ Subscription: watching
        │               │ /invoices/Company1
        │               │
        │               ▼
        │       ┌──────────────────────┐
        │       │ Tab B receives event │
        │       └────────┬─────────────┘
        │                │
        │                ▼
        │       ┌──────────────────────┐
        │       │ Tab B calls refresh  │
        │       │ GET /api/invoices    │
        │       └────────┬─────────────┘
        │                │
        │                ▼
        │       ┌──────────────────────────┐
        │       │ Fresh data fetched       │
        │       │ Tab B UI UPDATED         │
        │       │ User2 sees change       │
        │       └──────────────────────────┘
        │
        └─→ Timeline: < 100ms total!
```

---

## Activity Logging Capture Points

```
DATABASE OPERATION         LOGGING INFORMATION CAPTURED

┌─────────────────┐       ┌──────────────────────────────┐
│ CREATE invoice  │ ───→  │ user_id: user1               │
│ {amount: 1000}  │       │ action: CREATE               │
│                 │       │ table: invoices              │
└─────────────────┘       │ record_id: <invoice_id>      │
                          │ company_id: company1         │
                          │ new_data: {amount: 1000}     │
                          │ timestamp: 2026-05-01 14:23  │
                          └──────────────────────────────┘

┌─────────────────┐       ┌──────────────────────────────┐
│ UPDATE invoice  │ ───→  │ user_id: user2               │
│ {amount:1000→   │       │ action: UPDATE               │
│  amount: 1200}  │       │ table: invoices              │
│                 │       │ record_id: <invoice_id>      │
└─────────────────┘       │ company_id: company1         │
                          │ old_data: {amount: 1000}     │
                          │ new_data: {amount: 1200}     │
                          │ timestamp: 2026-05-01 14:25  │
                          └──────────────────────────────┘

┌─────────────────┐       ┌──────────────────────────────┐
│ DELETE invoice  │ ───→  │ user_id: admin               │
│                 │       │ action: DELETE               │
│                 │       │ table: invoices              │
└─────────────────┘       │ record_id: <invoice_id>      │
                          │ company_id: company1         │
                          │ old_data: {full record...}   │
                          │ timestamp: 2026-05-01 14:30  │
                          └──────────────────────────────┘
```

---

## User Journey - Create User & Assign Companies

```
STEP 1: Admin navigates to User Management
        │
        ▼
        Dashboard loads
        ├─ sessionManager.isAdmin() ✓
        └─ Show "Manage Users" section

STEP 2: Admin clicks "Create User"
        │
        ▼
        Modal opens
        ├─ Input: username
        ├─ Input: password
        └─ Checkboxes: [Company1, Company2, Company3]

STEP 3: Admin selects Company1, Company2
        │
        ▼
        Admin clicks Submit

STEP 4: Frontend calls API
        │
        └─→ POST /api/team_members
            {
              username: "alice",
              password: "***",
              company_ids: [co1, co2],
              created_by: admin_id
            }

STEP 5: Backend processes
        │
        ├─ Verify user is admin ✓
        ├─ Create team_member record
        ├─ Create user_company_assignments:
        │  ├─ (alice, company1)
        │  └─ (alice, company2)
        ├─ Log activity: "Created user alice"
        └─ Return success

STEP 6: Frontend updates UI
        │
        ├─ User "alice" appears in list
        ├─ Companies shown as [Company1, Company2]
        └─ Show success notification

RESULT: Alice can now login
        ├─ Login with username: alice
        ├─ sessionManager loads companies
        └─ Alice sees: [Company1, Company2]
           (but NOT Company3)
```

---

## Testing Scenarios Visual

```
SCENARIO 1: Admin Sees All Data
┌─────────────┐      ┌──────────┐      ┌──────────┐
│ Admin Login │ ───→ │ Dashboard│ ───→ │Company1  │
└─────────────┘      └──────────┘      │Company2  │
                                        │Company3  │
                                        └──────────┘
                                        All visible ✓

SCENARIO 2: User Sees Only Assigned Companies
┌─────────────────┐      ┌──────────┐      ┌──────────┐
│ User1 Login     │ ───→ │ Dashboard│ ───→ │Company1  │
│(assigned: 1,2)  │      └──────────┘      │Company2  │
└─────────────────┘                        └──────────┘
                                           Company3: Hidden ✓

SCENARIO 3: Real-time Update Visible to Multiple Users
┌─────────────────┐              ┌─────────────────┐
│ Admin Tab       │              │ User1 Tab       │
│ Views Company1  │              │ Views Company1  │
│ Invoice List:   │              │ Invoice List:   │
│ • INV-001       │              │ • INV-001       │
│ • INV-002       │              │ • INV-002       │
└────────┬────────┘              └────────┬────────┘
         │                               │
         │ User1 creates INV-003         │
         │                               │
         └──────────────────────────────►│
                                         │
                                    API Update
                                    ↓
                                 Database
                                    ↓
                                 Realtime Event
                                    ↓
                                Subscription
                                    │
         ┌──────────────────────────┴──────────────┐
         │                                         │
    ┌────▼────────────┐                  ┌────────▼────┐
    │ Admin Updates:  │                  │User1 Updates:
    │ • INV-001       │                  │ • INV-001    │
    │ • INV-002       │                  │ • INV-002    │
    │ • INV-003 ✓NEW  │                  │ • INV-003 ✓  │
    └─────────────────┘                  └──────────────┘

SCENARIO 4: Activity Logs Recorded
┌────────────────────────────────────────────────┐
│ Activity Log Display                           │
├────────────────────────────────────────────────┤
│ 14:30 - Admin - DELETED - invoice (INV-001)  │
│ 14:27 - User2 - UPDATED - invoice (INV-002)  │
│ 14:25 - User1 - UPDATED - invoice (INV-002)  │
│ 14:23 - User1 - CREATED - invoice (INV-003)  │
│ 14:20 - Admin - CREATED - user (alice)       │
└────────────────────────────────────────────────┘
```

---

## Database Schema Relationship Diagram

```
┌──────────────────┐
│ team_members     │
├──────────────────┤
│ id (PK)          │ ◄─┐
│ username         │   │
│ password         │   │
│ user_type        │   │
│ created_at       │   │
└──────────────────┘   │
                       │
    ┌──────────────────┴────────────────────┐
    │ (1 user has many assignments)         │
    │                                       │
┌───▼──────────────────────────┐    ┌──────▼──────────────┐
│ user_company_assignments     │    │ companies           │
├────────────────────────────┤    ├──────────────────────┤
│ id (PK)                    │    │ id (PK)              │
│ user_id (FK)───────────────┤────┤ name                 │
│ company_id (FK)──────────┐ │    │ email                │
│ assigned_by              │ │    │ phone                │
│ assigned_at              │ │    │ created_at           │
├────────────────────────────┤    └──────────────────────┘
│ (1 company has many users) │         ▲
└────────────────────────────┘         │
                                       └──┐
                                          │ (M2M join)
                        ┌─────────────────┘

┌──────────────────┐
│ activity_logs    │
├──────────────────┤
│ id (PK)          │
│ user_id (FK)─────┼──→ team_members.id
│ table_name       │
│ record_id        │
│ action           │ (CREATE|UPDATE|DELETE)
│ old_data         │
│ new_data         │
│ company_id (FK)──┼──→ companies.id
│ timestamp        │
└──────────────────┘
```

---

## Implementation Progress Checklist Visual

```
┌─ DATABASE SETUP ─────────────────────┐
│ ✅ user_company_assignments created  │
│ ✅ activity_logs created              │
│ ✅ Indexes created                    │
│ ✅ Migrations run                     │
└──────────────────────────────────────┘
              ↓
┌─ FRONTEND LIBRARIES ─────────────────┐
│ ✅ sessionManager.js                  │
│ ✅ realtimeSync.js                    │
│ ✅ dataSync.js                        │
│ ✅ Scripts added to index.html        │
└──────────────────────────────────────┘
              ↓
┌─ API HANDLERS ───────────────────────┐
│ ✅ team_members.js updated           │
│ ✅ companies.js updated              │
│ ✅ activity_logs.js created          │
│ ✅ api/index.js updated              │
└──────────────────────────────────────┘
              ↓
┌─ DATA FETCHING ──────────────────────┐
│ ✅ Companies loader updated           │
│ ✅ Invoices loader updated            │
│ ✅ Other data loaders updated         │
│ ✅ Session checks added               │
└──────────────────────────────────────┘
              ↓
┌─ REAL-TIME & TESTING ────────────────┐
│ ✅ Real-time subscriptions added      │
│ ✅ User management UI created         │
│ ✅ Activity dashboard created         │
│ ✅ Multi-user testing verified        │
│ ✅ Deployed to Vercel                 │
└──────────────────────────────────────┘
```

---

## Error Handling Flow

```
USER ATTEMPTS ACTION
        │
        ▼
    ┌─────────────────────────┐
    │ Check permissions       │
    │ (Frontend layer)        │
    └────┬────────────────────┘
         │
    ┌─No─┴─Yes─┐
    │           │
    ▼           ▼
┌───────┐   ┌─────────────────────┐
│ Block │   │ Call API            │
│ Show  │   │ (Backend layer)     │
│Error  │   └────┬────────────────┘
└───────┘        │
            ┌─No─┴─Yes─┐
            │           │
            ▼           ▼
        ┌──────┐   ┌──────────────┐
        │Return│   │Execute action│
        │Error │   │Log activity  │
        └──────┘   │Broadcast evt │
                   └──────┬───────┘
                          │
                          ▼
                    ┌──────────────┐
                    │Frontend      │
                    │Receives evt  │
                    │Refresh UI    │
                    └──────────────┘
```

---

## Timeline: Multi-User Invoice Update

```
TIME     USER1              SERVER              USER2
────     ─────              ──────              ─────

14:23    Create Invoice                        Viewing Dashboard
         └─→ POST /invoices
                           Update DB
                           Log Activity
                           Broadcast Event
                                              ◄─ Receive Event
                                              Refresh
                                              GET /invoices
                           Return updated
                                              Display INV-001

14:25    (viewing)         (idle)              Update amount
                                              └─→ PUT /invoices
                                                 {amount: 1200}
                           Update DB
                           Log Activity
                           Broadcast Event
         ◄─ Receive Event
         Refresh
         GET /invoices
                           Return updated
         Display 1200

(All changes visible in real-time < 100ms delay)
```

---

This visual guide should help you understand the system architecture and implementation flow!
