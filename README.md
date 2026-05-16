# Microservice Deployment Collision Manager

A configurable CI/CD orchestration system that prevents deployment collisions in microservice environments by serializing releases per repository, prioritizing urgent fixes, and blocking backward-incompatible API changes before merge.

---

## 🚀 Problem Statement

In fast-moving engineering teams, multiple developers often deploy changes simultaneously. This can cause:

- deployment collisions
- broken downstream services
- failed releases
- rollback chains
- coordination bottlenecks

This project solves that problem using a custom scheduler, repository-specific queues, GitHub Actions, and automated contract testing.

---

## 🧠 Key Features

### ✅ Microservice Architecture

Two sample services are included for demonstration:

- **User Service**
- **Order Service**

The Order Service depends on the User Service.

---

### ✅ Contract Testing Gatekeeper

Detects breaking API changes such as:

```json
{ "name": "Alice" }
```
changing to:
```json
{ "fullname": "Alice" }
```
and automatically blocks unsafe deployments before merge.

---

### ✅ Custom Deployment Scheduler
A Node.js scheduler that:

- receives GitHub PR webhooks 
- adds PRs to repository-specific queues 
- prioritizes urgent releases 
- triggers GitHub Actions workflows 
- automatically chains deployments 
- updates PR status checks

---

### ✅ Multi-Repository Support
The scheduler is configurable for multiple repositories. 

Each repository maintains:
- its own deployment queue 
- its own execution state 
- its own workflow configuration

This prevents unrelated repositories from blocking each other's deployments.

Example:
- `payments-service` deployments do not block `auth-service`
- each repository is serialized independently

---

### ✅ Smart Priority Queue
Supports labels like:
- `hotfix`
- `high`
- `normal`

Hotfix PRs are processed first inside their repository queue.

---

### ✅ Native PR Status Checks
Scheduler updates PR checks directly in GitHub:
- **Pending**
- **Success**
- **Failure**

---

## 🧠 Queueing Strategy
The scheduler uses a per-repository queueing model.

Each repository has:
- an independent deployment queue
- an independent execution state

This ensures:
- deployments inside the same repository are serialized
- unrelated repositories can deploy simultaneously

Example:
- `payments-service` PRs wait for other `payments-service` deployments
- `frontend-service` deployments can run concurrently

---

## 🏗️ System Architecture
```
Developer PR
    ↓
GitHub Webhook
    ↓
Scheduler Service
    ↓
Repository-specific Queue
    ↓
GitHub Actions Workflow
    ↓
Contract Testing
    ↓
PR Status Update
    ↓
Merge / Block
```

---

## 🏗️ Detailed Architecture Diagram
```
                    ┌──────────────────────┐
                    │   Developer PR       │
                    └─────────┬────────────┘
                              │
                              ▼
                    ┌──────────────────────┐
                    │ GitHub Webhook Event │
                    └─────────┬────────────┘
                              │
                              ▼
                    ┌──────────────────────┐
                    │ Scheduler Service    │
                    │ (Node.js + Express)  │
                    └─────────┬────────────┘
                              │
                 ┌────────────┴────────────┐
                 │                         │
                 ▼                         ▼
      ┌──────────────────┐      ┌──────────────────┐
      │ Repository Queue │      │ PR Status Update │
      └────────┬─────────┘      └──────────────────┘
               │
               ▼
      ┌──────────────────────────┐
      │ Trigger GitHub Actions   │
      └──────────┬───────────────┘
                 │
                 ▼
      ┌──────────────────────────┐
      │ Contract Test Pipeline   │
      └──────────┬───────────────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
   Pass ✅             Fail ❌
   Merge Allowed       Merge Blocked
```
---

## ⚙️ Configurable Multi-Repository Scheduler
Repositories are configured dynamically using config.json.

Example:
```json
{
  "repositories": [
    {
      "owner": "your-github-username",
      "repo": "payments-service",
      "workflow": "pipeline.yml",
      "defaultBranch": "main",
      "priorityLabels": {
        "hotfix": 3,
        "high": 2,
        "normal": 1
      }
    }
  ]
}
```

This allows the scheduler to work with any repository without changing application code.

---

## 🐳 Tech Stack

