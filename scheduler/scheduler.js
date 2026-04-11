const fs = require("fs");
const axios = require("axios");

const FILE = "./queue.json";

const OWNER = "Muskan15-debug";
const REPO = "microservice-deployment-collision-manager";
const WORKFLOW = "pipeline.yml";
const TOKEN = process.env.GITHUB_TOKEN;

// ---------------- Queue Helpers ----------------
function loadQueue() {
  return JSON.parse(fs.readFileSync(FILE, "utf8"));
}

function saveQueue(queue) {
  fs.writeFileSync(FILE, JSON.stringify(queue, null, 2));
}

function score(priority) {
  if (priority === "hotfix") return 3;
  if (priority === "high") return 2;
  return 1;
}

function addPR(prNumber, branch, priority) {
  const queue = loadQueue();

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
  console.log("Queue Updated:", queue);
}

function nextPR() {
  const queue = loadQueue();
  if (queue.length === 0) return null;

  const next = queue.shift();
  saveQueue(queue);
  return next;
}

// ---------------- Trigger GitHub Workflow ----------------
async function triggerWorkflow(job) {
  try {
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW}/dispatches`;

    await axios.post(
      url,
      {
        ref: "main",
        inputs: {
          prNumber: job.prNumber,
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

    console.log(`Triggered workflow for PR + ${job.prNumber}`);
  } catch (err) {
    console.error("Failed to trigger workflow");
    console.error(err.response?.data || err.message);
  }
}

// ---------------- CLI ----------------
const cmd = process.argv[2];

if (cmd === "add") {
  const pr = process.argv[3];
  const branch = process.argv[4];
  const priority = process.argv[5] || "normal";

  addPR(pr, branch, priority);
}

if (cmd === "run-next") {
    const job = nextPR();

  if (!job) {
    console.log("No jobs in queue");
    process.exit(0);
  }

  triggerWorkflow(job);
}