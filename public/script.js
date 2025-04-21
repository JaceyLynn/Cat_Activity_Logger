const WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbxex7nE1A61YS93nJMAi5GUotRFtzpj13RFI7z4EyGmTEOwGPBUiZeJsfeUH4LUZ_0WJA/exec";

async function fetchCatData() {
  try {
    const res = await fetch("/catdata");
    const data = await res.json();

    if (!data || !Array.isArray(data) || data.length === 0) {
      console.warn("No data found in sheet.");
      return;
    }

    // Get the latest (last) row of data
    const latest = data[data.length - 1];

    console.log("Latest cat activity:", latest);

    updateUI(latest); // pass just this object to your UI function
  } catch (err) {
    console.error("Error fetching cat data:", err);
  }
}

function updateUI(latest) {
  const catBed = document.getElementById('cat-bed');
  const windowSpot = document.getElementById('window');
  const foodBowl = document.getElementById('food-bowl');

  [catBed, windowSpot, foodBowl].forEach(el => el.classList.remove('active'));

  const bedDetected = latest.event2 === "cat_detected";
  const windowDetected = latest.event1 === "cat_detected";
  const foodDetected = latest.Location === "Food Bowl";

  if (bedDetected) {
    catBed.classList.add('active');
    updateBoxText(catBed, latest.local_timestamp, latest.duration2, true, "Cat Detected");
  } else {
    updateBoxText(catBed, "-", "-", false, "Nothing Detected");
  }

  if (windowDetected) {
    windowSpot.classList.add('active');
    updateBoxText(windowSpot, latest.local_timestamp, latest.duration1, true, "Cat Detected");
  } else {
    updateBoxText(windowSpot, "-", "-", false, "Nothing Detected");
  }

  if (foodDetected) {
    foodBowl.classList.add('active');
    updateBoxText(foodBowl, latest.local_timestamp, latest.Duration || "-", true, "Cat Detected");
  } else {
    updateBoxText(foodBowl, "-", "-", false, "Nothing Detected");
  }
}


function updateBoxText(box, time, duration, showPaw = false, status = "-") {
  const p = box.querySelector('p');
  const pawLine = showPaw ? "🐾<br>" : "";
  p.innerHTML = `${pawLine}Current status:<br>${status}<br>Last active:<br>${time}<br>Duration:<br>${duration}`;
}

setInterval(fetchCatData, 3000);
fetchCatData();
