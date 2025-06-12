// app.js

// ──────────────────────────────────────────────────────────────
// ১) Firebase Initialization & Database Reference
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const firebaseConfig = {
  apiKey: "AIzaSyB5tGapvf0uQVQpnLopJBMJEMS8jxyONLo",
  authDomain: "any-dex-73a23.firebaseapp.com",
  databaseURL: "https://any-dex-73a23-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "any-dex-73a23",
  storageBucket: "any-dex-73a23.appspot.com",
  messagingSenderId: "464980822152",
  appId: "1:464980822152:web:4a97da8d8c84a88947b73d",
  measurementId: "G-LQKM57CCN8"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ──────────────────────────────────────────────────────────────
// ২) Global Variables & WebRTC Setup
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
let currentUser = {};
let chatId = '';

let localStream, peerConnection;
const servers = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// “📞” Audio Call Trigger
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('start-audio-call').onclick = () => {
    if (!chatId) {
      alert("প্রথমে বন্ধুর সাথে চ্যাট খুলুন");
      return;
    }
    const userId = currentUser.phone;
    const peerId = chatId.split('_').find(p => p !== userId);
    setupCall(userId, peerId);};
    document.getElementById('photoInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const storageRef = firebase.storage().ref();
  const imageRef = storageRef.child(`images/${Date.now()}_${file.name}`);
  await imageRef.put(file);

  const imageUrl = await imageRef.getDownloadURL();

  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  db.ref("chats/" + chatId).push({
    text: `<img src="${imageUrl}" style="max-width:200px; border-radius:8px;" />`,
    time: timestamp,
    sender: currentUser.name,
    isImage: true
  });
});
});
// ──────────────────────────────────────────────────────────────
// ৩) On Load: Restore Login & Start Presence Tracking
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
window.onload = function () {
  const savedUser = localStorage.getItem("user");
  if (savedUser) {
    currentUser = JSON.parse(savedUser);

    // Presence tracking
    const myStatusRef  = db.ref('status/' + currentUser.phone);
    const connectedRef = db.ref('.info/connected');
    connectedRef.on('value', snap => {
      if (snap.val() === true) {
        myStatusRef.set({ online: true });
        myStatusRef.onDisconnect().set({ online: false });
      }
    });

    document.getElementById('loginPage').classList.remove('active');
    document.getElementById('chatPage').classList.add('active');
    loadFriendList();
  }
};

// ──────────────────────────────────────────────────────────────
// ৪) startApp: Login & Save to LocalStorage
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function startApp() {
  const name  = document.getElementById('nameInput').value.trim();
  const phone = document.getElementById('phoneInput').value.trim();
  if (!name || !phone) return alert("সব তথ্য দিন");

  currentUser = { name, phone };
  localStorage.setItem("user", JSON.stringify(currentUser));
  document.getElementById('loginPage').classList.remove('active');
  document.getElementById('chatPage').classList.add('active');
  loadFriendList();
}