- Node.js
- Express
- Docker
- Docker Compose
- GitHub Actions
- GitHub Webhooks
- GitHub REST API

---

## 📁 Project Structure

.  
├── user-service/  
├── order-service/  
├── contract-test/  
├── scheduler/  
│   ├── queue.json  
│   ├── state.json  
│   ├── config.json  
│   └── server.js  
├── docker-compose.yml  
└── .github/workflows/  
 
---

## ⚙️ Setup Instructions
### 1. Clone Repository
```bash
git clone <repo-url>
cd <repo-name>
```

### 2. Install Dependencies
```bash
cd scheduler
npm install
```

### 3. Add Environment Variables

Create a .env file inside scheduler/
```env
GITHUB_TOKEN=your_github_token
```

### 4. Configure Repositories

Create `config.json`

Example:
```json
{
  "repositories": [
    {
      "owner": "your-github-username",
      "repo": "your-repository",
      "workflow": "pipeline.yml",
      "defaultBranch": "main",
      "priorityLabels": {
        "hotfix": 3,
        "high": 2,
        "normal": 1
      }
    }
  ]
}
```

---

## 🌐 GitHub Webhook + ngrok Setup

### ❓ Why ngrok?

GitHub Webhooks cannot directly communicate with:
```
localhost:4000
```
because localhost is only accessible inside your own machine.

Since the scheduler runs locally during development, GitHub needs a public URL to send webhook events.

ngrok creates a secure public tunnel to your local server.

Example:
```
https://abcd-1234.ngrok-free.app
        ↓
localhost:4000
```

This allows GitHub to communicate with the scheduler running on your local machine.

---

## 🚀 Start the Scheduler Server
Inside the scheduler directory:

```
node server.js
```

Expected output:

```
Scheduler listening on port 4000
```

---

## 🚀 Start ngrok
Open a separate terminal and run:

```
ngrok http 4000
```

Example output:

```
Forwarding:
https://abcd-1234.ngrok-free.app -> http://localhost:4000
```

Copy the HTTPS URL.

---

### 🔗 Configure GitHub Webhook
Go to:
```
GitHub Repository
→ Settings
→ Webhooks
→ Add Webhook
```

**Payload URL**
```
https://abcd-1234.ngrok-free.app/webhook
```

**Content Type**
```
application/json
```

**Events**

Enable:
- Pull Requests
- Workflow Runs

---

## ✅ Result

Now whenever:
- a PR is opened
- synchronized
- relabeled
- workflow completes

GitHub automatically sends events to the scheduler.

---

## 🔄 Deployment Flow

1. Developer opens a Pull Request
2. GitHub sends webhook event to scheduler
3. Scheduler identifies repository
4. PR is added to repository-specific queue
5. Scheduler triggers GitHub Actions workflow
6. Contract tests validate compatibility
7. Scheduler updates PR status
8. Next queued deployment starts automatically

---

## 🧪 Demo Scenarios

### ✅ Safe Pull Request

- Open PR
- Scheduler queues it
- Contract test passes
- PR marked ✅
- Merge allowed

---

### ❌ Breaking Pull Request

Change:
```
name -> fullname
```

Result:
- Contract test fails
- PR marked ❌
- Merge blocked

---

### 🚨 Priority Queue Demo
Create two PRs:
- PR A → `normal`
- PR B → `hotfix`

Result:
- Hotfix PR runs first

---

### 🚀 Multi-Repository Demo

Create PRs in:
- `payments-service`
- `frontend-service`

Result:
- both repositories maintain separate queues
- deployments run independently
- no unnecessary blocking occurs

---

## 🧠 Engineering Design Decisions
### Why per-repository queues?
A single global deployment queue unnecessarily blocks unrelated services.

The scheduler instead serializes deployments only within the same repository, allowing independent services to deploy concurrently while still preventing conflicting releases.

---

## 🔮 Future Improvements

- Redis-backed persistent queues
- Distributed scheduler instances
- Multi-environment deployments
- Kubernetes integration

---

## 🤝 Contributing
Contributions are welcome! Feel free to open issues or submit pull requests.

---

## 📧 Contact

For questions or feedback, please open an issue on GitHub.

---

**Built for solving real-world deployment collision problems in distributed systems.**
