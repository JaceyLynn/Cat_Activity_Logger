// server.js
const express = require("express");
const fetch = require("node-fetch");
const app = express();

const PORT = process.env.PORT || 3000;

// Your Google Apps Script Web App URL
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyjzPKm6L_gFrevnlN8vR4pc22ep57Od3A9RKDBMQ6JnFxqtvk31icm7JO9AHHDvgRxcA/exec";

app.use(express.static("public")); // Serve static files from the 'public' folder

// Proxy endpoint
app.get("/catdata", async (req, res) => {
  try {
    const params = new URLSearchParams(req.query).toString(); // Capture all incoming query params
    const finalUrl = `${GOOGLE_SCRIPT_URL}?${params}`; // Forward the params to Apps Script

    const response = await fetch(finalUrl);
    const data = await response.json();

    res.json(data);
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ error: "Proxy failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});