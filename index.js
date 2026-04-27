import express from 'express';
import cors from 'cors';
import registerRouter from './routes/auth/email/register.js';
import loginRoute from './routes/auth/email/login.js';
import chatCreateRoute from './routes/chat/create_chat.js';
import chatReqRoute from './routes/user/chat_request.js';
import get_chat_list from './routes/chat/get_chat.js';
//import loginRouter from './routes/auth/login.js';
import LikeRoute from './routes/post/reactions/like.js';
import notificationsRoutes from './routes/notification.js'
import getPostsRoute from './routes/post/get/post.js';
import CreatePostRoute from './routes/post/create/post.js';
import searchRoute from './routes/search.js';
import RegisterSocket from './sockets/chat/entry.js';
import { pool } from './db/db.js'
import dotenv from 'dotenv';
import http from 'http';

const app = express();
const PORT = process.env.PORT || 4000;
const server = http.createServer(app);

dotenv.config();

app.use(express.json());
app.use(cors());
app.use(registerRouter);
app.use(getPostsRoute);
app.use(loginRoute);
app.use(get_chat_list);
app.use(searchRoute);
app.use(chatReqRoute);
app.use(chatCreateRoute);
app.use(notificationsRoutes);
app.use(CreatePostRoute);
app.use(LikeRoute);

RegisterSocket(server);

(async () => {
  const now = await pool.query(`
    SELECT COUNT(*) FROM users
  `)
  console.log(now.rows[0]);
})()

app.use((err, res, req) => {
  res.send({msg: 'Unavailable or blocked route.'});
});

server.listen(PORT, () => {
  console.log(`server listening at port ${PORT}`);
});