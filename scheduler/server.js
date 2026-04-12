const express = require("express");
const fs = require("fs");

const app = express();
app.use(express.json());

const FILE = "./queue.json";
const PORT = 4000;

// ---------- Queue Helpers ----------
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

// ---------- Webhook Route ----------
//  https://skyrocket-wasabi-happening.ngrok-free.dev
app.post("/webhook", (req, res) => {
  const event = req.headers["x-github-event"];

  if (event !== "pull_request") {
    return res.status(200).send("Ignored event");
  }

  const action = req.body.action;

  // Only process when PR opened or updated
  if (!["opened", "synchronize", "reopened", "labeled"].includes(action)) {
    return res.status(200).send("Ignored PR action");
  }

  const pr = req.body.pull_request;
  const prNumber = pr.number;
  const branch = pr.head.ref;

  const labels = pr.labels.map(label => label.name);

  let priority = "normal";
  if (labels.includes("hotfix")) priority = "hotfix";
  else if (labels.includes("high")) priority = "high";

  addPR(prNumber, branch, priority);

  res.status(200).send("PR added to queue");
});

// ---------- Health ----------
app.get("/", (req, res) => {
  res.send("Scheduler running");
});

app.listen(PORT, () => {
  console.log(`Scheduler listening on port ${PORT}`);
});