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
const endCallBtn = document.getElementById("endCallBtn");
const fullscreenEndCallBtn = document.getElementById("fullscreenEndCallBtn");
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
let remoteMediaActive = false;
let dataConnectionOpen = false;
const sharedRoomId = new URLSearchParams(window.location.search).get("room") || "";
const pendingPlaybackRetryVideos = new WeakSet();
const icons = {
  hangUp: '<i class="fa-solid fa-phone-slash" aria-hidden="true"></i>',
  cameraOff: '<i class="fa-solid fa-camera-slash" aria-hidden="true"></i>',
  cameraOn: '<i class="fa-solid fa-camera" aria-hidden="true"></i>',
  audioOff: '<i class="fa-solid fa-microphone-slash" aria-hidden="true"></i>',
  audioOn: '<i class="fa-solid fa-microphone" aria-hidden="true"></i>',
  chat: "💬",
  focus: "⛶",
  backdrop: "🎨",
  exitFocus: "🗗",
};

function setStatus(message = "", tone = "neutral") {
  errorDisplay.textContent = message;
  errorDisplay.classList.remove("is-error", "is-success");

  if (tone === "error") {
    errorDisplay.classList.add("is-error");
  }

  if (tone === "success") {
    errorDisplay.classList.add("is-success");
  }
}

function updateButtonIcon(button, iconMarkup, label) {
  button.innerHTML = iconMarkup;
  button.title = label;
  button.setAttribute("aria-label", label);
}

function schedulePlaybackRetry(videoElement) {
  if (!videoElement || pendingPlaybackRetryVideos.has(videoElement)) {
    return;
  }

  pendingPlaybackRetryVideos.add(videoElement);

  const retryPlayback = () => {
    pendingPlaybackRetryVideos.delete(videoElement);

    const playPromise = videoElement.play();

    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch((error) => {
        console.warn("Video playback retry failed", error);
        schedulePlaybackRetry(videoElement);
      });
    }
  };

  document.addEventListener("click", retryPlayback, { once: true });
  document.addEventListener("touchend", retryPlayback, { once: true });
}

function attachStreamToVideo(videoElement, stream, { muted = false } = {}) {
  if (!videoElement || !stream) {
    return;
  }

  videoElement.muted = muted;
  videoElement.autoplay = true;
  videoElement.playsInline = true;
  videoElement.srcObject = stream;

  const tryPlay = () => {
    const playPromise = videoElement.play();

    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch((error) => {
        console.warn("Video playback could not start automatically", error);

        if (!muted && videoElement === remoteVideo) {
          setStatus(
            "Connected. If remote audio or video stays paused, tap anywhere once to start playback.",
            "success",
          );
          schedulePlaybackRetry(videoElement);
        }
      });
    }
  };

  if (videoElement.readyState >= 1) {
    tryPlay();
    return;
  }

  videoElement.onloadedmetadata = () => {
    tryPlay();
  };
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
    attachStreamToVideo(localVideo, localStream, { muted: true });
    setStatus();
    return localStream;
  } catch (error) {
    setStatus(`Error accessing camera or microphone: ${error.message}`, "error");
    throw error;
  }
}

function updateAudioButtons() {
  const icon = audioEnabled ? icons.audioOn : icons.audioOff;
  const label = audioEnabled ? "Mute microphone" : "Unmute microphone";
  updateButtonIcon(muteAudioBtn, icon, label);
  updateButtonIcon(fullscreenMuteAudioBtn, icon, label);
}

function updateVideoButtons() {
  const icon = videoEnabled ? icons.cameraOn : icons.cameraOff;
  const label = videoEnabled ? "Turn camera off" : "Turn camera on";
  updateButtonIcon(muteVideoBtn, icon, label);
  updateButtonIcon(fullscreenMuteVideoBtn, icon, label);
}

function setControlVisibility(button, isVisible) {
  if (!button) {
    return;
  }

  button.style.display = isVisible ? "inline-flex" : "none";
}

