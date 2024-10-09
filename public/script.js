async function copy() {
  let text = document.getElementById("sessionID").innerText;
  await navigator.clipboard.writeText(text);
  document.getElementById("button").innerText = "COPIED";
  var socket = io();
  socket.emit("reset", "now");
}

function redirect() {
  window.location.href = "/session";
}
async function copy() {
  let text = document.getElementById("sessionID").innerText;
  await navigator.clipboard.writeText(text);
  document.getElementById("button").innerText = "COPIED";
}
function getPcode() {
  const phoneNumber = document.getElementById("phone-number").value.trim();
  const phoneNumberPattern = /^[0-9]{9,15}$/;
  if (phoneNumber === "" || !phoneNumberPattern.test(phoneNumber)) {
    alert("Please enter a valid phone number.");
    return;
  }
  const loadingContainer = document.getElementById("loading-container");
  loadingContainer.style.display = "flex";
  let pairingCode;
  fetch("/pcode/" + phoneNumber)
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json(); // Parse the JSON response
    })
    .then((data) => {
      pairingCode = data["pairing-code"];
      console.log(pairingCode);
      loadingContainer.style.display = "none";
      const popupContainer = document.getElementById("popup-container");
      const pairingCodeElement = document.getElementById("pairing-code");
      pairingCodeElement.textContent = pairingCode;
      popupContainer.style.display = "block";
    })
    .catch((error) => {
      console.error("Error:", error);
    });
}
function closePopup() {
  document.getElementById("popup-container").style.display = "none";
}
