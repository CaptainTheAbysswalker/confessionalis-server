const Koa = require("koa");
const socketIO = require("socket.io");
const passport = require("koa-passport"); //реализация passport для Koa

const mongoose = require("mongoose");
mongoose.set("debug", true);
mongoose.connect(
  `mongodb://${process.env.DBLOGIN}:${process.env.DBPASSWORD}@ds042459.mlab.com:42459/chat-test`,
  { useNewUrlParser: true }
);
mongoose.set("useCreateIndex", true);

const onlineUsersSchema = new mongoose.Schema({
  displayName: String,
  id: {
    type: String,
    unique: "Такой id уже существует"
  }
});


const onlineUsers = mongoose.model("onlineUsers", onlineUsersSchema);

const Router = require("koa-router");
const bodyparser = require("koa-bodyparser");
const cors = require("@koa/cors");
const initRoutes = require("./routes");

const app = new Koa();
const router = new Router();

app.use(cors({ credentials: true }));

app.use(bodyparser());

initRoutes(router, mongoose);

app.use(passport.initialize());

app.use(router.routes());

const server = app.listen(3004);

findUsers = async () => {
  const onlineNow = await onlineUsers.find({});
  return onlineNow;
};

addUser = async data => {
  const online = await onlineUsers.find({ id: data.id });
  if (!online.length && data.id) {
    await onlineUsers.create(data);
  }
};

removeUser = async id => {
  await onlineUsers.remove({ id: id });
};

let io = socketIO(server);
io.on("connection",  socket => {
  socket.on("connectUser", async (data) => {
    await addUser(data);
    const users = await findUsers();
    console.log('Users', users);
    io.sockets.emit("onlineUser", {
      onlineUsers: users
    });
  });

  console.log("New user connected");
  socket.on("newMessage", data => {
    io.sockets.emit("newMessage", {
      time: data.time,
      user: data.user,
      message: data.message
    });
    console.log(data);
  });
  socket.on("disconnection", (data) => {removeUser(data.id)});
  socket.on("disconnect", () => {console.log('User disconnected')});
});
