
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

let currentUser = {};
let chatId = '';

window.onload = function () {
  const savedUser = localStorage.getItem("user");
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    document.getElementById('loginPage').classList.remove('active');
    document.getElementById('chatPage').classList.add('active');
    loadFriendList();
  }
};

function startApp() {
  const name = document.getElementById('nameInput').value.trim();
  const phone = document.getElementById('phoneInput').value.trim();
  if (!name || !phone) return alert("সব তথ্য দিন");

  currentUser = { name, phone };
  localStorage.setItem("user", JSON.stringify(currentUser));
  document.getElementById('loginPage').classList.remove('active');
  document.getElementById('chatPage').classList.add('active');
  loadFriendList();
}

function toggleFriendForm() {
  const form = document.getElementById('friendForm');
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

function connectFriend() {
  const friendName = document.getElementById('friendName').value.trim();
  const friendPhone = document.getElementById('friendPhone').value.trim();
  if (!friendName || !friendPhone) return alert("ফর্ম পূরণ করুন");

  chatId = [currentUser.phone, friendPhone].sort().join('_');
  db.ref('connections/' + currentUser.phone + '/' + friendPhone).set({ name: friendName });

  document.getElementById('friendForm').style.display = 'none';
  document.getElementById('friendName').value = '';
  document.getElementById('friendPhone').value = '';

  loadChat();
  loadFriendList();
}

function loadFriendList() {
  const friendListDiv = document.getElementById("friendList");
  friendListDiv.innerHTML = "<strong>তোমার বন্ধুরা:</strong><br>";

  db.ref('connections/' + currentUser.phone).once('value', snapshot => {
    snapshot.forEach(child => {
      const friendPhone = child.key;
      const friendName = child.val().name;

      // UI এ entry তৈরি
      const div = document.createElement("div");
      div.className = "friend-entry";

      // Name + phone
      div.innerHTML = `${friendName} (${friendPhone})`;

      // Status dot
      const dot = document.createElement("span");
      dot.className = "status-dot";
      div.appendChild(dot);

      // Friend এর status path
      db.ref('status/' + friendPhone).on('value', statusSnap => {
        const isOnline = statusSnap.val()?.online;
        dot.classList.toggle('online', isOnline);
      });

      // Click করলে chat load
      div.onclick = function () {
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

function showChatArea() {
  document.querySelector("footer").style.display = "flex";
  document.getElementById("backBtn").style.display = "inline";
  document.getElementById("messages").style.display = "block";
}

function hideChatArea() {
  document.querySelector("footer").style.display = "none";
  document.getElementById("backBtn").style.display = "none";
  document.getElementById("messages").style.display = "none";
  document.getElementById("friendList").style.display = "block";
}

function loadChat() {
  showChatArea();
  document.getElementById('friendList').style.display = 'none';
  const messagesDiv = document.getElementById("messages");
  messagesDiv.innerHTML = '';

  db.ref("chats/" + chatId).off();
  db.ref("chats/" + chatId).on("child_added", function (snapshot) {
    const data = snapshot.val();
    const div = document.createElement("div");
    div.className = "message";
    div.textContent = data.sender + ': ' + data.text;
    div.innerHTML += `<div class="timestamp">${data.time}</div>`;

    div.oncontextmenu = function(e) {
      e.preventDefault();
      openDeleteModal(div, snapshot);
    };

    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
}

function sendMessage(text = null) {
  if (!chatId) return alert("প্রথমে ফ্রেন্ড কানেক্ট করুন");
  const input = document.getElementById("textInput");
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

function startVoiceInput() {
  const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  recognition.lang = 'bn-BD';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.start();

  recognition.onresult = function (event) {
    const voiceText = event.results[0][0].transcript;
    sendMessage(voiceText);
  };

  recognition.onerror = function (event) {
    alert('Voice input failed: ' + event.error);
  };
}

let messageToDelete = null;
let deleteSnapshot = null;

function openDeleteModal(div, snapshot) {
  messageToDelete = div;
  deleteSnapshot = snapshot;
  document.getElementById('deleteModal').style.display = 'block';
}

function closeModal() {
  document.getElementById('deleteModal').style.display = 'none';
  messageToDelete = null;
  deleteSnapshot = null;
}

function confirmDelete(option) {
  if (option === 'everyone' && deleteSnapshot) {
    deleteSnapshot.ref.remove();
  } else if (option === 'me' && messageToDelete) {
    messageToDelete.remove();
  }
  closeModal();
}
