"use strict";

const express = require("express");

const app = express();

// Routes
app.get("/*", (req, res) => {
  res.send(`Request received: ${req.method} - ${req.path}`);
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send("Internal Serverless Error");
});

app.listen(5700, console.log(`Server running on port 5700`));

module.exports = app;
