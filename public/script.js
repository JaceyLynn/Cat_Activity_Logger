const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzeWivvlze9kl4tQeSPgaj3yU3vrIEu6NYsWeZlcNtz7ZpNm6LQGLrnRFjrlOqhttMm-A/exec"; 

async function fetchCatData() {
  try {
    const res = await fetch("/catdata"); // <- Call your proxy route instead!
    const data = await res.json();

    console.log("Fetched via proxy:", data);

    if (!data || data.length === 0) return;

    const latest = data[data.length - 1];
    updateUI(latest);
  } catch (err) {
    console.error("Error fetching cat data:", err);
  }
}

  
  function updateUI(latest) {
    const catBed = document.getElementById('cat-bed');
    const windowSpot = document.getElementById('window');
    const foodBowl = document.getElementById('food-bowl'); // Optional
  
    // Reset all
    [catBed, windowSpot, foodBowl].forEach(el => el.classList.remove('active'));
  
    // CAT BED section logic
    if (latest.event2 === "cat_detected") {
      catBed.classList.add('active');
      updateBoxText(catBed, latest.local_timestamp, latest.duration2);
    } else {
      updateBoxText(catBed, "-", "-");
    }
  
    // WINDOW section logic
    if (latest.event1 === "cat_detected") {
      windowSpot.classList.add('active');
      updateBoxText(windowSpot, latest.local_timestamp, latest.duration1);
    } else {
      updateBoxText(windowSpot, "-", "-");
    }
  
    // FOOD BOWL: handle if you want
    if (latest.Location === "Food Bowl") {
      foodBowl.classList.add('active');
      updateBoxText(foodBowl, latest.local_timestamp, latest.Duration || "-");
    } else {
      updateBoxText(foodBowl, "-", "-");
    }
  }
  
  function updateBoxText(box, time, duration) {
    const p = box.querySelector('p');
    if (!p) return;
    p.innerHTML = `Last active:<br>${time}<br>Duration:<br>${duration}`;
  }
  
  setInterval(fetchCatData, 3000);
  fetchCatData();