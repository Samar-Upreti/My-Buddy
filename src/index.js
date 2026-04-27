const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const createRoomBtn = document.getElementById("createRoomBtn");
const roomCodeDisplay = document.getElementById("roomCodeDisplay");
const roomCodeInput = document.getElementById("roomCodeInput");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const errorDisplay = document.getElementById("error");
const muteAudioBtn = document.getElementById("muteAudioBtn");
const muteVideoBtn = document.getElementById("muteVideoBtn");
const zoomBtn = document.getElementById("zoomBtn");
const videoContainer = document.getElementById("videoContainer");
const minimizeBtn = document.getElementById("fullscreenMinimizeBtn");
const controls = document.getElementById("controls");
const fullscreenControls = document.getElementById("fullscreenControls");
const menuBtn = document.getElementById("menuBtn");
const fullscreenMuteAudioBtn = document.getElementById("fullscreenMuteAudioBtn");
const fullscreenMuteVideoBtn = document.getElementById("fullscreenMuteVideoBtn");
const colorBtn = document.getElementById("colorBtn");
const colorPicker = document.getElementById("colorPicker");
const messageBtn = document.getElementById("messageBtn");
const fullscreenMessageBtn = document.getElementById("fullscreenMessageBtn");
const chatBox = document.getElementById("chatBox");
const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const sendMessageBtn = document.getElementById("sendMessageBtn");
const closeChatBtn = document.getElementById("closeChatBtn");
const imageBtn = document.getElementById("imageBtn");

let localStream;
let peer;
let currentCall;
let dataConnection;
let currentRoomId = "";
let connectedRoomId = "";
let audioEnabled = true;
let videoEnabled = true;
let isCreatingRoom = false;
let isJoiningRoom = false;

function setError(message = "") {
  errorDisplay.textContent = message;
}

async function getLocalStream() {
  if (localStream) {
    return localStream;
  }

  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    localVideo.srcObject = localStream;
    setError();
    return localStream;
  } catch (error) {
    setError(`Error accessing camera or microphone: ${error.message}`);
    throw error;
  }
}

function updateAudioButtons() {
  const icon = audioEnabled ? "\uD83D\uDD0A" : "\uD83D\uDD07";
  muteAudioBtn.textContent = icon;
  fullscreenMuteAudioBtn.textContent = icon;
}

function updateVideoButtons() {
  const icon = videoEnabled ? "\uD83D\uDCF7" : "\uD83D\uDCF5";
  muteVideoBtn.textContent = icon;
  fullscreenMuteVideoBtn.textContent = icon;
}

function toggleAudio() {
  if (!localStream) {
    return;
  }

  audioEnabled = !audioEnabled;
  localStream.getAudioTracks().forEach((track) => {
    track.enabled = audioEnabled;
  });
  updateAudioButtons();
}

function toggleVideo() {
  if (!localStream) {
    return;
  }

  videoEnabled = !videoEnabled;
  localStream.getVideoTracks().forEach((track) => {
    track.enabled = videoEnabled;
  });
  updateVideoButtons();
}

function showMessageButtons() {
  messageBtn.style.display = "block";
  fullscreenMessageBtn.style.display = "block";
}

function toggleChatBox() {
  chatBox.style.display = chatBox.style.display === "none" ? "block" : "none";
}

