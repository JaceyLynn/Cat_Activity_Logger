import express from "express";
import fetch from "node-fetch"; // Add this in package.json if needed

const app = express();
const PORT = 3000;

app.use(express.static("public")); // Your frontend files

// Proxy endpoint
app.get("/catdata", async (req, res) => {
  try {
    const response = await fetch("https://script.google.com/macros/s/AKfycbzeWivvlze9kl4tQeSPgaj3yU3vrIEu6NYsWeZlcNtz7ZpNm6LQGLrnRFjrlOqhttMm-A/exec");
    const data = await response.json();
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json(data);
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).send("Error fetching data");
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});