        const localVideo = document.getElementById('localVideo');
        const remoteVideo = document.getElementById('remoteVideo');
        const createRoomBtn = document.getElementById('createRoomBtn');
        const roomCodeDisplay = document.getElementById('roomCodeDisplay');
        const roomCodeInput = document.getElementById('roomCodeInput');
        const joinRoomBtn = document.getElementById('joinRoomBtn');
        const errorDisplay = document.getElementById('error');

        const muteAudioBtn = document.getElementById('muteAudioBtn');
        const muteVideoBtn = document.getElementById('muteVideoBtn');
        const zoomBtn = document.getElementById('zoomBtn');

        const videoContainer = document.getElementById('videoContainer');
        const minimizeBtn = document.getElementById('fullscreenMinimizeBtn');
        const controls = document.getElementById('controls');
        const fullscreenControls = document.getElementById('fullscreenControls');
        const menuBtn = document.getElementById('menuBtn');

        const fullscreenMuteAudioBtn = document.getElementById('fullscreenMuteAudioBtn');
        const fullscreenMuteVideoBtn = document.getElementById('fullscreenMuteVideoBtn');
        const colorBtn = document.getElementById('colorBtn'); // Color button
        const colorPicker = document.getElementById('colorPicker'); // Hidden color picker

        let localStream;
        let peer;
        let call;
        let audioEnabled = true;
        let videoEnabled = true;

        // Function to get media stream (video and audio)
        function getLocalStream() {
            return navigator.mediaDevices.getUserMedia({ video: true, audio: true })
                .then(stream => {
                    localStream = stream;
                    localVideo.srcObject = stream;
                    errorDisplay.textContent = '';  // Clear error if successful
                })
                .catch(err => {
                    errorDisplay.textContent = 'Error accessing camera or microphone: ' + err.message;
                });
        }

