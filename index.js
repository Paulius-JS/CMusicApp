// Projekte naudojami moduliai: express, MySQL2, nodemon, express-handlebars
import express from "express";
import { engine } from "express-handlebars";
import mysql from "mysql2/promise";
import multer from "multer";
import session from "express-session";
import auth from "./middleware/auth.js";
import path from "path";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "nuotarkos");
  },
  filename: function (req, file, cb) {
    const ext = file.originalname.split(".");

    const uniqueSuffix =
      Date.now() +
      "-" +
      Math.round(Math.random() * 1e9) +
      "." +
      ext[ext.length - 1];
    cb(null, uniqueSuffix);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, next) {
    if (
      file.mimetype === "image/jpeg" ||
      file.mimetype === "image/png" ||
      file.mimetype === "image/gif"
    )
      next(null, true);
    else {
      next(null, false);
    }
  },
});

const app = express();

app.engine("handlebars", engine());
app.set("view engine", "handlebars");
app.set("views", "./views");
app.use(express.urlencoded({ extended: true }));
app.use(express.static("views"));
app.use("/nuotarkos", express.static("nuotarkos"));

app.use(
  session({
    secret: "labai slapta fraze",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 600000 },
  })
);

const database = await mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "testineduombaze",
});

// ALL SONGS

app.get("/allSongs", async (req, res) => {
  const sql = "SELECT * FROM songs";
  const [results] = await database.execute(sql);
  res.render("allSongs", { songs: results });
});

//LOGIN
app.get("/", async (req, res) => {
  res.render("index");
});

app.post("/", async (req, res) => {
  const { email, password } = req.body;
  const sql = "SELECT * FROM users WHERE email = ? AND password = ?";
  const [results] = await database.execute(sql, [email, password]);
  if (results.length > 0) {
    req.session.loggedIn = true;
    req.session.user = results[0].id;

    res.redirect("/playlists");
  } else {
    res.render("index", { error: "Wrong email or password", email });
  }
}),
  // register from
  app.get("/register", (req, res) => {
    res.render("register");
  });

app.post("/register", async (req, res) => {
  const { name, last_name, email, password } = req.body;
  const usedEmail = await database.query(
    "SELECT * FROM users WHERE email = ?",
    [email]
  );

  if (name === "" || last_name === "" || email === "" || password === "") {
    return res.render("register", {
      error: "All Fields must be filled",
      name,
      last_name,
      email,
      password,
    });
  }
  if (password.length < 6) {
    return res.render("register", {
      error: "Password must be at least 6 characters long",
      name,
      last_name,
      email,
      password,
    });
  }
  if (usedEmail[0].length > 0) {
    return res.render("register", {
      error: "Email is already in use",
      name,
      last_name,
      email,
      password,
    });
  }
  try {
    await database.query(
      "INSERT INTO users (name, last_name, email, password) VALUES (?, ?, ?, ?)",
      [name, last_name, email, password]
    );

    res.redirect("/");
  } catch (error) {
    res.render("register", {
      error: "Err0R",
    });
  }
});

//songs list
app.get("/songs", auth, async (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/");
  const playlists = await database.query(
    "SELECT id, playlist_name FROM playlists WHERE user_id = ?",
    [req.session.user]
  );
  const userName = await database.query(
    `SELECT name FROM users WHERE id = ${req.session.user}`
  );
  const songs = await database.query("SELECT * FROM songs WHERE user_id = ?", [
    req.session.user,
  ]);
  const playerPlaylist = playlists[0];
  // console.log(playerPlaylist[0]);
  res.render("songs", {
    songs: songs[0],
    playerPlaylist,
    name: userName[0][0].name,
  });
}),
  //DELETE

  app.get("/delete/:id", auth, async (req, res) => {
    if (!req.session.loggedIn) return res.redirect("/");

    const id = req.params.id;
    await database.query(`DELETE FROM songs WHERE id = ${id}`);
    res.redirect("/songs");
  });

//CREATE