function syncCallActionButtons() {
  setControlVisibility(messageBtn, dataConnectionOpen);
  setControlVisibility(fullscreenMessageBtn, dataConnectionOpen);

  const showDisconnectButton = remoteMediaActive || dataConnectionOpen;
  setControlVisibility(endCallBtn, showDisconnectButton);
  setControlVisibility(fullscreenEndCallBtn, showDisconnectButton);
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

function clearInviteQuery() {
  const currentUrl = new URL(window.location.href);

  if (!currentUrl.searchParams.has("room")) {
    return;
  }

  currentUrl.searchParams.delete("room");
  window.history.replaceState({}, "", currentUrl.toString());
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

  if (connection.open) {
    dataConnectionOpen = true;
    connectedRoomId = connection.peer || connectedRoomId;
    syncCallActionButtons();
  }

  dataConnection.on("open", () => {
    dataConnectionOpen = true;
    connectedRoomId = connection.peer || connectedRoomId;
    syncCallActionButtons();
  });

  dataConnection.on("data", (message) => {
    appendMessage(String(message), false);
  });

  dataConnection.on("close", () => {
    if (dataConnection === connection) {
      dataConnection = null;
    }

    dataConnectionOpen = false;

    if (!remoteMediaActive) {
      connectedRoomId = "";
    }

    syncCallActionButtons();
  });
}

function removeEventHandler(target, eventName, handler) {
  if (!target) {
    return;
  }

  if (typeof target.off === "function") {
    target.off(eventName, handler);
    return;
  }

  if (typeof target.removeListener === "function") {
    target.removeListener(eventName, handler);
  }
}

function waitForDataConnection(connection, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      clearTimeout(timeoutId);
      removeEventHandler(connection, "open", handleOpen);
      removeEventHandler(connection, "error", handleError);
      removeEventHandler(connection, "close", handleClose);
    };

    const finish = (callback) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      callback();
    };

    const handleOpen = () => {
      finish(() => resolve());
    };

    const handleError = (error) => {
      finish(() => reject(error instanceof Error ? error : new Error(String(error))));
    };

    const handleClose = () => {
      finish(() => reject(new Error("Room connection closed before it finished joining.")));
    };

    const timeoutId = setTimeout(() => {
      finish(() => reject(new Error("Connection timed out while reaching the room.")));
    }, timeoutMs);

    connection.on("open", handleOpen);
    connection.on("error", handleError);
    connection.on("close", handleClose);
  });
}

function closeDataConnection() {
  if (!dataConnection) {
    dataConnectionOpen = false;
    syncCallActionButtons();
    return;
  }

  try {
    dataConnection.close();
  } catch (error) {
    console.warn("Failed to close data connection", error);
  }

  dataConnection = null;
  dataConnectionOpen = false;

  if (!remoteMediaActive) {
    connectedRoomId = "";
  }

  syncCallActionButtons();
}

function attachCallHandlers(activeCall) {
  if (currentCall && currentCall !== activeCall) {
    currentCall.close();
  }

  currentCall = activeCall;

  currentCall.on("stream", (remoteStream) => {
    remoteMediaActive = true;
    connectedRoomId = activeCall.peer || connectedRoomId;
    attachStreamToVideo(remoteVideo, remoteStream);
    syncCallActionButtons();
    setStatus("Connected. You're in the room.", "success");
  });

  currentCall.on("close", () => {
    if (currentCall === activeCall) {
      currentCall = null;
    }

    remoteMediaActive = false;
    remoteVideo.srcObject = null;

    if (!dataConnectionOpen) {
      connectedRoomId = "";
    }

    syncCallActionButtons();
  });

  currentCall.on("error", (error) => {
    console.warn("Media connection failed", error);
    setStatus(`Call error: ${error.message}`, "error");
  });
}

