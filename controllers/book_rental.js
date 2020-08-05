const moment = require(`moment`);
const validator = require(`validator`);
const chalk = require(`chalk`);

const connection = require(`../db/mysql_connection.js`);

// @desc    모든 책 조회 api
// @route   GET /api/v1/book_rental/books
// @req     offset, limit
// @res     success, items : [{id, title, author, limit_age}], cnt
exports.getAllBooks = async (req, res, next) => {
  console.log(chalk.bold(`<<  모든 책 조회 api 실행됨  >>`));

  let offset = req.query.offset;
  let limit = req.query.limit;

  // offset 미입력시 defalut값 처리
  if (!offset) {
    offset = 0;
  }

  // limit 미입력시 default값 처리
  if (!limit) {
    limit = 25;
  }

  // offset, limit을 숫자로 입력하지 않았을 경우 처리
  let offsetIsNum = validator.isNumeric(String(offset));
  let limitIsNum = validator.isNumeric(String(limit));

  if (!offsetIsNum || !limitIsNum) {
    res
      .status(400)
      .json({ success: false, message: `offset, limit이 숫자가 아님` });
    return;
  }

  offset = Number(offset);
  limit = Number(limit);

  // 모든 책을 25개씩 불러오는 쿼리
  let query = `select * from book limit ?, ?`;
  let values = [offset, limit];

  try {
    [rows] = await connection.query(query, values);

    res.status(200).json({ success: true, items: rows, cnt: rows.length });
  } catch (e) {
    res.status(500).json({ success: false, message: `DB ERROR`, error: e });
    return;
  }
};

// @desc    책 1권 대여 api
// @route   POST /api/v1/book_rental/books/rental
// @req     user_id(auth), book_id
// @res     success, message
exports.rentalBook = async (req, res, next) => {
  console.log(chalk.bold(`<<  책 1권 대여 api 실행됨  >>`));

  let user_id = req.user.user_id;
  let book_id = req.body.book_id;

  // user_id가 없을 시 처리
  if (!user_id) {
    res.status(401).json({ success: false, message: `잘못된 접근` });
    return;
  }

  // book_id 미입력 및 문자 입력시 처리
  if (!book_id) {
    res.stataus(400).json({ success: false, message: `책 id 입력 필수` });
    return;
  } else if (!validator.isNumeric(String(book_id))) {
    res
      .status(400)
      .json({ success: false, message: `책 id가 숫자로 입력되지 않음` });
    return;
  }

  // 유저의 나이와 책의 제한 연령을 가져오는 쿼리
  let query = `select u.age, b.limit_age from book_user as u, book as b where u.user_id = ? and b.id = ?`;
  let values = [user_id, book_id];
  let user_age;
  let limit_age;

  try {
    [rows] = await connection.query(query, values);

    if (rows.length == 0) {
      res.status(400).json({
        success: false,
        message: `일치하는 user_id 혹은 book_id가 없음`,
      });
      return;
    }

    user_age = rows[0].age;
    limit_age = rows[0].limit_age;
  } catch (e) {
    res.status(500).json({ success: false, message: `DB ERROR`, error: e });
    return;
  }

  console.log(user_age, limit_age);

  // user_age와 limit_age를 비교해 user_age가 더 적으면 대여할 수 없음 처리
  if (user_age < limit_age) {
    res.status(400).json({ success: false, message: `대여 연령 제한` });
    return;
  }

  // 현재 시간 + 7일
  let limit_time = Date.now() + 1000 * 60 * 10080;
  let limit_date = moment(limit_time).format("YYYY-MM-DD HH:mm:ss");

  // book_rental 테이블에 user_id와 book_id, limit_date를 저장하는 쿼리
  query = `insert into book_rental (user_id, book_id, limit_date) values (?, ?, ?)`;
  values = [user_id, book_id, limit_date];
  let rental_id;

  try {
    [result] = await connection.query(query, values);

    if (result.affectedRows == 0) {
      res.status(500).json({ success: false, message: `대여 실패` });
      return;
    }

    rental_id = result.insertId;
  } catch (e) {
    res.status(500).json({ success: false, message: `DB ERROR`, error: e });
    return;
  }

  res.status(200).json({
    success: true,
    message: `책이 대여되었습니다`,
    limit_date: limit_date,
  });
};

