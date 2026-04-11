const express = require("express");

const app = express();
const PORT = 5050;

const users = {
  1: { id: 1, name: "Alice", email: "alice@test.com" },
  2: { id: 2, name: "Bob", email: "bob@test.com" },
  3: { id: 3, name: "Charlie", email: "charlie@test.com" }
};

// Route: GET /user/:id
app.get("/user/:id", (req, res) => {
  const userId = req.params.id;

  const user = users[userId];

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  res.json(user);
});

app.listen(PORT, () => {
  console.log(`User Service running on port ${PORT}`);
});