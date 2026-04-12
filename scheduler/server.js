const express = require("express");
const fs = require("fs");
const axios = require("axios");

const app = express();
app.use(express.json());

const FILE = "./queue.json";
const STATE_FILE = "./state.json";
const PORT = 4000;

const OWNER = "Muskan15-debug";
const REPO = "microservice-deployment-collision-manager";
const WORKFLOW = "pipeline.yml";
const TOKEN = process.env.GITHUB_TOKEN;

// ---------- Init State ----------
if (!fs.existsSync(STATE_FILE)) {
  fs.writeFileSync(STATE_FILE, JSON.stringify({ running: false }, null, 2));
}

// ---------- Queue Helpers ----------
function loadQueue() {
  return JSON.parse(fs.readFileSync(FILE, "utf8"));
}

function saveQueue(queue) {
  fs.writeFileSync(FILE, JSON.stringify(queue, null, 2));
}

function loadState() {
  return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function score(priority) {
  if (priority === "hotfix") return 3;
  if (priority === "high") return 2;
  return 1;
}

function addPR(prNumber, branch, priority) {
  const queue = loadQueue();

  const alreadyExists = queue.find(q => q.prNumber == prNumber);
  if (alreadyExists) {
    console.log(`PR #${prNumber} already queued`);
    return;
  }

  queue.push({
    prNumber,
    branch,
    priority,
    createdAt: Date.now()
  });

  queue.sort((a, b) => {
    if (score(b.priority) !== score(a.priority)) {
      return score(b.priority) - score(a.priority);
    }
    return a.createdAt - b.createdAt;
  });

  saveQueue(queue);
  console.log("Updated Queue:", queue);
}

function nextPR() {
  const queue = loadQueue();
  if (queue.length === 0) return null;

  const job = queue.shift();
  saveQueue(queue);
  return job;
}

// ---------Trigger the workflow--------

async function triggerWorkflow(job) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW}/dispatches`;

  await axios.post(
    url,
    {
      ref: "main",
      inputs: {
        prNumber: String(job.prNumber),
        branch: job.branch
      }
    },
    {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: "application/vnd.github+json"
      }
    }
  );

  console.log(`Triggered PR #${job.prNumber}`);
}

async function runNextIfIdle() {
  const state = loadState();

  if (state.running) {
    console.log("Deployment already running");
    return;
  }

  const job = nextPR();

  if (!job) {
    console.log("Queue empty");
    return;
  }

  saveState({ running: true });

  try {
    await triggerWorkflow(job);
  } catch (err) {
    console.error("Failed trigger:", err.message);
    saveState({ running: false });
  }
}

// ---------- Webhook Route ----------
//  https://skyrocket-wasabi-happening.ngrok-free.dev
app.post("/webhook", async (req, res) => {
  const event = req.headers["x-github-event"];

  // ---------------- PR CREATED / UPDATED ----------------
  if (event === "pull_request") {
    const action = req.body.action;

    if (["opened", "reopened", "synchronize", "labeled"].includes(action)) {
      const pr = req.body.pull_request;
      const labels = pr.labels.map(l => l.name);

      let priority = "normal";
      if (labels.includes("hotfix")) priority = "hotfix";
      else if (labels.includes("high")) priority = "high";

      addPR(pr.number, pr.head.ref, priority);
      await runNextIfIdle();
    }

    return res.send("PR processed");
  }

  // ---------------- WORKFLOW COMPLETED ----------------
  if (event === "workflow_run") {
    const action = req.body.action;

    if (action === "completed") {
      saveState({ running: false });
      await runNextIfIdle();
    }

    return res.send("Workflow completion processed");
  }

  res.send("Ignored");
});

// ---------- Health ----------
app.get("/", (req, res) => {
  res.send("Scheduler running");
});

app.listen(PORT, () => {
  console.log(`Scheduler listening on port ${PORT}`);
});