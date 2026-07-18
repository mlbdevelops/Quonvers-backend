import { Server } from "socket.io";
import VerifToken from "../security/VerifToken.js";
import { redis } from "../../db/redis/db.js";
import { pool } from '../../db/db.js';

export default function RegisterSocket(server) {
  const io = new Server(server, {
    cors: { origin: "*" }
  });
  
  const pendingMessages = {
    get: async (user_id) => await pool.query(`
      DELETE FROM pending_messages WHERE toUser = $1 RETURNING *
    `, [user_id]),
    add: async (msg) => await pool.query(`
      INSERT INTO pending_messages(id, chat_id, sender_id, content, type, content_url, reply_to, edited, deleted, disappearing_millisecs, status, status_at, created_at, toUser, room_type)
      VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    `, [msg?.id, msg?.chat_id, msg?.sender_id, msg?.content, msg?.type, msg?.content_url, msg?.reply_to, msg?.edited, msg?.deleted,msg?.disappearing_millisecs,msg?.status, msg?.status_at, msg?.created_at, msg?.toUser, msg?.room_type
    ])
  }

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
        const pendings = await pendingMessages.get(userId)
        const rowMessages = pendings.rows
        
        /* DELIVER OFFLINE DATA */
        
        let msg;
        while ((msg = rowMessages?.shift())) {
          console.log(msg);
          // send message
          io.to(userId).emit("message:receive", msg);
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
        
        let pendingMessageCommand;
        while((pendingMessageCommand = await redis.lpop(`pending_message_update:${userId}`))){
          const jsonRecord = JSON.stringify(pendingMessageCommand)
          if(jsonRecord.toUser === userId) io.to(jsonRecord?.toUser).emit("messageCommands:receive", jsonRecord);
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
          return typeof ack === 'function' && ack({ ok: false, code: 300 });
        }
        
        // ALWAYS ACK (sent)
        typeof ack === 'function' && ack({ ok: true, at: Date.now(), msg: msg.id });
        
        const isOnline = await redis.get(`online:${msg.toUser}`);
        console.log(isOnline)
        if (isOnline) {
          io.to(msg.toUser).emit("message:receive", msg);
          console.log('Message sent', msg.id);
        } else {
          const pend = await pendingMessages.add(msg);
          console.log('Message kept for later');
          /*await redis.rpush(
            `undelivered_msg:${msg.toUser}`,
            JSON.stringify(msg)
          );*/
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
        console.error("Eror:", err);
      }
    });
    
    // SEND APP COMMANDS
    socket.on("command:send", async (command) => {
      try {
        if (!command?.toUser || !command?.sender_id || !command?.type) return;
        console.log(command)
        const isOnline = await redis.get(`online:${command?.toUser}`);
        if (isOnline) {
          io.to(command?.toUser).emit("command:receive", command);
        } else {
          await redis.rpush(
            `pending_app_commands:${command?.toUser}`,
            JSON.stringify(command)
          )
        }
      } catch (err) {
        console.error("Error:", err);
      }
    });
    
    // SEND APP COMMANDS
    socket.on("messageCommands:send", async (record) => {
      try {
        console.log(record)
        if (!record?.toUser || !record?.sender_id || !record?.message_id) return;
        const isOnline = await redis.get(`online:${record?.toUser}`);
        const checkIfExist = record.command == 'delete'
          ? await pool.query('DELETE FROM pending_messages WHERE id = $1 AND sender_id = $2 RETURNING *', [record.message_id, record.sender_id]) 
          : record.command == 'edit' ? await pool.query('UPDATE pending_messages SET content = $1, edited = $2 WHERE id = $3 AND sender_id = $4 RETURNING *', [record.content, true, record.message_id, record.sender_id]) : null
        const result = checkIfExist.rows
        console.log(result)
        if (!result.length){
          if(isOnline) io.to(record?.toUser).emit("messageCommands:receive", record);
          else{
            await redis.rpush(`pending_message_update:${record?.toUser}`, JSON.stringify(record))
          }
        }
      } catch (err) {
        console.error("Error:", err);
      }
    });
    
    // DISCONNECT
    socket.on("disconnect", async () => {
      if (!socket.userId) return;
      try {
        const sockets = await io.in(socket.userId).fetchSockets();
        if (sockets.length === 0) {
          await redis.del(`online:${socket.userId}`);
          console.log(`🔴 ${socket.userId} went offline`);
        }
      } catch (err) {
        console.error("❌ disconnect cleanup error:", err);
      }
    });
  });
}