app.post("/songs", async (req, res) => {
  const id = req.params.id;
  const {
    song_Name,
    song_Album,
    urlyt,
    SongSelectorRegister,
    SongSelectorUpdater,
  } = req.body;

  const songs = await database.query(
    "SELECT id, urlyt,song_Name, song_Album, playlist_id FROM songs"
  );
  if (song_Name === "" || song_Album === "" || urlyt === "") {
    return res.render("songs", {
      error: "All Fields must be filled",
      songs: songs[0],
    });
  }
  // WILL BE FIXED
  // await database.query("UPDATE songs SET playlist_id = ? WHERE id = ?", [
  //   SongSelectorUpdater,
  //   id,
  // ]);
  // res.redirect("/songs");

  try {
    await database.query(
      "INSERT INTO songs (song_Name, song_Album, urlyt, user_id, playlist_id) VALUES (?, ?, ?, ?, ?)",
      [song_Name, song_Album, urlyt, req.session.user, SongSelectorRegister]
    );
    res.redirect("/songs");
  } catch (error) {
    res.render("songs", {
      error: "Err0R",
    });
  }
});

//UPDATE

app.get("/edit/:id", auth, async (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/");
  const id = req.params.id;
  const song = await database.query(
    `SELECT id, song_Name, song_Album, urlyt FROM songs WHERE id = ${id}`
  );
  const zong = song[0][0];

  res.render("./edit", zong);
});

app.post("/edit/:id", auth, async (req, res) => {
  const id = req.params.id;
  const { song_Name, song_Album, urlyt } = req.body;

  if (song_Name === "" || song_Album === "" || urlyt === "") {
    return res.render("edit", {
      error: "All Fields must be filled",
      song_Name,
      song_Album,
      urlyt,
    });
  }
  await database.query(
    "UPDATE songs SET song_Name = ?, song_Album = ?, urlyt = ? WHERE id = ?",
    [song_Name, song_Album, urlyt, id]
  );
  res.redirect("/songs", id, { song_Name, song_Album, urlyt });
});

app.get("/playlists", auth, async (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/");

  const userName = await database.query(
    `SELECT name FROM users WHERE id = ${req.session.user}`
  );
  const playlists = await database.query(
    `SELECT id, playlist_Name, image FROM playlists WHERE user_id = ?`,
    [req.session.user]
  );

  res.render("playlists", {
    playlists: playlists[0],
    name: userName[0][0].name,
  });
});

app.get("/playlists/new", auth, (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/");

  res.render("new");
});

app.post("/playlists/new", upload.single("nuotarka"), async (req, res) => {
  const name = req.body.name;
  const image = req.file.filename;
  const user_id = req.session.user;
  if (name === "") {
    return res.render("new", {
      error: "All Fields must be filled",
    });
  }

  await database.query(
    "INSERT INTO playlists (playlist_name, image, user_id) VALUES (?, ?, ?)",
    [name, image, user_id]
  );
  res.redirect("/playlists", name, image, user_id);
}),
  app.get("/editPlaylist/:id", auth, async (req, res) => {
    if (!req.session.loggedIn) return res.redirect("/");
    const id = req.params.id;
    const playlist = await database.query(
      `SELECT id, playlist_Name FROM playlists WHERE id = ${id}`
    );

    res.render("./editPlaylist", playlist[0][0]);
  }),
  app.post("/editPlaylist/:id", auth, async (req, res) => {
    const id = req.params.id;
    const { playlist_name } = req.body;
    await database.query(
      "UPDATE playlists SET playlist_name = ? WHERE id = ?",
      [playlist_name, id]
    );
    res.redirect("/playlists", playlist_name, id);
  }),
  ///PLAYLISTS DELETE
  app.get("/playlists/delete/:id", auth, async (req, res) => {
    if (!req.session.loggedIn) return res.redirect("/");
    const id = req.params.id;
    await database.query(`DELETE FROM playlists WHERE id = ${id}`);
    res.redirect("/playlists");
  });

app.listen(3000);

//////////////////////////////TODO/////////////

// On Songs add selector to add to song_Album
// conn all sql files into one
// create logout with destroy session
//////////////////////////////////////////////
