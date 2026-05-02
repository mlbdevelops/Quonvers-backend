import { Server } from "socket.io";
import VerifToken from "../security/VerifToken.js";
import { redis } from "../../db/redis/db.js";

export default function RegisterSocket(server) {
  const io = new Server(server, {
    cors: { origin: "*" }
  });

  io.on("connection", (socket) => {
    // AUTH / CONNECTION
    socket.on("new_connection", async (token) => {
      try {
        const userId = await VerifToken(token);
        if (!userId) return;
        socket.userId = userId;
        socket.join(userId);
        
        // mark online
        await redis.set(`online:${userId}`, "1");
        console.log(`✅ ${userId} connected`);
        
        // DELIVER OFFLINE MESSAGES
        let msg;
        while ((msg = await redis.lpop(`undelivered_msg:${userId}`))) {
          const parsed = JSON.parse(msg);
          console.log(msg);
          // send message
          io.to(userId).emit("message:receive", parsed);
          // notify sender (delivered)
          const isOnline = await redis.get(`online:${parsed.sender_id}`);
          
          if (isOnline) {
            io.to(parsed.sender_id).emit("message:status", {
              msg_id: parsed.id,
              status: "Delivered",
              at: Date.now()
            });
          }else{
            await redis.rpush(
              `pending_msg_status:${parsed.sender_id}`,
              JSON.stringify({
                toUser: parsed.sender_id,
                msg_id: parsed.id,
                at: Date.now(),
                status: 'Delivered'
              })
            );
          }
        }
        
        let status;
        while ((status = await redis.lpop(`pending_msg_status:${userId}`))) {
          const { msg_id, toUser, at, status: state } = JSON.parse(status);
          console.log(status);
          
          //Chech if is online 
          const isOnline = await redis.get(`online:${toUser}`);
          if (isOnline) {
            //Emit to user
            return io.to(toUser).emit("message:status", {
              msg_id,
              status: state,
              at
            });
          }
          //Cache the status when offline
          await redis.rpush(
            `pending_msg_status:${toUser}`,
            JSON.stringify({
              toUser,
              msg_id,
              at,
              status: state
            })
          );
        }
      } catch (err) {
        console.error("❌ auth error:", err);
      }
    });
    
    // SEND MESSAGE
    socket.on("message:send", async (msg, ack) => {
      try {
        if (!socket.userId) {
          return typeof ack === 'function' && ack({ ok: false });
        }
        
        // basic validation
        if (!msg?.id || !msg?.toUser) {
          return typeof ack === 'function' && ack({ ok: false });
        }
        
        // ALWAYS ACK (sent)
        typeof ack === 'function' && ack({ ok: true, at: Date.now(), msg: msg.id });
        
        const isOnline = await redis.get(`online:${msg.toUser}`);
        
        if (isOnline) {
          console.log(msg);
          io.to(msg.toUser).emit("message:receive", msg);
        } else {
          console.log(msg);
          await redis.rpush(
            `undelivered_msg:${msg.toUser}`,
            JSON.stringify(msg)
          );
          console.log(`📥 queued for ${msg.toUser}`);
        }
      } catch (err) {
        console.error("❌ send error:", err);
        typeof ack === 'function' && ack({ ok: false });
      }
    });
    
    // DELIVERED
    socket.on("message:delivered", async ({ msg_id, toUser, at, status }) => {
      try {
        if (!msg_id || !toUser) return;
        console.log('Delivery =>> ', toUser, at, status, msg_id);
        const isOnline = await redis.get(`online:${toUser}`);
        if (isOnline) {
          return io.to(toUser).emit("message:status", {
            msg_id,
            status,
            at
          });
        }
        await redis.rpush(
          `pending_msg_status:${toUser}`,
          JSON.stringify({
            toUser,
            msg_id,
            at,
            status
          })
        );
      } catch (err) {
        console.error("❌ delivered error:", err);
      }
    });
    
    // READ
    socket.on("message:read", async ({ messageId, toUser }) => {
      try {
        if (!messageId || !toUser) return;
        
        io.to(toUser).emit("message:status", {
          messageId,
          status: "read",
          at: Date.now()
        });
      } catch (err) {
        console.error("❌ read error:", err);
      }
    });
    
    // ISCONNECT
    socket.on("disconnect", async () => {
      if (!socket.userId) return;
      
      console.log(`❌ ${socket.userId} disconnected`);
      
      // delay avoids flicker on reconnect
      setTimeout(async () => {
        try {
          const sockets = await io.in(socket.userId).fetchSockets();
          
          if (sockets.length === 0) {
            await redis.del(`online:${socket.userId}`);
            console.log(`🔴 ${socket.userId} offline`);
          }
        } catch (err) {
          console.error("❌ disconnect cleanup error:", err);
        }
      }, 1000);
    });
    
  });
}