const socket = io();
const welcome = document.getElementById("welcome");
const form = welcome.querySelector("form");
const room = document.getElementById("room");
const myFace = document.getElementById("myFace");
const muteBtn = document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
const camerasSelect = document.getElementById("cameras");
let myStream;
let roomName;
let myPeerConnection;
let muted = false;
let cameraOff = false;

room.hidden = true;
muteBtn.hidden = true;
cameraBtn.hidden = true;


async function getCameras(){
    try{
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter((device) => device.kind === "videoinput");
        const currentCamera = myStream.getVideoTracks()[0];
        cameras.forEach((camera) => {
            const option = document.createElement("option");
            option.value = camera.deviceId;
            option.innerText = camera.label;
            if(currentCamera === camera.label){
                option.selected = true;
            }
            camerasSelect.appendChild(option);
        })
    }catch(e){
        console.log(e);
    }
}

async function getMedia(deviceId) {
    const initalConstraints ={
        audio : true,
        video : {facingMode : "user"},
    };
    const cameraConstraints = {
        audio : true,
        video : { deviceId : {exact : deviceId} },
    };
    try {
      myStream = await navigator.mediaDevices.getUserMedia(
        deviceId ? cameraConstraints : initalConstraints
      );
      myFace.srcObject = myStream;
      if(!deviceId){
        await getCameras();
      }      
    } catch (e) {
      console.log(e);
    }
  }  

  function handleMuteClick() {
    myStream.getAudioTracks().forEach((track) => (track.enabled = !track.enabled));
    if (!muted) {
      muteBtn.innerText = "Unmute";
      muted = true;
    } else {
      muteBtn.innerText = "Mute";
      muted = false;
    }
  }

  function handleCameraClick() {
    myStream.getVideoTracks().forEach((track) => (track.enabled = !track.enabled));
    if (cameraOff) {
      cameraBtn.innerText = "Turn Camera Off";
      cameraOff = false;
    } else {
      cameraBtn.innerText = "Turn Camera On";
      cameraOff = true;
    }
  }


//list형태로 메세지가 쌓이도록
function addMessage(message,sender){

    const ul = room.querySelector("ul"); 
    const li = document.createElement("li");
    //시간
    const time = new Date();
    const hours = time.getHours().toString().padStart(2,'0');
    const minutes = time.getMinutes().toString().padStart(2,'0');
    const timestamp = `${hours}:${minutes}`;    
    if (sender === "You") {
        li.classList.add("sent");
    } else {
        li.classList.add("received");
    }
    li.innerHTML = `<span class="message">${message}</span><span class="timestamp">${timestamp}</span>`;
    ul.appendChild(li);
}

//addMessage를 이용하여 메세지 전송
function handleMessageSubmit(event){
    event.preventDefault();
    const input = room.querySelector("#msg input");
    socket.emit("new_message",input.value, roomName, () => {
        addMessage(`You: ${input.value}`,"You");
    });
}
async function initCall(){
    welcome.hidden = true;
    muteBtn.hidden = false;
    cameraBtn.hidden = false;
    room.hidden = false;
    await getMedia();
    makeConnection();
}
//방 입장
async function showRoom(){        
    const h3 = room.querySelector("h3");
    h3.innerText = `Room ${roomName}`;
    const msgForm = room.querySelector("#msg");
    msgForm.addEventListener("submit",handleMessageSubmit);
}

//방 입장
async function handleRoomSubmit(event){
    event.preventDefault();
    const room = welcome.querySelector("#roomname");
    const nick = welcome.querySelector("#nickname");
    await initCall();
    socket.emit("enter_room",room.value,nick.value,showRoom);
    roomName = room.value;
    room.value="";
}

//닉네임과 방 이름 작성 후 접속버튼을 눌렀을 때 발생하는 이벤트리스너
form.addEventListener("submit", handleRoomSubmit);

//새로운 메시지를 작성하여 send버튼을 눌렀을 때 (new_message 이벤트 발생했을 때) addMessage함수 실행
socket.on("new_message", addMessage);

//room_change 이벤트 발생 시 roomlist가 비어있으면 비어있는 값 return, 아닐 시 리스트 형태로 방 추가
socket.on("room_change", (rooms) => {
    const roomList = welcome.querySelector("ul");
    roomList.innerHTML = "";
    if(rooms.length === 0){
        roomList.innerHTML = "";
        return;
    }
    rooms.forEach(room => {
        const li = document.createElement("li");
        li.innerText = room;
        roomList.appendChild(li);
    });
});

//Offer생성 => 다른 브라우저가 참가할수 있도록 하는 초대장 역할(누구이며 어디에 있는지)
async function CreateOffer(){
    const offer = await myPeerConnection.createOffer();
    myPeerConnection.setLocalDescription(offer);
    console.log(offer);
    socket.emit("offer", offer, roomName);
}
socket.on("offer", async (offer) => {
    console.log("receive offer");
    myPeerConnection.setRemoteDescription(offer);
    const answer = await myPeerConnection.createAnswer();
    console.log(answer);
    myPeerConnection.setLocalDescription(answer);
    socket.emit("answer",answer,roomName);
    console.log("sent answer");
})
socket.on("answer",(answer) => {
    myPeerConnection.setRemoteDescription(answer);
    console.log("receive answer");
})
//입장
socket.on("welcome", (user, newCount) => {
    CreateOffer();
    console.log("sent offer");
    const h3 = room.querySelector("h3");    
    h3.innerText = `Room ${roomName} (${newCount})`;
    addMessage(`${user} joined!`);
});

//퇴장
socket.on("bye", (left, newCount) => {
    const h3 = room.querySelector("h3");
    h3.innerText = `Room ${roomName} (${newCount})`;
    addMessage(`${left} left ㅠㅠ`);
});

function makeConnection(){
    myPeerConnection = new RTCPeerConnection();
    myPeerConnection.addEventListener("icecandidate",handleIce);
    myPeerConnection.addEventListener("addstream",handleAddstream);
    myStream.getTracks().forEach((track) => myPeerConnection.addTrack(track,myStream));
}
socket.on("ice",(ice,roomName) => {
    console.log("Received candi");
    myPeerConnection.addIceCandidate(ice);
});
function handleIce(data){
    socket.emit("ice", data.candidate,roomName);
    console.log("sent candi");
}
function handleAddstream(data){
    const peerStream = document.getElementById("peerFace");
    peerStream.srcObject = data.stream;
}

async function handleCameraChange(){
    await getMedia(camerasSelect.value);
    if(myPeerConnection){
        const videoTrack = myStream.getVideoTracks()[0];
        const videoSender = myPeerConnection.getSenders().find((sender) => sender.track.kind === "video");
        videoSender.replaceTrack(videoTrack);
    }
}

muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click", handleCameraClick);
camerasSelect.addEventListener("input",handleCameraChange);