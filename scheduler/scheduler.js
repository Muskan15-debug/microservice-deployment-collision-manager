const fs = require("fs");

const FILE = "./queue.json";

function loadQueue() {
  return JSON.parse(fs.readFileSync(FILE, "utf8"));
}

function saveQueue(queue) {
  fs.writeFileSync(FILE, JSON.stringify(queue, null, 2));
}

// Priority scores
function score(priority) {
  if (priority === "hotfix") return 3;
  if (priority === "high") return 2;
  return 1;
}

// Add PR to queue
function addPR(prNumber, priority) {
  const queue = loadQueue();

  queue.push({
    prNumber,
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

// Get next PR
function nextPR() {
  const queue = loadQueue();
  if (queue.length === 0) return null;

  const next = queue.shift();
  saveQueue(queue);
  return next;
}

// CLI usage
const cmd = process.argv[2];

if (cmd === "add") {
  const pr = process.argv[3];
  const priority = process.argv[4] || "normal";
  addPR(pr, priority);
}

if (cmd === "next") {
  console.log(nextPR());
}