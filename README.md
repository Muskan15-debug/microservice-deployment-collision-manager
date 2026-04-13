# Microservice Deployment Collision Manager

A custom CI/CD orchestration system that prevents deployment collisions in microservice environments by serializing releases, prioritizing urgent fixes, and blocking backward-incompatible API changes before merge.

---

## 🚀 Problem Statement

In fast-moving teams, multiple developers often deploy changes simultaneously. This can cause:

- deployment collisions
- broken downstream services
- failed releases
- rollback chains
- coordination bottlenecks

This project solves that problem using a custom scheduler + contract testing pipeline.

---

## 🧠 Key Features

### ✅ Microservice Architecture
Two sample services:

- **User Service**
- **Order Service**

Order Service depends on User Service.

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
and blocks unsafe releases.

---

### ✅ Custom Deployment Scheduler
A Node.js scheduler that:

- **receives GitHub PR webhooks**
- **adds PRs to queue**
- **prioritizes urgent releases**
- **triggers GitHub Actions workflows**
- **runs one deployment at a time**

---

### ✅ Smart Priority Queue
Supports labels like:

- **`hotfix`**
- **`high`**
- **`normal`**
 
Hotfix PRs are processed first.

---

### ✅ Native PR Status Checks
Scheduler updates PR checks directly in GitHub:

- **Pending**
- **Success**
- **Failure**

---

## 🏗️ System Architecture


```text id="readme02"
Developer PR
    ↓
GitHub Webhook
    ↓
Scheduler Service
    ↓
Priority Queue
    ↓
Trigger GitHub Actions
    ↓
Run Contract Test
    ↓
Update PR Status
    ↓
Merge / Block
```

---

## 🐳 Tech Stack

- Node.js
- Express
- Docker
- Docker Compose
- GitHub Actions
- GitHub Webhooks
- REST APIs

---

## 📁 Project Structure
.  
├── user-service/  
├── order-service/  
├── contract-test/  
├── scheduler/  
├── docker-compose.yml  
└── .github/workflows/  

---

## ⚙️ Setup Instructions

### 1. Clone Repo

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

Create .env inside scheduler/
```bash
GITHUB_TOKEN=your_token
OWNER=your_username
REPO=your_repo
```

### 4. Run Scheduler

```bash
node server.js
```

### 5. Run Services

```bash
docker compose up --build
```

---

### 🧪 Demo Scenario
Safe PR
- **Open PR**
- **Scheduler queues it**
- **Contract test passes**
- **PR marked ✅**

Breaking PR  
Change:
```bash
name -> fullname
```
Result:
- **Contract test fails**
- **PR marked ❌**
- **Merge blocked**

Result:  
Hotfix runs first.

---

## 🔮 Future Improvements
- **Redis-backed persistent queue**
- **Dashboard UI**
- **Metrics / analytics**
- **Slack notifications**
- **Multi-environment deployments**

---

## 🏗️ Architecture Diagram

```text id="arch001"
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
      │ Priority Queue   │      │ PR Status Update │
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

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## 📧 Contact

For questions or feedback, please open an issue on GitHub.

---

**Built with ❤️ for better code reviews**