const crypto = require("crypto");
var jwt = require("jwt-simple");
var secret = process.env.SECRET;



const initRoutes = (router, mongoose) => {

  const userSchema = new mongoose.Schema(
    {
      displayName: {
        type: String,
        required: "Укажите имя",
        unique: "Такой login уже существует"
      },
      email: {
        type: String,
        required: "Укажите e-mail",
        unique: "Такой e-mail уже существует"
      },
      passwordHash: String,
      salt: String
    },
    {
      timestamps: true
    }
  );
  
  userSchema
    .virtual("password")
    .set(function(password) {
      this._plainPassword = password;
      if (password) {
        this.salt = crypto.randomBytes(128).toString("base64");
        this.passwordHash = crypto.pbkdf2Sync(
          password,
          this.salt,
          1,
          128,
          "sha1"
        );
      } else {
        this.salt = undefined;
        this.passwordHash = undefined;
      }
    })
  
    .get(function() {
      return this._plainPassword;
    });
  
  userSchema.methods.checkPassword = function(password) {
    if (!password) return false;
    if (!this.passwordHash) return false;
    return (
      crypto.pbkdf2Sync(password, this.salt, 1, 128, "sha1") == this.passwordHash
    );
  };
  
  const User = mongoose.model("User", userSchema);
  
  
  const loginSchema = new mongoose.Schema({
    id: String,
    token: String,
    expiration: Date
  });
  
  const Login = mongoose.model("Login", loginSchema);


  router.get("/test", async (ctx, next) => {
    try {
      ctx.body = "Absolutno randomnaya stroka";
    } catch (error) {
      ctx.status = 400;
      ctx.body = error;
    }
  });

  router.delete("/users", async (ctx, next) => {
    try {
      const user = await Login.find({ id: ctx.request.body.id });
      ctx.body = ctx.request.body.id;
      if (!!user.length) {
        await Login.remove({ id: ctx.request.body.id });
        ctx.cookies.set("auth", "", { httpOnly: false });
      }
    } catch (error) {
      ctx.status = 400;
      ctx.body = error;
    }
  });

  router.post("/users", async (ctx, next) => {
    try {
      ctx.body = await User.create(ctx.request.body);
    } catch (err) {
      ctx.status = 400;
      ctx.body = err;
    }
  });

  router.get("/login", async (ctx, next) => {
    try {
      const userData = jwt.decode(ctx.cookies.get("auth"), secret);

      const logined = await Login.find({ id: userData.id });
      if (logined[0].expiration - Date.now()) {
        ctx.body = userData;
      } else {
        throw new Error('Not Logged');
      }
    } catch (err) {
      ctx.status = 400;
      ctx.body = err;
    }
  });

  router.post("/login", async (ctx, next) => {
    try {
      const userData = await User.find({ email: ctx.request.body.email });
      const password = ctx.request.body.password;
      const logined = await Login.find({ id: userData[0]._id });
      if (userData.length) {
        if (
          crypto.pbkdf2Sync(password, userData[0].salt, 1, 128, "sha1") ==
          userData[0].passwordHash
        ) {
          if (logined.length) {
            debugger;
            const findLogin = Login.find({ id: userData[0]._id });
            console.log("login: ", logined[0].id);
            console.log(" user: ", userData[0]._id);
            if (logined[0].expiration - Date.now()) {
              await Login.update(
                { id: userData[0]._id },
                { $set: { expiration: 3600000 + Date.now() } }
              );
              ctx.cookies.set("auth", logined[0].token, {
                httpOnly: false,
                expires: new Date(Date.now() + 3600000)
              });
              ctx.body = jwt.decode(logined[0].token, secret);
            } else {
              throw new Error("Need authorisation");
            }
          } else {
            var payload = {
              id: userData[0]._id,
              displayName: userData[0].displayName,
              email: userData[0].email,
              authTime: Date.now()
            };
            var token = jwt.encode(payload, secret);

            await Login.create({
              id: userData[0]._id,
              token: token,
              expiration: 3600000 + Date.now()
            });
            ctx.cookies.set("auth", token, {
              httpOnly: false,
              expires: new Date(Date.now() + 3600000)
            });
            console.log("Cookies:", ctx.cookies.get("auth"));
            ctx.body = jwt.decode(token, secret);
          }
        } else {
          throw new Error("Неверный логин или пароль");
        }
      } else {
        throw new Error("Неверный логин или пароль");
      }
    } catch (err) {
      ctx.status = 400;
      ctx.body = err.message;
    }
  });
};

module.exports = initRoutes;