function appendMessage(message, isLocal = true) {
  const messageNode = document.createElement("div");
  messageNode.textContent = message;
  messageNode.classList.add("message");
  messageNode.classList.add(isLocal ? "local" : "remote");
  chatMessages.appendChild(messageNode);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function bindDataConnection(connection) {
  dataConnection = connection;

  dataConnection.on("open", () => {
    showMessageButtons();
  });

  dataConnection.on("data", (message) => {
    appendMessage(String(message), false);
  });

  dataConnection.on("close", () => {
    if (dataConnection === connection) {
      dataConnection = null;
    }
  });
}

function attachCallHandlers(activeCall) {
  if (currentCall && currentCall !== activeCall) {
    currentCall.close();
  }

  currentCall = activeCall;

  currentCall.on("stream", (remoteStream) => {
    remoteVideo.srcObject = remoteStream;
  });

  currentCall.on("close", () => {
    if (currentCall === activeCall) {
      currentCall = null;
      remoteVideo.srcObject = null;
      connectedRoomId = "";
    }
  });
}

function createPeer() {
  peer = new Peer();

  peer.on("call", (incomingCall) => {
    incomingCall.answer(localStream);
    attachCallHandlers(incomingCall);
    showMessageButtons();
  });

  peer.on("connection", (connection) => {
    bindDataConnection(connection);
  });

  peer.on("error", (error) => {
    setError(`Error: ${error.message}`);
    isCreatingRoom = false;
    isJoiningRoom = false;
    createRoomBtn.disabled = false;
    joinRoomBtn.disabled = false;
    createRoomBtn.textContent = currentRoomId ? "Room Ready" : "Create Room";
    joinRoomBtn.textContent = "Join Room";
  });

  peer.on("disconnected", () => {
    connectedRoomId = "";
  });

  return peer;
}

function ensurePeerReady() {
  if (peer && peer.open) {
    return Promise.resolve(peer);
  }

  if (!peer || peer.destroyed) {
    createPeer();
  }

  return new Promise((resolve, reject) => {
    const handleOpen = () => {
      cleanup();
      resolve(peer);
    };
    const handleError = (error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      peer.off("open", handleOpen);
      peer.off("error", handleError);
    };

    peer.on("open", handleOpen);
    peer.on("error", handleError);
  });
}

function buildInviteUrl(roomId) {
  const inviteUrl = new URL(window.location.origin + window.location.pathname);
  inviteUrl.searchParams.set("room", roomId);
  return inviteUrl.toString();
}

function extractRoomId(value) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return "";
  }

  if (trimmedValue.includes("room=")) {
    try {
      const parsedUrl = new URL(trimmedValue, window.location.origin);
      return parsedUrl.searchParams.get("room") || "";
    } catch (error) {
      return "";
    }
  }

  return trimmedValue;
}

async function copyToClipboard(value) {
  try {
    await navigator.clipboard.writeText(value);
    setError("Invite link copied to clipboard.");
  } catch (error) {
    setError(`Failed to copy invite link: ${error.message}`);
  }
}

async function shareInvite(roomId) {
  const inviteUrl = buildInviteUrl(roomId);

  if (!navigator.share) {
    await copyToClipboard(inviteUrl);
    return;
  }

  try {
    await navigator.share({
      title: "Join my My Buddy call",
      text: "Open this link to join my room directly.",
      url: inviteUrl,
    });
  } catch (error) {
    if (error.name !== "AbortError") {
      setError(`Failed to share invite link: ${error.message}`);
    }
  }
}

function renderRoomInvite(roomId) {
  const inviteUrl = buildInviteUrl(roomId);
  roomCodeDisplay.innerHTML = "";

  const label = document.createElement("p");
  label.textContent = "Share this link to join directly:";

  const link = document.createElement("a");
  link.href = inviteUrl;
  link.textContent = inviteUrl;
  link.target = "_blank";
  link.rel = "noopener noreferrer";

  const actions = document.createElement("div");
  actions.className = "room-actions";

  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.textContent = "Copy Link";
  copyButton.addEventListener("click", () => {
    copyToClipboard(inviteUrl);
  });

  const shareButton = document.createElement("button");
  shareButton.type = "button";
  shareButton.textContent = "Share Link";
  shareButton.addEventListener("click", () => {
    shareInvite(roomId);
  });

  actions.appendChild(copyButton);
  actions.appendChild(shareButton);
  roomCodeDisplay.appendChild(label);
  roomCodeDisplay.appendChild(link);
  roomCodeDisplay.appendChild(actions);
}

