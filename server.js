// 모듈 require
const express = require("express");
const dotenv = require("dotenv");
dotenv.config({ path: "./config/config.env" });
const morgan = require("morgan");

// 라우터 require
const user = require("./routes/user.js");
const book_rental = require(`./routes/book_rental.js`);

const app = express();
app.use(express.json());

// 로그 기록
app.use(morgan("dev"));

// 라우터 배치
app.use("/api/v1/book_rental/user", user);
app.use("/api/v1/book_rental/books", book_rental);
