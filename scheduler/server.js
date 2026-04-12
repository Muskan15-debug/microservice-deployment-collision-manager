const express = require("express");
const fs = require("node:fs");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(express.json());

const FILE = "./queue.json";
const STATE_FILE = "./state.json";
const PORT = 4000;

const TOKEN = process.env.GITHUB_TOKEN
const OWNER = process.env.OWNER
const REPO = process.env.REPO
const WORKFLOW = process.env.WORKFLOW

// ---------- Init State ----------
if (!fs.existsSync(STATE_FILE)) {
  fs.writeFileSync(STATE_FILE, JSON.stringify({ running: false, current_job: Number.NaN}, null, 2));
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

function addPR(prNumber, branch, sha, priority) {
  const queue = loadQueue();

  const alreadyExists = queue.find(q => q.prNumber == prNumber);
  if (alreadyExists) {
    console.log(`PR #${prNumber} already queued`);
    return;
  }

  queue.push({
    prNumber,
    branch,
    sha,
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
      ref: job.branch,
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

async function updatePRStatus(sha, state, description) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/statuses/${sha}`;

  await axios.post(
    url,
    {
      state, // pending, success, failure, error
      context: "collision-manager",
      description,
      target_url: `https://github.com/${OWNER}/${REPO}/actions`
    },
    {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: "application/vnd.github+json"
      }
    }
  );

  console.log(`Status updated: ${state} for ${sha}`);
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

  saveState({ 
    running: true,
    current_job: job 
  });

  try {
    await updatePRStatus(
      job.sha,
      "pending",
      "Deployment validation running"
    );
    await triggerWorkflow(job);
  } catch (err) {
    console.error("Failed trigger:", err.message);
    console.error("Data:", JSON.stringify(err.response?.data, null, 2));
    await updatePRStatus(
      job.sha,
      "error",
      "Failed to start deployment pipeline"
    );
    saveState({ running: false, current_job: Number.NaN});
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
      const sha = pr.head.sha;
      const labels = pr.labels.map(l => l.name);

      let priority = "normal";
      if (labels.includes("hotfix")) priority = "hotfix";
      else if (labels.includes("high")) priority = "high";

      addPR(pr.number, pr.head.ref, sha, priority);
      await runNextIfIdle();
    }

    return res.send("PR processed");
  }

  // ---------------- WORKFLOW COMPLETED ----------------
  if (event === "workflow_run") {
    const action = req.body.action;

    if (action === "completed") {
      const state = loadState();
      const job = state.current_job;

      if(job===Number.isNaN()){
        saveState({ running: false, current_job: Number.NaN});
        return res.send("No active job");
      }

      const result = req.body.workflow_run.conclusion;

      if (result === "success") {
        await updatePRStatus(
          job.sha,
          "success",
          "Contract checks passed"
        );
      } else {
        await updatePRStatus(
          job.sha,
          "failure",
          "Contract checks failed"
        );
      }

      saveState({ running: false, current_job: Number.NaN});
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