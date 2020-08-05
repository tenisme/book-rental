// 클라이언트의 헤더에 셋팅된 Authorization(token)값을 확인하여 인증한다.
const jwt = require("jsonwebtoken"); // 얘가 있어야 토큰값 decode 가능
const chalk = require("chalk");
const connection = require("../db/mysql_connection.js");

let nomal_txt = chalk.cyanBright;
let highlight_txt = chalk.yellowBright;

const auth = async (req, res, next) => {
  console.log(chalk.bold("<<  인증 미들웨어 실행됨  >>"));

  // 헤더에서 토큰값 빼오는 방법
  let token = req.header("Authorization");

  // 토큰이 없는 경우
  if (!token) {
    res.status(401).json({ error: "not token" });
    return;
  }

  token = token.replace("Bearer ", ""); // "Bearer "를 뺀다.
  console.log(highlight_txt.bold("login token") + nomal_txt(" - " + token));

  // 빼온 토큰값 decode해서 user_id값 빼오기
  let user_id;
  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    // console.log(decoded);
    user_id = decoded.user_id;
  } catch (e) {
    res.status(401).json({ error: "형식에 맞지 않는 토큰" });
    return;
  }

  // 빼온 user_id값으로 DB에서 유저 정보 select하기
  let query =
    "select u.user_id, u.email, u.age, t.token from book_user as u \
     join book_user_token as t on u.user_id = t.user_id where u.user_id = ? and t.token = ?";
  let values = [user_id, token];

  try {
    [rows, fields] = await connection.query(query, values);

    if (rows.length == 0) {
      res.status(401).json({ error: "인증 먼저 하십시오" });
      return;
    } else {
      req.user = rows[0];

      console.log(
        highlight_txt.bold("User authorization") +
          nomal_txt(" - user_id : ") +
          highlight_txt(user_id) +
          nomal_txt(", email : ") +
          highlight_txt(rows[0].email) +
          nomal_txt(", age : ") +
          highlight_txt(rows[0].age)
      );

      next();
    }
  } catch (e) {
    res.status(500).json({ success: false, message: `DB ERROR`, error: e });
    return;
  }
};

module.exports = auth;
