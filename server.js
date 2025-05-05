// server.js
const express = require("express");
const fetch = require("node-fetch");
const app = express();

const PORT = process.env.PORT || 3000;

// Your Google Apps Script Web App URL
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyjzPKm6L_gFrevnlN8vR4pc22ep57Od3A9RKDBMQ6JnFxqtvk31icm7JO9AHHDvgRxcA/exec";

app.use(express.static("public")); // Serve static files from the 'public' folder

// Proxy endpoint
app.get('/catdata', async (req, res) => {
  const { sheet, mode } = req.query;
  // Build the Apps Script URL
  let url = GOOGLE_SCRIPT_URL + '?';
  if (mode === 'listSheets') {
    url += 'mode=listSheets';
  } else if (sheet) {
    url += 'sheet=' + encodeURIComponent(sheet);
  }
  try {
    const apiRes = await fetch(url);
    const text = await apiRes.text();
    // forward JSON or error
    res.set('Content-Type','application/json');
    res.send(text);
  } catch (err) {
    console.error('Proxy error', err);
    res.status(502).send({error: 'Bad gateway'});
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});