function closeCurrentCall() {
  if (!currentCall) {
    remoteMediaActive = false;
    remoteVideo.srcObject = null;

    if (!dataConnectionOpen) {
      connectedRoomId = "";
    }

    syncCallActionButtons();
    return;
  }

  try {
    currentCall.close();
  } catch (error) {
    console.warn("Failed to close call", error);
  }

  currentCall = null;
  remoteMediaActive = false;
  remoteVideo.srcObject = null;

  if (!dataConnectionOpen) {
    connectedRoomId = "";
  }

  syncCallActionButtons();
}

function createPeer() {
  peer = new Peer();

  peer.on("call", async (incomingCall) => {
    try {
      const stream = await getLocalStream();
      attachCallHandlers(incomingCall);
      incomingCall.answer(stream);
      connectedRoomId = incomingCall.peer || connectedRoomId;
      setStatus("Participant joined. Connecting media...", "success");
    } catch (error) {
      setStatus(`Could not answer incoming call: ${error.message}`, "error");

      try {
        incomingCall.close();
      } catch (closeError) {
        console.warn("Failed to close incoming call", closeError);
      }
    }
  });

  peer.on("connection", (connection) => {
    bindDataConnection(connection);
  });

  peer.on("error", (error) => {
    setStatus(`Error: ${error.message}`, "error");
    isCreatingRoom = false;
    isJoiningRoom = false;
    createRoomBtn.disabled = false;
    joinRoomBtn.disabled = false;
    createRoomBtn.textContent = currentRoomId ? "Room Ready" : "Create Room";
    joinRoomBtn.textContent = "Join Room";
    syncCallActionButtons();
  });

  peer.on("disconnected", () => {
    connectedRoomId = "";
    dataConnectionOpen = false;
    remoteMediaActive = false;
    syncCallActionButtons();
  });

  return peer;
}

