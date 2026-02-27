import express from "express";
import { createServer as createViteServer } from "vite";
// import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// const db = new Database("readative.db");

// Initialize DB
// db.exec(`
//   CREATE TABLE IF NOT EXISTS posts (
//     id TEXT PRIMARY KEY,
//     author TEXT,
//     content TEXT,
//     type TEXT,
//     hashtags TEXT,
//     stars REAL DEFAULT 0,
//     ratingCount INTEGER DEFAULT 0,
//     createdAt INTEGER
//   );
//   CREATE TABLE IF NOT EXISTS comments (
//     id TEXT PRIMARY KEY,
//     postId TEXT,
//     author TEXT,
//     text TEXT,
//     createdAt INTEGER
//   );
//   CREATE TABLE IF NOT EXISTS user_profile (
//     id TEXT PRIMARY KEY,
//     name TEXT,
//     photo TEXT,
//     readingScore INTEGER DEFAULT 0,
//     examScore INTEGER DEFAULT 0,
//     readPosts TEXT
//   );
// `);

async function startServer() {
  const app = express();
  app.use(express.json());

  // API Routes
  app.get("/api/posts", (req, res) => {
    // const posts = db.prepare("SELECT * FROM posts ORDER BY createdAt DESC").all();
    // const postsWithDetails = posts.map((post: any) => {
    //   const comments = db.prepare("SELECT * FROM comments WHERE postId = ?").all(post.id);
    //   return {
    //     ...post,
    //     hashtags: JSON.parse(post.hashtags || "[]"),
    //     comments
    //   };
    // });
    // res.json(postsWithDetails);
    res.json([]);
  });

  app.post("/api/posts", (req, res) => {
    // const { id, author, content, type, hashtags, createdAt } = req.body;
    // db.prepare("INSERT INTO posts (id, author, content, type, hashtags, createdAt) VALUES (?, ?, ?, ?, ?, ?)")
    //   .run(id, author, content, type, JSON.stringify(hashtags), createdAt);
    res.json({ success: true });
  });

  app.post("/api/posts/:id/rate", (req, res) => {
    // const { stars } = req.body;
    // const post: any = db.prepare("SELECT * FROM posts WHERE id = ?").get(req.params.id);
    // if (post) {
    //   const newRatingCount = post.ratingCount + 1;
    //   const newStars = (post.stars * post.ratingCount + stars) / newRatingCount;
    //   db.prepare("UPDATE posts SET stars = ?, ratingCount = ? WHERE id = ?")
    //     .run(newStars, newRatingCount, req.params.id);
    //   res.json({ success: true, stars: newStars });
    // } else {
    //   res.status(404).json({ error: "Post not found" });
    // }
    res.json({ success: true, stars: 5 });
  });

  app.post("/api/posts/:id/comments", (req, res) => {
    // const { id, author, text, createdAt } = req.body;
    // db.prepare("INSERT INTO comments (id, postId, author, text, createdAt) VALUES (?, ?, ?, ?, ?)")
    //   .run(id, req.params.id, author, text, createdAt);
    res.json({ success: true });
  });

  app.get("/api/profile/:id", (req, res) => {
    // let profile: any = db.prepare("SELECT * FROM user_profile WHERE id = ?").get(req.params.id);
    // if (!profile) {
    //   // Create default profile
    //   profile = { id: req.params.id, name: "Reader", photo: "https://picsum.photos/seed/user/200", readingScore: 0, examScore: 0, readPosts: "[]", following: "[]" };
    //   db.prepare("INSERT INTO user_profile (id, name, photo, readingScore, examScore, readPosts, following) VALUES (?, ?, ?, ?, ?, ?, ?)")
    //     .run(profile.id, profile.name, profile.photo, profile.readingScore, profile.examScore, profile.readPosts, profile.following);
    // }
    // res.json({ ...profile, readPosts: JSON.parse(profile.readPosts || "[]"), following: JSON.parse(profile.following || "[]") });
    res.json({ id: req.params.id, name: "Reader", photo: "https://picsum.photos/seed/user/200", readingScore: 0, examScore: 0, readPosts: [], following: [] });
  });

  app.post("/api/profile/:id", (req, res) => {
    // const { name, photo, readingScore, examScore, readPosts, following, preferredLanguage } = req.body;
    // db.prepare("UPDATE user_profile SET name = ?, photo = ?, readingScore = ?, examScore = ?, readPosts = ?, following = ?, preferredLanguage = ? WHERE id = ?")
    //   .run(name, photo, readingScore, examScore, JSON.stringify(readPosts), JSON.stringify(following), preferredLanguage, req.params.id);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
