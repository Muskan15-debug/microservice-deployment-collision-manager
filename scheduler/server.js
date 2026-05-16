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

// ---------- Init State ----------
if (!fs.existsSync(STATE_FILE)) {
  fs.writeFileSync(STATE_FILE, JSON.stringify({ running: false, current_job: null}, null, 2));
}

// ---------- Load Configurations ----------

function loadConfig() {
  return JSON.parse(fs.readFileSync("./config.json", "utf8"));
}

// ---------- Queue Helpers ----------
function loadQueue(repoName) {
  return JSON.parse(fs.readFileSync(FILE, "utf8"))[repoName];
}

function saveQueue(queue, repoName) {
  const data = JSON.parse(fs.readFileSync(FILE, "utf8"));
  data[repoName] = queue
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

function loadState(repoName) {
  return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"))[repoName];
}

function saveState(state, repoName) {
  const data = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  data[repoName] = state;
  fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 2));
}

function score(priority, repoConfig){
  return repoConfig.priorityLabels[priority];
}

function getPriority(labels, repoConfig) {
  let best = "normal";
  let maxScore = 1;

  for (const label of labels){
    const score = repoConfig.priorityLabels[label];
    if(score && score > maxScore){
      maxScore = score;
      best = label;
    }
  }

  return best;
}

function addPR(prNumber, branch, sha, labels, repoConfig) {
  const queue = loadQueue(repoConfig.repo);

  const alreadyExists = queue.find(q => q.prNumber == prNumber);
  if (alreadyExists) {
    console.log(`PR #${prNumber} already queued`);
    return;
  }

  const priority = getPriority(labels, repoConfig);

  queue.push({
    prNumber,
    branch,
    sha,
    priority,
    repoConfig,
    createdAt: Date.now()
  });

  queue.sort((a, b) => {
    if (score(b.priority, b.repoConfig) !== score(a.priority, a.repoConfig)) {
      return score(b.priority, b.repoConfig) - score(a.priority, a.repoConfig);
    }
    return a.createdAt - b.createdAt;
  });

  saveQueue(queue, repoConfig.repo);
  console.log("Updated Queue:", queue);
}

function nextPR(repoName) {
  const queue = loadQueue(repoName);
  if (queue.length === 0) return null;

  const job = queue.shift();
  saveQueue(queue, repoName);
  return job;
}

// ---------Trigger the workflow--------

async function triggerWorkflow(job) {
  const url = `https://api.github.com/repos/${job.repoConfig.owner}/${job.repoConfig.repo}/actions/workflows/${job.repoConfig.workflow}/dispatches`;

  await axios.post(
    url,
    {
      ref: job.repoConfig.defaultBranch,
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

async function updatePRStatus(sha, state, description, repoConfig) {
  const url = `https://api.github.com/repos/${repoConfig.owner}/${repoConfig.repo}/statuses/${sha}`;

  await axios.post(
    url,
    {
      state, // pending, success, failure, error
      context: "collision-manager",
      description,
      target_url: `https://github.com/${repoConfig.owner}/${repoConfig.repo}/actions`
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

async function runNextIfIdle(repoConfig) {
  const state = loadState(repoConfig.repo);

  if (state.running) {
    console.log("Deployment already running");
    return;
  }

  const job = nextPR(repoConfig.repo);

  if (!job) {
    console.log("Queue empty");
    return;
  }

  saveState({ 
    running: true,
    current_job: job 
  }, repoConfig.repo);

  try {
    await updatePRStatus(
      job.sha,
      "pending",
      "Deployment validation running",
      job.repoConfig
    );
    await triggerWorkflow(job);
  } catch (err) {
    console.error("Failed trigger:", err.message);
    console.error("Data:", JSON.stringify(err.response?.data, null, 2));
    await updatePRStatus(
      job.sha,
      "error",
      "Failed to start deployment pipeline",
      job.repoConfig
    );
    saveState({ running: false, current_job: null}, repoConfig.repo);
  }
}

// ---------- Webhook Route ----------
//  https://skyrocket-wasabi-happening.ngrok-free.dev
app.post("/webhook", async (req, res) => {
  const event = req.headers["x-github-event"];
  const repoName = req.body.repository.name;
  const ownerName = req.body.repository.owner.login;
  
  const config = loadConfig();

  const repoConfig = config.repositories.find(
    r => r.repo === repoName && r.owner === ownerName
  );
  
  if (!repoConfig) {
    return res.status(404).send("Repository not registered");
  }

  // ---------------- PR CREATED / UPDATED ----------------
  if (event === "pull_request") {
    const action = req.body.action;

    if (["opened", "reopened", "synchronize", "labeled"].includes(action)) {
      const pr = req.body.pull_request;
      const sha = pr.head.sha;
      const labels = pr.labels.map(l => l.name);

      addPR(pr.number, pr.head.ref, sha, labels, repoConfig);
      await runNextIfIdle(repoConfig);
    }

    return res.send("PR processed");
  }

  // ---------------- WORKFLOW COMPLETED ----------------
  if (event === "workflow_run") {
    const action = req.body.action;

    if (action === "completed") {
      const state = loadState(repoConfig.repo);
      const job = state.current_job;

      if(!job){
        saveState({ running: false, current_job: null}, repoConfig.repo);
        return res.send("No active job");
      }

      const result = req.body.workflow_run.conclusion;

      if (result === "success") {
        await updatePRStatus(
          job.sha,
          "success",
          "Contract checks passed",
          job.repoConfig
        );
      } else {
        await updatePRStatus(
          job.sha,
          "failure",
          "Contract checks failed",
          job.repoConfig
        );
      }

      saveState({ running: false, current_job: null}, repoConfig.repo);
      await runNextIfIdle(repoConfig);
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