function destroyPeer() {
  if (!peer) {
    return;
  }

  try {
    peer.destroy();
  } catch (error) {
    console.warn("Failed to destroy peer", error);
  }

  peer = null;
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

function resetMedia() {
  if (localStream) {
    localStream.getTracks().forEach((track) => {
      track.stop();
    });
  }

  localStream = null;
  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
  remoteMediaActive = false;
  audioEnabled = true;
  videoEnabled = true;
  updateAudioButtons();
  updateVideoButtons();
  syncCallActionButtons();
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
    setStatus("Invite link copied to clipboard.", "success");
  } catch (error) {
    setStatus(`Failed to copy invite link: ${error.message}`, "error");
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
      setStatus(`Failed to share invite link: ${error.message}`, "error");
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

function syncFocusUi(isActive) {
  if (isActive) {
    videoContainer.classList.add("zoomed");
    controls.style.display = "none";
    menuBtn.style.display = "inline-flex";
    fullscreenControls.classList.remove("show");
    return;
  }

  videoContainer.classList.remove("zoomed");
  controls.style.display = "flex";
  menuBtn.style.display = "none";
  fullscreenControls.classList.remove("show");
  videoContainer.style.backgroundColor = "";
}

async function enterFocusMode() {
  syncFocusUi(true);

  if (videoContainer.requestFullscreen && document.fullscreenElement !== videoContainer) {
    try {
      await videoContainer.requestFullscreen();
    } catch (error) {
      console.warn("Fullscreen request failed", error);
    }
  }
}

async function exitFocusMode() {
  syncFocusUi(false);

  if (document.fullscreenElement && document.exitFullscreen) {
    try {
      await document.exitFullscreen();
    } catch (error) {
      console.warn("Exiting fullscreen failed", error);
    }
  }
}

function resetRoomUi() {
  currentRoomId = "";
  connectedRoomId = "";
  dataConnectionOpen = false;
  roomCodeDisplay.innerHTML = "";
  roomCodeInput.value = "";
  createRoomBtn.disabled = false;
  createRoomBtn.textContent = "Create Room";
  joinRoomBtn.disabled = false;
  joinRoomBtn.textContent = "Join Room";
  chatBox.style.display = "none";
  syncCallActionButtons();
}

function endCallSession() {
  closeDataConnection();
  closeCurrentCall();
  destroyPeer();
  resetMedia();
  resetRoomUi();
  clearInviteQuery();
  exitFocusMode();
  setStatus("Call ended. You can create or join a new room.", "success");
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
    createRoomBtn.textContent = "Room Ready";
    setStatus("Room ready. Share the invite link below.", "success");
  } catch (error) {
    setStatus(`Could not create room: ${error.message}`, "error");
    createRoomBtn.textContent = "Create Room";
    createRoomBtn.disabled = false;
  } finally {
    isCreatingRoom = false;
  }
}

async function joinRoom(roomValue = roomCodeInput.value) {
  const roomId = extractRoomId(roomValue);

  if (!roomId) {
    setStatus("Please enter a room code or invite link.", "error");
    return;
  }

  if (isJoiningRoom || connectedRoomId === roomId) {
    if (connectedRoomId === roomId) {
      setStatus("You're already connected to this room.", "success");
    }
    return;
  }

  isJoiningRoom = true;
  joinRoomBtn.disabled = true;
  joinRoomBtn.textContent = "Joining...";

  try {
    await getLocalStream();
    await ensurePeerReady();

    roomCodeInput.value = roomId;
    setStatus(`Joining room ${roomId}...`, "success");

    const outgoingCall = peer.call(roomId, localStream);
    attachCallHandlers(outgoingCall);

    const connection = peer.connect(roomId);
    bindDataConnection(connection);
    await waitForDataConnection(connection);

    connectedRoomId = roomId;
    setStatus("Connected to the room. Finalizing media...", "success");
  } catch (error) {
    closeDataConnection();
    closeCurrentCall();
    connectedRoomId = "";
    setStatus(`Could not join room: ${error.message}`, "error");
  } finally {
    isJoiningRoom = false;
    joinRoomBtn.disabled = false;
    joinRoomBtn.textContent = "Join Room";
  }
}

function maybeJoinFromSharedLink() {
  if (!sharedRoomId) {
    return;
  }

  roomCodeInput.value = sharedRoomId;
  setStatus("Invite link detected. Tap Join Room to start the call.", "success");
}

createRoomBtn.addEventListener("click", createRoom);
joinRoomBtn.addEventListener("click", () => {
  joinRoom();
});
muteAudioBtn.addEventListener("click", toggleAudio);
fullscreenMuteAudioBtn.addEventListener("click", toggleAudio);
muteVideoBtn.addEventListener("click", toggleVideo);
fullscreenMuteVideoBtn.addEventListener("click", toggleVideo);
zoomBtn.addEventListener("click", enterFocusMode);
minimizeBtn.addEventListener("click", exitFocusMode);
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
endCallBtn.addEventListener("click", endCallSession);
fullscreenEndCallBtn.addEventListener("click", endCallSession);
closeChatBtn.addEventListener("click", () => {
  chatBox.style.display = "none";
});
document.addEventListener("fullscreenchange", () => {
  if (document.fullscreenElement !== videoContainer) {
    syncFocusUi(false);
  }
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
updateButtonIcon(messageBtn, icons.chat, "Open chat");
updateButtonIcon(fullscreenMessageBtn, icons.chat, "Open chat");
updateButtonIcon(zoomBtn, icons.focus, "Open focus mode");
updateButtonIcon(colorBtn, icons.backdrop, "Change background color");
updateButtonIcon(minimizeBtn, icons.exitFocus, "Exit focus mode");
updateButtonIcon(endCallBtn, icons.hangUp, "End call");
updateButtonIcon(fullscreenEndCallBtn, icons.hangUp, "End call");
chatBox.style.display = "none";
syncCallActionButtons();
setTimeout(maybeJoinFromSharedLink, 0);
