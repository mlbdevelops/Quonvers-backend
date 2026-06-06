import { Server } from "socket.io";
import VerifToken from "../security/VerifToken.js";
import { redis } from "../../db/redis/db.js";
import { pool } from '../../db/db.js';

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
        
        // MARK ONLINE
        await redis.set(`online:${userId}`, "1");
        console.log(`✅ ${userId} connected`);
        const isOnline = await redis.get(`online:${userId}`);
        
        // DELIVER OFFLINE MESSAGES
        let msg;
        while ((msg = await redis.lpop(`undelivered_msg:${userId}`))) {
          const parsed = JSON.parse(msg);
          console.log(msg);
          // send message
          io.to(userId).emit("message:receive", parsed);
        }
        
        let status;
        while ((status = await redis.lpop(`pending_msg_status:${userId}`))) {
          const { msg_id, toUser, at, status: state } = JSON.parse(status);
          
          console.log('Cached status found for user', userId, status);
          
          if (userId !== toUser) continue;
          
          if (isOnline) {
            io.to(userId).emit("message:status", {
              msg_id,
              status: state,
              at
            });
          } else {
            await redis.rpush(
              `pending_msg_status:${userId}`,
              JSON.stringify({
                toUser: userId,
                msg_id,
                at,
                status: state
              })
            );
          }
        }
        
        let stringCommand;
        while ((stringCommand = await redis.lpop(`pending_app_commands:${userId}`))) {
          const command = JSON.parse(stringCommand);
          console.log('💌 Cached commands found for user', command);
          if (userId !== command.toUser) continue;
          if (isOnline) {
            io.to(userId).emit("command:receive", command);
          } else {
            await redis.rpush(
              `pending_app_commands:${userId}`,
              JSON.stringify({ toUser: userId, ...command})
            );
          }
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
        
        //Check if id exists
        const getMsg = await redis.get(`undelivered_msg:${msg.id}`);
        if (getMsg) return;
        
        // basic validation
        if (!msg?.id || !msg?.toUser) {
          return typeof ack === 'function' && ack({ ok: false, code: 300 });
        }
        
        // ALWAYS ACK (sent)
        typeof ack === 'function' && ack({ ok: true, at: Date.now(), msg: msg.id });
        
        const isOnline = await redis.get(`online:${msg.toUser}`);
        console.log(msg);
        if (isOnline) {
          io.to(msg.toUser).emit("message:receive", msg);
        } else {
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
        if (!msg_id || !toUser || !status) return;
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
    socket.on("message:seen", async ({ msg_id, toUser, at, status }) => {
      try {
        if (!msg_id || !toUser || !status) return;
        const isOnline = await redis.get(`online:${toUser}`);
        if (isOnline) {
          io.to(toUser).emit("message:status", {
            msg_id,
            status,
            at
          });
        } else {
          await redis.rpush(
            `pending_msg_status:${toUser}`,
            JSON.stringify({
              toUser,
              msg_id,
              at,
              status
            })
          )
        }
      } catch (err) {
        console.error("❌ read error:", err);
      }
    });
    
    // SEND APP COMMANDS
    socket.on("command:send", async (command) => {
      try {
        if (!command?.toUser || !command?.sender_id || !command?.type) return;
        //console.log(command)
        const isOnline = await redis.get(`online:${command?.toUser}`);
        if (isOnline) {
          //console.log('✔️user online, emitting commant')
          io.to(command?.toUser).emit("command:receive", command);
        } else {
          //console.log('Caching command for', command.toUser)
          await redis.rpush(
            `pending_app_commands:${command?.toUser}`,
            JSON.stringify(command)
          )
        }
      } catch (err) {
        console.error("❌ read error:", err);
      }
    });
    
    // DISCONNECT
    socket.on("disconnect", async () => {
      if (!socket.userId) return;
      // delay avoids flicker on reconnect
      setTimeout(async () => {
        try {
          const sockets = await io.in(socket.userId).fetchSockets();
          
          if (sockets.length === 0) {
            await redis.del(`online:${socket.userId}`);
            console.log(`🔴 ${socket.userId} went offline`);
          }
        } catch (err) {
          console.error("❌ disconnect cleanup error:", err);
        }
      }, 1000);
    });
    
  });
}