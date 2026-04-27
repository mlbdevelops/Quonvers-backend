import { Server } from "socket.io";
import { pool } from '../../db/db.js';
import VerifToken from '../security/VerifToken.js';
import { redis } from '../../db/redis/db.js';

const onlineUsers = new Map();

export default function RegisterSocket(server) {
  const io = new Server(server);

  io.on("connection", (socket) => {
    
    socket.on("new_connection", async ({ token, rooms }) => {
      try {
        console.log(rooms);
        const userId = await VerifToken(token);
        if (userId) {
          socket.join(userId);
          await redis.set(userId, Date.now());
          for (let room of rooms){
            socket.join(room);
          }
        }
      } catch (err) {
        console.error('Error:', err);
      }
    });
    
    socket.on("message:send", async (data) => {
      console.log(data);
      //onlineUsers.get(data.receiver_id)? io.to(data.chat_id).emit(data) : 
      socket.to(data.chat_id).emit(data)
      await redis.rpush(`undelivered_msg:${msg.id}`, JSON.stringify(message));
    })
    
    socket.on("message:delivered", async (data) => {
      console.log(data);
      socket.to(data.chat_id).emit(data)
    })
    
    socket.on("message:seen", async (data) => {
      console.log(data);
      socket.to(data.chat_id).emit(data)
    })
    
    socket.on("disconnect", () => {
      console.log("User disconnected =>", socket.id);
      for (const [userId, id] of onlineUsers.entries()) {
        if (id === socket.id) {
          onlineUsers.delete(userId);
          break;
        }
      }
    });
  });
}