async function createRoom() {
  if (isCreatingRoom) {
    return;
  }

  if (currentRoomId) {
    renderRoomInvite(currentRoomId);
    return;
  }

  isCreatingRoom = true;
  createRoomBtn.disabled = true;
  createRoomBtn.textContent = "Creating...";

  try {
    await getLocalStream();
    await ensurePeerReady();
    currentRoomId = peer.id;
    roomCodeInput.value = currentRoomId;
    renderRoomInvite(currentRoomId);
    showMessageButtons();
    createRoomBtn.textContent = "Room Ready";
    setError();
  } catch (error) {
    setError(`Could not create room: ${error.message}`);
    createRoomBtn.textContent = "Create Room";
    createRoomBtn.disabled = false;
  } finally {
    isCreatingRoom = false;
  }
}

async function joinRoom(roomValue = roomCodeInput.value) {
  const roomId = extractRoomId(roomValue);

  if (!roomId) {
    setError("Please enter a room code or invite link.");
    return;
  }

  if (isJoiningRoom || connectedRoomId === roomId) {
    return;
  }

  isJoiningRoom = true;
  joinRoomBtn.disabled = true;
  joinRoomBtn.textContent = "Joining...";

  try {
    await getLocalStream();
    await ensurePeerReady();

    roomCodeInput.value = roomId;

    attachCallHandlers(peer.call(roomId, localStream));

    const connection = peer.connect(roomId);
    bindDataConnection(connection);

    connectedRoomId = roomId;
    showMessageButtons();
    setError();
  } catch (error) {
    connectedRoomId = "";
    setError(`Could not join room: ${error.message}`);
  } finally {
    isJoiningRoom = false;
    joinRoomBtn.disabled = false;
    joinRoomBtn.textContent = "Join Room";
  }
}

function maybeJoinFromSharedLink() {
  const roomId = new URLSearchParams(window.location.search).get("room");

  if (!roomId) {
    return;
  }

  roomCodeInput.value = roomId;
  joinRoom(roomId);
}

createRoomBtn.addEventListener("click", createRoom);
joinRoomBtn.addEventListener("click", () => {
  joinRoom();
});
muteAudioBtn.addEventListener("click", toggleAudio);
fullscreenMuteAudioBtn.addEventListener("click", toggleAudio);
muteVideoBtn.addEventListener("click", toggleVideo);
fullscreenMuteVideoBtn.addEventListener("click", toggleVideo);
zoomBtn.addEventListener("click", () => {
  videoContainer.classList.add("zoomed");
  controls.style.display = "none";
  menuBtn.style.display = "block";
  fullscreenControls.classList.remove("show");
});
minimizeBtn.addEventListener("click", () => {
  videoContainer.classList.remove("zoomed");
  fullscreenControls.style.display = "none";
  controls.style.display = "flex";
  menuBtn.style.display = "none";
  videoContainer.style.backgroundColor = "";
});
menuBtn.addEventListener("click", () => {
  fullscreenControls.classList.toggle("show");
});
colorBtn.addEventListener("click", () => {
  colorPicker.click();
});
colorPicker.addEventListener("input", (event) => {
  videoContainer.style.backgroundColor = event.target.value;
});
messageBtn.addEventListener("click", toggleChatBox);
fullscreenMessageBtn.addEventListener("click", toggleChatBox);
closeChatBtn.addEventListener("click", () => {
  chatBox.style.display = "none";
});
document.addEventListener("click", (event) => {
  if (
    chatBox.contains(event.target) ||
    messageBtn.contains(event.target) ||
    fullscreenMessageBtn.contains(event.target)
  ) {
    return;
  }

  chatBox.style.display = "none";
});
chatBox.addEventListener("click", (event) => {
  event.stopPropagation();
});
sendMessageBtn.addEventListener("click", () => {
  const message = chatInput.value.trim();

  if (!message) {
    return;
  }

  appendMessage(message);
  chatInput.value = "";

  if (dataConnection && dataConnection.open) {
    dataConnection.send(message);
  }
});
chatInput.addEventListener("keypress", (event) => {
  if (event.key === "Enter") {
    sendMessageBtn.click();
  }
});

if (imageBtn) {
  imageBtn.addEventListener("click", () => {
    window.location.href = "https://www.youtube.com/@swadesidev?sub_confirmation=1";
  });
}

updateAudioButtons();
updateVideoButtons();
chatBox.style.display = "none";
maybeJoinFromSharedLink();
