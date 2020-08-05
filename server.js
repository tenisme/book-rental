// 모듈 require
const express = require("express");
const dotenv = require("dotenv");
dotenv.config({ path: "./config/config.env" });
const morgan = require("morgan");

// 라우터 require
const user = require("./routes/user.js");

// 미들웨어 require
const auth = require("./middleware/auth.js");

const app = express();
app.use(express.json());

// 로그 기록
app.use(morgan("dev"));

// 라우터 배치
app.use("/api/v1/book_rental/user", user);

const PORT = process.env.PORT || 5700;

app.listen(PORT, () => {
  console.log(`Server running in port ${PORT}`);
});