// ──────────────────────────────────────────────────────────────
// ৫) toggleFriendForm
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function toggleFriendForm() {
  const form = document.getElementById('friendForm');
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

// ──────────────────────────────────────────────────────────────
// ৬) connectFriend
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function connectFriend() {
  const friendName  = document.getElementById('friendName').value.trim();
  const friendPhone = document.getElementById('friendPhone').value.trim();
  if (!friendName || !friendPhone) return alert("ফর্ম পূরণ করুন");

  chatId = [currentUser.phone, friendPhone].sort().join('_');
  db.ref('connections/' + currentUser.phone + '/' + friendPhone).set({ name: friendName });

  document.getElementById('friendForm').style.display = 'none';
  document.getElementById('friendName').value  = '';
  document.getElementById('friendPhone').value = '';

  loadChat();
  loadFriendList();
}

// ──────────────────────────────────────────────────────────────
// ৭) loadFriendList with Status Dots
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function loadFriendList() {
  const friendListDiv = document.getElementById("friendList");
  friendListDiv.innerHTML = "<strong>তোমার বন্ধুরা:</strong><br>";

  db.ref('connections/' + currentUser.phone).once('value', snapshot => {
    snapshot.forEach(child => {
      const friendPhone = child.key;
      const friendName  = child.val().name;

      const div = document.createElement("div");
      div.className = "friend-entry";
      div.innerHTML = `${friendName} (${friendPhone})`;

      const dot = document.createElement("span");
      dot.className = "status-dot";
      div.appendChild(dot);

      db.ref('status/' + friendPhone).on('value', statusSnap => {
        const isOnline = statusSnap.val()?.online === true;
        dot.classList.toggle('online', isOnline);
      });

      div.onclick = () => {
        chatId = [currentUser.phone, friendPhone].sort().join('_');
        loadChat();
      };

      friendListDiv.appendChild(div);
    });

    if (!snapshot.exists()) {
      friendListDiv.innerHTML += "কোন বন্ধু নেই।";
    }
  });
}

// ──────────────────────────────────────────────────────────────
// ৮) showChatArea & hideChatArea
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function showChatArea() {
  document.querySelector("footer").style.display     = "flex";
  document.getElementById("backBtn").style.display  = "inline";
  document.getElementById("messages").style.display = "block";
}
function hideChatArea() {
  document.querySelector("footer").style.display      = "none";
  document.getElementById("backBtn").style.display    = "none";
  document.getElementById("messages").style.display   = "none";
  document.getElementById("friendList").style.display = "block";
}

// ──────────────────────────────────────────────────────────────
// ৯) loadChat
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function loadChat() {
  showChatArea();
  document.getElementById('friendList').style.display = 'none';
  const messagesDiv = document.getElementById("messages");
  messagesDiv.innerHTML = '';

  db.ref("chats/" + chatId).off();
  db.ref("chats/" + chatId).on("child_added", snapshot => {
    const data = snapshot.val();
    const div = document.createElement("div");
    div.className = "message";
    div.innerHTML = `${data.sender}: ${data.text}<div class="timestamp">${data.time}</div>`;

    div.oncontextmenu = e => {
      e.preventDefault();
      openDeleteModal(div, snapshot);
    };

    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
}

// ──────────────────────────────────────────────────────────────
// 🔟 sendMessage
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function sendMessage(text = null) {
  if (!chatId) return alert("প্রথমে ফ্রেন্ড কানেক্ট করুন");
  const input   = document.getElementById("textInput");
  const message = text || input.value.trim();
  if (!message) return;
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  db.ref("chats/" + chatId).push({
    text: message,
    time: timestamp,
    sender: currentUser.name
  });
  input.value = "";
}

// ──────────────────────────────────────────────────────────────
// ⓫ startVoiceInput
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function startVoiceInput() {
  const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  recognition.lang = 'bn-BD';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.start();

  recognition.onresult = event => sendMessage(event.results[0][0].transcript);
  recognition.onerror  = event => alert('Voice input failed: ' + event.error);
}

// ──────────────────────────────────────────────────────────────
// ⓬ Delete Modal
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
let messageToDelete = null;
let deleteSnapshot  = null;
function openDeleteModal(div, snapshot) {
  messageToDelete = div;
  deleteSnapshot  = snapshot;
  document.getElementById('deleteModal').style.display = 'block';
}
function closeModal() {
  document.getElementById('deleteModal').style.display = 'none';
  messageToDelete = null;
  deleteSnapshot  = null;
}
function confirmDelete(option) {
  if (option === 'everyone' && deleteSnapshot) {
    deleteSnapshot.ref.remove().then(() => {
      // ✅ UI থেকেও সরাও
      if (messageToDelete) messageToDelete.remove();
    });
  } else if (option === 'me' && messageToDelete) {
    messageToDelete.remove();
  }
  closeModal();
}

// ──────────────────────────────────────────────────────────────
// ⓭ Audio-Call / WebRTC Functions
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function setupCall(userId, peerId) {
  // hide chat UI, show caller UI
  document.getElementById('caller-ui').style.display = 'flex';
  document.getElementById('friend-name').textContent = peerId;

  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  peerConnection = new RTCPeerConnection(servers);
  const callerCandidatesRef = db.ref('calls/' + userId + '/callerCandidates');
  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      callerCandidatesRef.push(event.candidate.toJSON());
    }
  };

  // 🔹 **দূরবর্তী ICE candidate গ্রহণ**  
  const calleeCandidatesRef = db.ref('calls/' + userId + '/calleeCandidates');
  calleeCandidatesRef.on('child_added', snap => {
    const candidate = new RTCIceCandidate(snap.val());
    peerConnection.addIceCandidate(candidate);
  });
  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
  peerConnection.ontrack = e => document.getElementById('remoteAudio').srcObject = e.streams[0];

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  await db.ref('calls/' + userId).set({
    offer: offer.toJSON(),
    status: 'calling',
    to: peerId,
    from: userId
  });

  db.ref('calls/' + userId).on('value', async snap => {
    const data = snap.val();
    if (!data) return;
    if (data.status === 'rejected') return hangUp();
    if (data.answer && !peerConnection.currentRemoteDescription) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
      startInCall(userId, peerId);
    }
  });

  listenIncoming(peerId);
}