// @desc    내 대여 목록 조회 api
// @route   GET /api/v1/book_rental/books/my_rental
// @req     user_id(auth)
// @res     success, items : [{rental_id, book_id, title, author, limit_age, limit_date}], cnt
exports.getRentalBooks = async (req, res, next) => {
  console.log(chalk.bold(`<<  내 대여 목록 조회 api 실행됨  >>`));

  let user_id = req.user.user_id;

  // user_id가 없을 시 처리
  if (!user_id) {
    res.status(401).json({ success: false, message: `잘못된 접근` });
    return;
  }

  // 유저가 대여한 책 목록 조회 쿼리
  let query = `select r.rental_id, r.book_id, b.title, b.author, b.limit_age, r.limit_date 
               from book_rental as r join book as b on r.book_id = b.id where user_id = ?`;
  let values = [user_id];

  try {
    [rows] = await connection.query(query, values);

    if (rows.lentgh == 0) {
      res.status(200).json({ success: true, message: `대여한 책이 없음` });
      return;
    }
  } catch (e) {
    res.status(500).json({ success: false, message: `DB ERROR`, error: e });
    return;
  }

  res.status(200).json({ success: true, items: rows, cnt: rows.length });
};

// @desc    대여한 책 1권 반납 api
// @route   DELETE /api/v1/book_rental/books/return_book
// @req     user_id(auth), rental_id, charge;
// @res     success, message
exports.returnBook = async (req, res, next) => {
  console.log(chalk.bold(`<<  대여한 책 1권 반납 api 실행됨  >>`));

  let user_id = req.user.user_id;
  let rental_id = req.body.rental_id;
  let pay_charge = req.body.charge;

  // user_id가 없을 시 처리
  if (!user_id) {
    res.status(401).json({ success: false, message: `잘못된 접근` });
    return;
  }

  // rental_id 미입력 및 문자 입력시 처리
  if (!rental_id) {
    res.stataus(400).json({ success: false, message: `책 id 입력 필수` });
    return;
  } else if (!validator.isNumeric(String(rental_id))) {
    res
      .status(400)
      .json({ success: false, message: `책 id가 숫자로 입력되지 않음` });
    return;
  }

  // 연체 요금 미입력 및 문자 입력시 처리
  if (!pay_charge) {
    pay_charge = 0;
  } else if (!validator.isNumeric(String(pay_charge))) {
    res
      .status(400)
      .json({ success: false, message: `연체 요금이 숫자로 입력되지 않음` });
    return;
  }

  // 연체 처리 : 대여 기한을 가져오는 쿼리
  let query = `select limit_date from book_rental where user_id = ? and rental_id = ?`;
  let values = [user_id, rental_id];
  let currentTime = Date.now();
  let mili_limit_date;

  try {
    [rows] = await connection.query(query, values);

    if (rows.length == 0) {
      res.status(400).json({
        success: false,
        message: `user_id 혹은 rental_id에 해당하는 데이터가 없음`,
      });
      return;
    }

    let limit_date = rows[0].limit_date;
    mili_limit_date = new Date(limit_date).getTime();
  } catch (e) {
    res.status(500).json({ success: false, message: `DB ERROR`, error: e });
    return;
  }

  // 대여 기한이 지난 경우 대여 기한과 현재 시간의 시간차를 저장
  let diffTime;
  if (currentTime > mili_limit_date) {
    diffTime = currentTime - mili_limit_date;
  }

  // 대여한지 하루가 지나면 지난 만큼 요금 부여
  let chargeLimitTime = Date.now() + 1000 * 60 * 1440;
  let charge = 0;
  if (diffTime > chargeLimitTime) {
    charge = Math.round((diffTime / over_time) * 300);
  }

  // 낸(입력한) 요금과 charge가 맞지 않으면 return;
  if (pay_charge != charge) {
    res.status(400).json({
      success: false,
      message: `연체 요금 미납. 미납 요금 : ${charge}`,
    });
    return;
  }

  // 책 반납 : book_rental 테이블에서 rental_id에 해당하는 대여 목록 삭제 쿼리
  query = `delete from book_rental where user_id = ? and rental_id = ?`;
  values = [user_id, rental_id];

  try {
    [result] = await connection.query(query, values);

    if (result.affectedRows == 0) {
      res.status(500).json({ success: false, message: `책 반납 실패` });
      return;
    }
  } catch (e) {
    res.status(500).json({ success: false, message: `DB ERROR`, error: e });
    return;
  }

  // 성공적으로 반납했을 시 처리
  res.status(200).json({ success: true, message: `책 반납 성공` });
};
