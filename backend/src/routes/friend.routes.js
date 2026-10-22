const express = require("express");
const {
  sendFriendRequest,
  getFriendRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  getFriendsList,
  unfriend,
} = require("../controllers/friend.controller");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(protect);

router.post("/request", sendFriendRequest);
router.get("/requests", getFriendRequests);
router.post("/accept", acceptFriendRequest);
router.post("/reject", rejectFriendRequest);
router.get("/list", getFriendsList);
router.post("/unfriend", unfriend);
router.delete("/:friendId", unfriend);

module.exports = router;
