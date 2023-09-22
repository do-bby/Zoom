import http from "http";
import SocektIO from "socket.io";
import express from "express";

const app = express();
app.set("view engine", "pug");
app.set("views", __dirname + "/views");
app.use("/public", express.static(__dirname + "/public"));
app.get("/", (req,res) => res.render("home"));
app.get("/*", (req,res) => res.redirect("/"));

const server = http.createServer(app);
const io = SocektIO(server);

function publicRooms(){
    const sids = io.sockets.adapter.sids;
    const rooms = io.sockets.adapter.rooms;

    const publicRooms = [];
    rooms.forEach((_,key) => {
        if(sids.get(key) === undefined){
            publicRooms.push(key);
        }
    });
    return publicRooms;
}
//현재 열려있는 방의 개수
function countRoom(roomName){
    return io.sockets.adapter.rooms.get(roomName).size;
}

io.on("connection", (socket) => {        
    socket.onAny((event) => {
        console.log(`Socket Event: ${event}`);
    })
    //방 접속 시 
    socket.on("enter_room",(roomName,nick,done) => {
        if(nick === ""){
            socket["nickname"] = "Anonymous";
        } else {
            socket["nickname"] = nick;
        }        
        socket.join(roomName);
        done();
        //join => room 입장
        //console.log(socket.rooms);
        //socket.rooms => room들의 정보들
        //본인 browser를 제외하고 방에 접속된 다른 유저들에게만 보이는 welcome메시지
        socket.to(roomName).emit("welcome", socket.nickname, countRoom(roomName));        
        io.sockets.emit("room_change", publicRooms());
    });
    socket.on("offer", (offer,roomName) => {
        socket.to(roomName).emit("offer",offer);
    });
    socket.on("answer",(answer,roomName) => {
        socket.to(roomName).emit("answer",answer);
    });
    socket.on("ice",(ice,roomName) => {
        socket.to(roomName).emit("ice",ice);
    });
    //client 즉 browser 닫을 때 열려있는 방들 중 삭제
    socket.on("disconnecting", () => {
        socket.rooms.forEach((room) => 
            socket.to(room).emit("bye",socket.nickname,countRoom(room)-1)
        );    
    })

    //client 즉 browser 새로고침 시 열려있는 방들 중 삭제
    socket.on("disconnect", () => {
        io.sockets.emit("room_change", publicRooms());
    })

    //새로운 메시지 보낼 때 닉네임 : 메시지 형식
    socket.on("new_message", (msg, room, done) => {
        socket.to(room).emit("new_message",`${socket.nickname}: ${msg}`);
        done();
    })    
})



//socket.io는 admin ui도 지원
// const sockets = [];
// wss.on("connection",(socket) => {
//     sockets.push(socket);
//     socket["nickname"] = "Anon";
//     console.log("Connected to Browser");
//     socket.on("close", () => {console.log("DisConnected from Browser")});
//     socket.on("message", (msg) => {
//         const message = JSON.parse(msg);
//         switch(message.type){
//             case "new_message":
//                 sockets.forEach((aSocket) => aSocket.send(`${socket.nickname} : ${message.payload}`));
//             case "nickname":
//                 socket["nickname"] = message.payload.toString('utf-8');
//         }       
//     });
// });

const handleListen = () => console.log(`Listening on http://localhost:3000`);
server.listen(3000,handleListen);

