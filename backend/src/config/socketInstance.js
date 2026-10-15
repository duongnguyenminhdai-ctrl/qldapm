/**
 * Singleton giữ instance Socket.io để dùng chung giữa controller và socket handler
 */
let _io = null;

function setIo(io) {
  _io = io;
}

function getIo() {
  return _io;
}

module.exports = { setIo, getIo };