function listenIncoming(userId) {
  db.ref('calls/' + userId).on('value', snap => {
    const data = snap.val();
    if (!data || data.status !== 'calling') return;
    document.getElementById('receiver-ui').style.display = 'flex';
    document.getElementById('caller-name').textContent = data.from;
    document.getElementById('answer-call').onclick = () => answerCall(data.from, userId);
    document.getElementById('reject-call').onclick = () => rejectCall(userId);
  });
}

async function answerCall(callerId, userId) {
  document.getElementById('receiver-ui').style.display = 'none';
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  peerConnection = new RTCPeerConnection(servers);
  // (১) নিজের ICE candidate পাঠানো → এখানে path হবে caller এর কল-এর “calleeCandidates”
  const calleeCandidatesRef = db.ref('calls/' + callerId + '/calleeCandidates');
  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      calleeCandidatesRef.push(event.candidate.toJSON());
    }
  };

  // (২) caller এর পাঠানো ICE candidate শোনা → path হবে callerCandidates
  const callerCandidatesRef = db.ref('calls/' + callerId + '/callerCandidates');
  callerCandidatesRef.on('child_added', snap => {
    const candidate = new RTCIceCandidate(snap.val());
    peerConnection.addIceCandidate(candidate);
  });
  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
  peerConnection.ontrack = e => document.getElementById('remoteAudio').srcObject = e.streams[0];

  const snap = await db.ref('calls/' + callerId).once('value');
  const { offer } = snap.val();
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  await db.ref('calls/' + callerId + '/answer').set(answer.toJSON());
  await db.ref('calls/' + callerId).update({ status: 'picked' });

  startInCall(userId, callerId);
}

function startInCall(selfId, peerId) {
  document.getElementById('caller-ui').style.display   = 'none';
  document.getElementById('receiver-ui').style.display = 'none';
  document.getElementById('in-call-ui').style.display  = 'flex';
  document.getElementById('peer-name').textContent     = peerId;
  document.getElementById('hangup-call').onclick       = hangUp;
  document.getElementById('hangup-incall').onclick     = hangUp;
  document.getElementById('toggle-speaker').onclick    = toggleSpeaker;
}

function hangUp() {
  console.log("Hang up clicked");

  // ১) পিয়ার কানেকশন ছাড়াও লোকাল স্ট্রিম বন্ধ করা
  if (peerConnection) {
    peerConnection.getSenders().forEach(sender => {
      if (sender.track) sender.track.stop();
    });
    peerConnection.close();
  }
  // ✅ UI গুলো সাথে সাথেই hide করে ফেলি
  document.getElementById('in-call-ui').style.display = 'none';
  document.getElementById('caller-ui').style.display = 'none';
  document.getElementById('receiver-ui').style.display = 'none';
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
  }

  // ২) অডিও এলিমেন্ট রিসেট
  const audioEl = document.getElementById('remoteAudio');
  if (audioEl) audioEl.srcObject = null;

  // ৩) UI রিসেট
  resetCallUI();

  // ৪) ডাটাবেস থেকে কল রেকর্ড মুছে ফেলা
  const callRef = db.ref('calls/' + currentUser.phone);
  callRef.remove();
  // event listener বন্ধ করা
  db.ref('calls/').off();
}

function toggleSpeaker() {
  const audio = document.getElementById('remoteAudio');
  audio.muted = !audio.muted;
  audio.volume = audio.muted ? 0.5 : 1.0;
}

function resetCallUI() {
  document.getElementById('caller-ui').style.display   = 'none';
  document.getElementById('receiver-ui').style.display = 'none';
  document.getElementById('in-call-ui').style.display  = 'none';
  document.getElementById('chatPage').classList.add('active');
}
// … তোমার সব ফাংশন শেষ …

  // -------------------------------
  // ইমেজ প্রিভিউ টগলিং স্ক্রিপ্ট
  // -------------------------------
  document.addEventListener('click', function (e) {
    if (e.target.tagName === 'IMG' && e.target.closest('.message')) {
      e.target.classList.toggle('preview');
    } else {
      // প্রিভিউ অবস্থার বাইরে ক্লিক করলে সব ইমেজ থেকে ক্লাস রিমুভ
      const allPreviews = document.querySelectorAll('.message img.preview');
      allPreviews.forEach(img => img.classList.remove('preview'));
    }
  });