// Create a room (Host)
createRoomBtn.addEventListener('click', () => {
    getLocalStream().then(() => {
        peer = new Peer(); // Create a PeerJS instance

        // When the peer connection opens, handle room creation
        peer.on('open', id => {
            showMessageButtons();
            // Uncomment this block if you want to display the room code and add functionality for copy/share.
            // roomCodeDisplay.innerHTML = `
            //     Room Code: ${id}
            //     <span class="icon-btn copy-icon" id="copyBtn"></span>
            //     <span class="icon-btn share-icon" id="shareBtn"></span>
            // `;
            
            // Add event listeners to copy and share icons
            // document.getElementById('copyBtn').addEventListener('click', () => copyToClipboard(id));
            // document.getElementById('shareBtn').addEventListener('click', () => shareRoomCode(id));
        });

        // Handle incoming data connections (for messaging)
        peer.on('connection', conn => {
            dataConnection = conn; // Store the data connection object

            // Ensure the data connection is open before allowing messages
            dataConnection.on('open', () => {
                dataConnection.on('data', message => {
                    appendMessage(message, false); // Display remote message
                });
            });
        });

        // Handle incoming video calls
        peer.on('call', incomingCall => {
            incomingCall.answer(localStream); // Answer the call with the local stream
            incomingCall.on('stream', stream => {
                remoteVideo.srcObject = stream; // Display the remote stream
            });

            // Store the current call for later use (e.g., ending the call)
            currentCall = incomingCall;
        });
    });
});




        // Join a room (Joiner)
        joinRoomBtn.addEventListener('click', () => {
            const roomId = roomCodeInput.value;
            if (roomId) {
                getLocalStream().then(() => {
                    peer = new Peer();
                    call = peer.call(roomId, localStream);  // Call the host
                    call.on('stream', stream => {
                        remoteVideo.srcObject = stream;
                    });
                });
            } else {
                errorDisplay.textContent = 'Please enter a room code.';
            }
        });

        // Mute/Unmute audio for both modes
        function toggleAudio() {
            audioEnabled = !audioEnabled;
            localStream.getAudioTracks()[0].enabled = audioEnabled;
            muteAudioBtn.textContent = audioEnabled ? '🔊' : '🔇';
            fullscreenMuteAudioBtn.textContent = audioEnabled ? '🔊' : '🔇';
        }

        muteAudioBtn.addEventListener('click', toggleAudio);
        fullscreenMuteAudioBtn.addEventListener('click', toggleAudio);

        // Mute/Unmute video for both modes
        function toggleVideo() {
            videoEnabled = !videoEnabled;
            localStream.getVideoTracks()[0].enabled = videoEnabled;
            muteVideoBtn.textContent = videoEnabled ? '📷' : '📵';
            fullscreenMuteVideoBtn.textContent = videoEnabled ? '📷' : '📵';
        }

        muteVideoBtn.addEventListener('click', toggleVideo);
        fullscreenMuteVideoBtn.addEventListener('click', toggleVideo);

        // Zoom mode (simulated fullscreen)
        zoomBtn.addEventListener('click', () => {
            videoContainer.classList.add('zoomed');
            controls.style.display = 'none';  // Hide original controls
            menuBtn.style.display = 'block';  // Show menu button
            fullscreenControls.classList.remove('show');  // Hide controls on zoom-in
        });

        // Minimize zoom mode
        minimizeBtn.addEventListener('click', () => {
            videoContainer.classList.remove('zoomed');
            fullscreenControls.style.display = 'none';
            controls.style.display = 'flex';
            menuBtn.style.display = 'none';  // Hide menu button
            videoContainer.style.backgroundColor = ''; // Reset background color when zoomed out
        });

        // Toggle menu (show/hide fullscreen controls)
        menuBtn.addEventListener('click', () => {
            fullscreenControls.classList.toggle('show');
        });

        

        // Open color picker when clicking the color button
        colorBtn.addEventListener('click', () => {
            colorPicker.click();
        });

        // Change background color based on selected color (only in zoomed mode)
        colorPicker.addEventListener('input', (event) => {
            videoContainer.style.backgroundColor = event.target.value;
        });

        // Get the message buttons
        const messageBtn = document.getElementById('messageBtn');
        const fullscreenMessageBtn = document.getElementById('fullscreenMessageBtn');

        // Function to show the message buttons
        function showMessageButtons() {
            messageBtn.style.display = 'block';
            fullscreenMessageBtn.style.display = 'block';
        }

        // Modify the existing event listeners for room creation and joining

        // When user creates a room (Host)
       

        // When user joins a room (Joiner)
        joinRoomBtn.addEventListener('click', () => {
            const roomId = roomCodeInput.value;
            if (roomId) {
                getLocalStream().then(() => {
                    peer = new Peer();
                    call = peer.call(roomId, localStream);  // Call the host
                    call.on('stream', stream => {
                        remoteVideo.srcObject = stream;
                    });

                    // Show the message buttons when the room is joined
                    showMessageButtons();  // <- Add this line to invoke chat button on join
                });
            } else {
                errorDisplay.textContent = 'Please enter a room code.';
            }
        });


        // Get the chat elements
        const chatBox = document.getElementById('chatBox');
        const chatMessages = document.getElementById('chatMessages');
        const chatInput = document.getElementById('chatInput');
        const sendMessageBtn = document.getElementById('sendMessageBtn');
        const closeChatBtn = document.getElementById('closeChatBtn'); // New close button

        // Show/Hide the chat box when the message button is clicked
        messageBtn.addEventListener('click', toggleChatBox);
        fullscreenMessageBtn.addEventListener('click', toggleChatBox);

        function toggleChatBox() {
            chatBox.style.display = chatBox.style.display === 'none' ? 'block' : 'none';
        }

        // Close the chat box when the close button is clicked
        closeChatBtn.addEventListener('click', () => {
            chatBox.style.display = 'none';
        });

        // Close the chat box by clicking outside
        document.addEventListener('click', (event) => {
            if (!chatBox.contains(event.target) && !messageBtn.contains(event.target) && !fullscreenMessageBtn.contains(event.target)) {
                chatBox.style.display = 'none';
            }
        });

        // Prevent chat box from closing when clicked inside
        chatBox.addEventListener('click', (event) => {
            event.stopPropagation();
        });

        let dataConnection; // To hold the data connection for chat

        // Function to append a message to the chat box
        function appendMessage(message, isLocal = true) {
            const msgElement = document.createElement('div');
            msgElement.textContent = message;
            msgElement.style.textAlign = isLocal ? 'right' : 'left'; // Align local messages to the right
            msgElement.style.padding = '5px';
            msgElement.style.marginBottom = '5px';
            msgElement.style.borderRadius = '5px';
            msgElement.style.backgroundColor = isLocal ? '#007bff' : '#f1f1f1';
            msgElement.style.color = isLocal ? 'white' : 'black';
            chatMessages.appendChild(msgElement);
            chatMessages.scrollTop = chatMessages.scrollHeight; // Scroll to bottom
        }

        // When user creates a room (Host)
       
        // When user joins a room (Joiner)
        joinRoomBtn.addEventListener('click', () => {
            const roomId = roomCodeInput.value;
            if (roomId) {
                getLocalStream().then(() => {
                    peer = new Peer();
                    call = peer.call(roomId, localStream);
                    call.on('stream', stream => {
                        remoteVideo.srcObject = stream;
                    });

                    // Establish a data connection for chat
                    dataConnection = peer.connect(roomId);
                    dataConnection.on('data', (message) => {
                        appendMessage(message, false); // Display remote message
                    });
                });
            }
        });

        // Send a chat message
        sendMessageBtn.addEventListener('click', () => {
            const message = chatInput.value;
            if (message.trim() !== '') {
                appendMessage(message); // Show the local message
                chatInput.value = ''; // Clear the input field
                if (dataConnection) {
                    dataConnection.send(message); // Send the message to the peer
                }
            }
        });

        // Allow pressing "Enter" to send a message
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessageBtn.click();
            }
        });


        // Function to append a message to the chat box
        function appendMessage(message, isLocal = true) {
            const msgElement = document.createElement('div');
            msgElement.textContent = message;
            
            // Apply message classes
            msgElement.classList.add('message');
            if (isLocal) {
                msgElement.classList.add('local');
            } else {
                msgElement.classList.add('remote');
            }

            // Append the message to the chat box
            chatMessages.appendChild(msgElement);
            
            // Scroll to the bottom
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }

             // The Update JS                                         The Updated JS
   
            let currentCall;  // To hold the current active call

            // Function to get the local media stream (video and audio)
            function getLocalStream() {
                return navigator.mediaDevices.getUserMedia({ video: true, audio: true })
                    .then(stream => {
                        localStream = stream;
                        localVideo.srcObject = stream;
                        errorDisplay.textContent = '';  // Clear any previous errors
                    })
                    .catch(err => {
                        errorDisplay.textContent = 'Error accessing camera or microphone: ' + err.message;
                    });
            }

            // Function for creating a room (host)
           

            // Function for joining a room (joiner)
            joinRoomBtn.addEventListener('click', () => {
                const roomId = roomCodeInput.value;
                if (roomId) {
                    getLocalStream().then(() => {
                        peer = new Peer();  // Create PeerJS instance for the joiner

                        peer.on('open', id => {
                            // Make a call to the host's peer with the given roomId
                            const call = peer.call(roomId, localStream);  // Call the host with local stream
                            call.on('stream', stream => {
                                remoteVideo.srcObject = stream;  // Display the host's stream
                            });

                            // Store the current call for later use
                            currentCall = call;
                        });

                        // Handle errors
                        peer.on('error', err => {
                            errorDisplay.textContent = 'Error: ' + err.message;
                        });
                    });
                } else {
                    errorDisplay.textContent = 'Please enter a room code.';
            }
        });

        // Copy room code to clipboard
        function copyToClipboard(code) {
            navigator.clipboard.writeText(code).then(() => {
                alert("Room code copied to clipboard!");
            }).catch(err => {
                alert("Failed to copy code: " + err);
            });
        }

        // Share room code via Web Share API
        function shareRoomCode(code) {
            if (navigator.share) {
                navigator.share({
                    title: 'Hi buddy, join my video call using this room code',
                    text: `Here's the room code: ${code}`,
                    url: window.location.href
                }).then(() => {
                    console.log('Shared successfully');
                }).catch(err => {
                    alert("Failed to share code: " + err);
                });
            } else {
                alert('Sharing is not supported on your device.');
            }
        }

        // UPdate                                                 Update for chat
        // When user creates a room (Host)
       
        // When user joins a room (Joiner)
        joinRoomBtn.addEventListener('click', () => {
            const roomId = roomCodeInput.value;
            if (roomId) {
                getLocalStream().then(() => {
                    peer = new Peer();

                    peer.on('open', () => {
                        // Establish video connection
                        call = peer.call(roomId, localStream);
                        call.on('stream', stream => {
                            remoteVideo.srcObject = stream;
                        });

                        // Establish data connection (for chat)
                        dataConnection = peer.connect(roomId);

                        // Ensure the data connection is open before handling messages
                        dataConnection.on('open', () => {
                            dataConnection.on('data', (message) => {
                                appendMessage(message, false); // Display remote message
                            });
                        });

                        // Handle incoming connection requests for data (if another joiner sends a message)
                        peer.on('connection', (conn) => {
                            dataConnection = conn;

                            // Ensure the connection is open before handling messages
                            dataConnection.on('open', () => {
                                dataConnection.on('data', (message) => {
                                    appendMessage(message, false); // Display remote message
                                });
                            });
                        });
                    });
                });
            } else {
                errorDisplay.textContent = 'Please enter a room code.';
            }
        });

        document.getElementById('imageBtn').onclick = function() {
            window.location.href = 'https://www.youtube.com/@swadesidev?sub_confirmation=1','_blank';
        };