// server.js
const express = require("express");
const fetch = require("node-fetch");
const app = express();

const PORT = process.env.PORT || 3000;

// Your Google Apps Script Web App URL
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxex7nE1A61YS93nJMAi5GUotRFtzpj13RFI7z4EyGmTEOwGPBUiZeJsfeUH4LUZ_0WJA/exec";

app.use(express.static("public")); // Serve static files from the 'public' folder

// Proxy endpoint
app.get("/catdata", async (req, res) => {
  try {
    const response = await fetch(GOOGLE_SCRIPT_URL);
    const data = await response.json();
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json(data);
  } catch (err) {
    console.error("Proxy fetch error:", err);
    res.status(500).json({ error: "Failed to fetch from Google Script" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});