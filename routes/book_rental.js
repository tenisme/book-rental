const express = require(`express`);
const auth = require(`../middleware/auth.js`);

const {
  getAllBooks,
  rentalBook,
  getRentalBooks,
  returnBook,
} = require(`../controllers/book_rental.js`);

const router = express.Router();

router.route(`/`).get(getAllBooks);
router.route(`/rental`).post(auth, rentalBook);
router.route(`/my_rental`).get(auth, getRentalBooks);
router.route(`/return_book`).delete(auth, returnBook);

module.exports = router;
