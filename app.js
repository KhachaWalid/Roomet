require("dotenv").config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');


const app = express();
app.use(express.json());






const uri = process.env.MONGO_URI;

async function connectDB() {
    try {
        await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log("✅ MongoDB Connected Successfully!");
    } catch (error) {
        console.error("❌ MongoDB Connection Failed:", error);
        process.exit(1);
    }
}
connectDB();


app.use(session({
  secret: "Random123",
  resave: false,  
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }), 
  cookie: {
      secure: false, 
      httpOnly: true,
      sameSite: "strict", 
      maxAge: 1000 * 60 * 60 * 24  
  }
}));


const authRoutes = require("./routes/authRoutes");
app.use("/api/auth", authRoutes); 

const blockRoutes = require("./routes/blockRoutes");
app.use("/api/blocks", blockRoutes);





const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
