const bcryptjs = require(`bcryptjs`);
const jwt = require(`jsonwebtoken`);
const chalk = require(`chalk`);
const validator = require(`validator`);

const connection = require(`../db/mysql_connection.js`);

// @desc    회원 가입 api
// @route   POST /api/v1/book_rental/user
// @req     email, passwd, age
// @res     success, message, token
exports.joinOn = async (req, res, next) => {
  console.log(chalk.bold(`<<  회원 가입 api 실행됨  >>`));

  let email = req.body.email;
  let passwd = req.body.passwd;
  let age = req.body.age;

  if (!email || !passwd || !age) {
    res
      .status(400)
      .json({ success: false, message: `이메일, 패스워드, 나이 입력은 필수` });
    return;
  }

  if (!validator.isNumeric(String(age))) {
    res
      .status(400)
      .json({ success: false, message: `나이는 숫자로 입력해야함` });
    return;
  } else if (age < 5 || age > 150) {
    res.status(400).json({
      success: false,
      message: `가입 나이 제한 : 5세 이상 150세 이하`,
    });
    return;
  }

  if (!validator.isEmail(email)) {
    // 이메일이 정상적인지 체크
    res.status(400).json({
      success: false,
      message: `정상적인 이메일 형식이 아님`,
    });
    return;
  } else if (email.length > 50) {
    res.status(400).json({
      success: false,
      message: `이메일은 50자 이내로 입력해야 함`,
    });
    return;
  }

  // 트랜잭션 셋팅/시작
  const conn = await connection.getConnection();
  await conn.beginTransaction();

  // 패스워드 암호화
  const hashedPasswd = await bcryptjs.hash(passwd, 8);

  // book_user 테이블에 유저 정보 insert
  let query = `insert into book_user (email, passwd, age) values (?, ?, ?)`;
  let values = [email, hashedPasswd, age];
  let user_id;

  try {
    [result] = await conn.query(query, values);

    if (result.affectedRows == 0) {
      await conn.rollback();
      res.status(500).json({ success: false, message: `유저 정보 저장 실패` });
      return;
    }

    // user_id 추출
    user_id = result.insertId;
  } catch (e) {
    if (e.errno == 1062) {
      await conn.rollback();
      res.status(400).json({
        success: false,
        errno: 0,
        message: `이미 존재하는 이메일`,
      });
      return;
    }

    await conn.rollback();
    res.status(500).json({ success: false, message: `DB ERROR`, error: e });
    return;
  }

  // 로그인 토큰 생성
  let token = jwt.sign({ user_id: user_id }, process.env.ACCESS_TOKEN_SECRET);

  // book_user_token 테이블에 user_id와 token 정보를 insert
  query = `insert into book_user_token (user_id, token) values (?, ?)`;
  values = [user_id, token];

  try {
    [result] = await conn.query(query, values);

    if (result.affectedRows == 0) {
      await conn.rollback();
      res.status(500).json({ success: false, message: `토큰 저장 실패` });
      return;
    }
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ success: false, message: `DB ERROR`, error: e });
    return;
  }

  // 트랜잭션 저장 & 커넥션 반환
  await conn.commit();
  await conn.release();

  console.log(
    chalk.yellowBright.bold("User join on") +
      chalk.cyanBright(` - user_id : ${user_id}, email : ${email}`)
  );

  res
    .status(200)
    .json({ success: true, message: `가입을 환영합니다`, token: token });
};

// @desc    로그인 api
// @route   POST /api/v1/book_rental/user/login
// @req     email, passwd
// @res     success, message, token
exports.login = async (req, res, next) => {
  console.log(chalk.bold(`<<  로그인 api 실행됨  >>`));

  let email = req.body.email;
  let passwd = req.body.passwd;

  // DB에 존재하는 email 정보인지 확인 후 user_id 추출
  let query = `select * from book_user where email = ?`;
  let values = [email];
  let user_id;

  try {
    [rows] = await connection.query(query, values);

    if (rows.length == 0) {
      res.status(400).json({ success: false, message: `등록되지 않은 이메일` });
      return;
    }

    // 기존 비밀번호와 맞는지 체크 (bcrypt)
    let isMatch = await bcryptjs.compare(passwd, rows[0].passwd);

    if (!isMatch) {
      res.status(400).json({
        success: false,
        message: `비밀번호 불일치`,
      });
      return;
    }

    user_id = rows[0].user_id;
  } catch (e) {
    res.status(500).json({ success: false, message: `DB ERROR`, error: e });
    return;
  }

  // 로그인 토큰 생성
  let token = jwt.sign({ user_id: user_id }, process.env.ACCESS_TOKEN_SECRET);

  // book_user_token에 user_id와 token 정보 insert
  query = `insert into book_user_token (user_id, token) values (?, ?)`;
  values = [user_id, token];

  try {
    [result] = await connection.query(query, values);

    if (result.affectedRows == 0) {
      res.status(500).json({ success: false, message: `토큰 저장 실패` });
      return;
    }
  } catch (e) {
    res.status(500).json({ success: false, message: `DB ERROR`, error: e });
    return;
  }

  console.log(
    chalk.yellowBright.bold("User login") +
      chalk.cyanBright(` - user_id : ${user_id}, email : ${email}`)
  );

  res.status(200).json({ success: true, message: `환영합니다`, token: token });
};

// @desc    로그아웃 api
// @route   DELETE /api/v1/book_rental/user
// @req     user_id(auth), token(auth)
// @res     success, message
exports.logout = async (req, res, next) => {
  console.log(chalk.bold(`<<  로그아웃 api 실행됨  >>`));

  let user_id = req.user.user_id;
  let token = req.user.token;

  if (!user_id) {
    res.status(401).json({ success: false, message: `잘못된 접근` });
    return;
  }

  // book_user_token에서 user_id와 token 정보가 일치하는 데이터 삭제
  let query = `delete from book_user_token where user_id = ? and token = ?`;
  let values = [user_id, token];

  try {
    [result] = await connection.query(query, values);

    if (result.affectedRows == 0) {
      res.status(500).json({ success: false, message: `로그아웃 실패` });
      return;
    }
  } catch (e) {
    res.status(500).json({ success: false, message: `DB ERROR`, error: e });
    return;
  }

  res
    .status(200)
    .json({ success: true, message: `성공적으로 로그아웃되었습니다` });
};
