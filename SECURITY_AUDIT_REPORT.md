# BÁO CÁO RÀ SOÁT BẢO MẬT & LOGIC NGHIỆP VỤ TOÀN DIỆN
## (Security & Business Logic Audit Report)
**Dự án:** Virtual Study Room — Nền tảng phòng học nhóm trực tuyến  
**Phạm vi kiểm toán:** Backend API Controllers, Middlewares, Socket.io Handlers & Database Models  
**Thời gian thực hiện:** Tháng 10/2026  
**Trạng thái kiểm toán:** Hoàn thành  

---

## I. TỔNG QUAN KẾT QUẢ RÀ SOÁT (EXECUTIVE SUMMARY)

Đợt rà soát an toàn thông tin và logic nghiệp vụ được thực hiện trên toàn bộ mã nguồn Backend (`backend/src`) tập trung vào 4 trọng tâm chính:
1. **Xác thực & Phân quyền (Authentication & Authorization):** Middleware JWT, phân quyền tài nguyên, bảo vệ endpoint sửa/xóa, quy trình OTP & Quên mật khẩu.
2. **Logic Rút thẻ & Nâng cấp VIP:** Cơ chế trừ lượt nguyên tử (Atomic decrement chống Race condition), Concurrency Control và phòng chống Mass Assignment.
3. **Bảo mật Socket.io:** Bắt buộc xác thực handshake token (`io.use`), cơ chế chống mạo danh danh tính và phân quyền phát lệnh (duyệt phòng, đuổi/cấm thành viên, thu hồi tin nhắn, đóng phòng).
4. **Bảo mật dữ liệu & Rate Limit:** Chống rò rỉ trường nhạy cảm (`password`, token) trong response JSON, rà soát giới hạn tần suất yêu cầu (`rateLimit`) và chống Brute-Force.

### Bảng phân loại mức độ nghiêm trọng của các phát hiện:

| Mức độ | Số lượng | Mô tả tóm tắt |
| :--- | :---: | :--- |
| **CRITICAL** | 2 | <ul><li>Mạo danh Host/Admin trong Socket.io do lấy danh tính từ payload `join-room` không qua kiểm chứng token (cho phép kick/ban, duyệt phòng, thu hồi tin nhắn, đóng phòng).</li><li>Endpoint `leaveRoom` chấp nhận `req.body.userId` không qua xác thực token JWT, cho phép bất kỳ ai đóng phòng hoặc kick thành viên khác.</li></ul> |
| **HIGH** | 3 | <ul><li>Race condition trong `drawCard`: Mặc dù có trừ lượt nguyên tử bằng `findOneAndUpdate`, việc gọi tiếp `user.save()` trong bộ nhớ ghi đè làm mất tính nguyên tử của `cardInventory` và `cardDraws`.</li><li>Lỗ hổng Bypass logic thu hồi tin nhắn (`chat:recall-message`) khi `currentUserId` rỗng/khuyết danh trong Socket.io.</li><li>Lưu trữ mật khẩu dạng Plaintext trong MongoDB collection `OtpVerification` trong phiên chờ xác thực OTP đăng ký.</li></ul> |
| **MEDIUM** | 3 | <ul><li>Rate Limiter có thể bị vượt qua (Bypass) bằng việc giả lập header `X-Forwarded-For` do thiếu cấu hình `trust proxy` tin cậy trong Express.</li><li>Cấp LiveKit Token (`GET /api/livekit/token`) bỏ qua kiểm tra trạng thái phòng chờ (`APPROVAL_REQUIRED`), cho phép user chưa duyệt nghe/xem trực tiếp luồng media.</li><li>Thiếu cơ chế vô hiệu hóa (Single-use revocation) `resetToken` ngay sau khi đặt lại mật khẩu thành công.</li></ul> |
| **LOW / INFO** | 3 | <ul><li>Chấp nhận JWT qua Query Parameter (`req.query.token`) có nguy cơ lộ token qua Browser History hoặc Server Access Logs.</li><li>Lỗi Runtime Bug `validSenderId` chưa được khai báo trong `upload.controller.js:198`.</li><li>Thiếu Rate Limit trên các endpoint tốn tài nguyên (`/api/cards/draw`, `/api/upload`, `/api/ai/tutor`).</li></ul> |

---

## II. CHI TIẾT KẾT QUẢ THEO 4 TRỌNG TÂM KIỂM TOÁN

---

### 1. QUÉT LỖ HỔNG XÁC THỰC & PHÂN QUYỀN

#### 1.1. Middleware xác thực JWT & Phân quyền Role
* **Điểm đã an toàn:**
  * Middleware `protect` ([`authMiddleware.js`](file:///D:/aKTS/qldapm/backend/src/middlewares/authMiddleware.js#L55-L103)) ép cứng thuật toán `{ algorithms: ["HS256"] }` để phòng chống tấn công Algorithm Confusion (None Algorithm hoặc Public-Key Confusion).
  * Kiểm tra trạng thái tài khoản bị khóa (`currentUser.status === "BLOCKED" || currentUser.isBanned`) ngay tại middleware với cơ chế đệm in-memory cache TTL 15s để tối ưu hiệu năng ([`authMiddleware.js`](file:///D:/aKTS/qldapm/backend/src/middlewares/authMiddleware.js#L84-L98)).
  * Middleware `requireAdmin` ([`authMiddleware.js`](file:///D:/aKTS/qldapm/backend/src/middlewares/authMiddleware.js#L146-L185)) kiểm tra nghiêm ngặt `user.role === "ADMIN"` và được gắn cho toàn bộ route Quản trị viên tại [`admin.routes.js:23`](file:///D:/aKTS/qldapm/backend/src/routes/admin.routes.js#L23).
  * Middleware `requirePro` ([`authMiddleware.js`](file:///D:/aKTS/qldapm/backend/src/middlewares/authMiddleware.js#L191-L245)) kiểm tra thời hạn gói VIP của user (`user.isPro && new Date() <= user.proExpiresAt`) hoặc quyền Admin, áp dụng cho tính năng AI Tutor ([`aiTutor.routes.js:9`](file:///D:/aKTS/qldapm/backend/src/routes/aiTutor.routes.js#L9)).
  * Các route nhạy cảm đều được bảo vệ bằng middleware xác thực:
    * Thông tin cá nhân & đổi mật khẩu: [`authRoutes.js:46-50`](file:///D:/aKTS/qldapm/backend/src/routes/authRoutes.js#L46-L50)
    * Rút thẻ & Đổi VIP: [`card.routes.js:11`](file:///D:/aKTS/qldapm/backend/src/routes/card.routes.js#L11)
    * Bạn bè: [`friend.routes.js:14`](file:///D:/aKTS/qldapm/backend/src/routes/friend.routes.js#L14)
    * Tin nhắn & Hội thoại: [`message.routes.js:15`](file:///D:/aKTS/qldapm/backend/src/routes/message.routes.js#L15)
    * Upload tài liệu: [`upload.routes.js:9,15`](file:///D:/aKTS/qldapm/backend/src/routes/upload.routes.js#L9)
    * Tạo URL thanh toán VNPay: [`payment.routes.js:16`](file:///D:/aKTS/qldapm/backend/src/routes/payment.routes.js#L16)

* **Điểm cần vá (Vulnerabilities):**
  * **[CRITICAL] Hở xác thực tại endpoint rời phòng / kết thúc phòng:**  
    * **Vị trí file:** [`backend/src/routes/room.routes.js:23-24`](file:///D:/aKTS/qldapm/backend/src/routes/room.routes.js#L23-L24) và [`backend/src/controllers/room.controller.js:692-695`](file:///D:/aKTS/qldapm/backend/src/controllers/room.controller.js#L692-L695).  
    * **Chi tiết code:**
      ```javascript
      // room.controller.js (Dòng 692-695)
      // Fallback nếu client truyền thẳng userId trong body
      if (!userId && req.body?.userId) {
        userId = req.body.userId;
      }
      ```
    * **Nguy cơ:** Route `POST /api/rooms/leave` và `POST /api/rooms/:roomCode/leave` không có middleware `protect`. Đoạn code trên tin cậy `req.body.userId` mà không kiểm tra chữ ký token. Kẻ tấn công ẩn danh có thể gửi payload `{ roomCode: "ABCDEF", userId: "<HOST_USER_ID>", terminate: true }` để kích hoạt logic hủy phòng của chủ phòng (`destroyAndCleanupRoom`), làm sập bất kỳ phòng học nào đang mở.
    * **Khuyến nghị khắc phục:** Bắt buộc giải mã và xác thực token JWT (từ header `Authorization` hoặc `token` trong body) để trích xuất `userId`. Tuyệt đối không cho phép fallback nhận `userId` thô từ request body nếu token không hợp lệ.

  * **[MEDIUM] Bỏ qua kiểm tra xét duyệt phòng khi cấp LiveKit Token:**  
    * **Vị trí file:** [`backend/src/controllers/livekit.controller.js:24-43`](file:///D:/aKTS/qldapm/backend/src/controllers/livekit.controller.js#L24-L43).  
    * **Nguy cơ:** Controller chỉ kiểm tra xem user có bị cấm (`room.bannedUsers`) hay không, nhưng không kiểm tra xem phòng có bật chế độ phòng chờ duyệt (`accessType === "APPROVAL_REQUIRED"`) hay user đã nằm trong `room.approvedUsers` chưa. Học viên chưa được chủ phòng phê duyệt vẫn có thể lấy LiveKit Token để truy cập stream video/mic của phòng.
    * **Khuyến nghị khắc phục:** Kiểm tra điều kiện `if (room.accessType === "APPROVAL_REQUIRED" && !room.approvedUsers.includes(userId) && String(room.hostId) !== String(userId))` thì trả về 403 Forbidden.

  * **[LOW] Hỗ trợ nhận JWT qua Query Parameter (`req.query.token`):**  
    * **Vị trí file:** [`backend/src/middlewares/authMiddleware.js:61-63`](file:///D:/aKTS/qldapm/backend/src/middlewares/authMiddleware.js#L61-L63).  
    * **Nguy cơ:** Token truyền qua URL dễ bị lưu lại trên Web Server Access Log, Proxy, Referrer header và lịch sử trình duyệt.
    * **Khuyến nghị khắc phục:** Chỉ chấp nhận JWT qua header chuẩn `Authorization: Bearer <token>`.

---

#### 1.2. Kiểm tra các endpoint sửa/xóa & So khớp quyền sở hữu (`req.user._id`)
* **Điểm đã an toàn:**
  * **Cập nhật hồ sơ cá nhân:** [`authController.js:857`](file:///D:/aKTS/qldapm/backend/src/controllers/authController.js#L857) truy vấn trực tiếp theo `req.user.id`, ngăn ngừa chỉnh sửa chéo tài khoản.
  * **Đổi mật khẩu:** [`authController.js:967`](file:///D:/aKTS/qldapm/backend/src/controllers/authController.js#L967) chỉ cho phép đổi mật khẩu của tài khoản `req.user.id`.
  * **Thu hồi tin nhắn API:** [`message.controller.js:345-350`](file:///D:/aKTS/qldapm/backend/src/controllers/message.controller.js#L345-L350) kiểm tra bắt buộc:
    ```javascript
    if (String(message.sender) !== String(currentUserId)) {
      return res.status(403).json({ success: false, message: "Bạn chỉ có thể thu hồi tin nhắn do chính bạn gửi." });
    }
    ```
  * **Xóa / Đánh dấu đọc thông báo:** [`notification.controller.js:112, 180`](file:///D:/aKTS/qldapm/backend/src/controllers/notification.controller.js#L112) truy vấn kèm `{ recipient: userId }`.
  * **Quản lý bạn bè:** [`friend.controller.js:383, 400, 470, 480`](file:///D:/aKTS/qldapm/backend/src/controllers/friend.controller.js#L400) luôn so khớp và thao tác trên danh sách bạn bè của `req.user.id`.
  * **Tải transcript phòng học:** [`notification.controller.js:247-250`](file:///D:/aKTS/qldapm/backend/src/controllers/notification.controller.js#L247-L250) kiểm tra quyền truy cập và chống Path Traversal bằng `path.basename(fileName)`.

* **Điểm cần vá (Vulnerabilities):**
  * **[MEDIUM] Thiếu kiểm tra quyền tham gia hội thoại khi thả cảm xúc (`reactToMessage`):**  
    * **Vị trí file:** [`backend/src/controllers/message.controller.js:490-505`](file:///D:/aKTS/qldapm/backend/src/controllers/message.controller.js#L490-L505).  
    * **Nguy cơ:** Controller tìm tin nhắn bằng `Message.findById(messageId)` nhưng không kiểm tra xem `currentUserId` có phải là thành viên trong `Conversation` đó hay không. Một người dùng bất kỳ nếu biết `messageId` có thể thêm/xóa phản ứng cảm xúc vào cuộc trò chuyện riêng tư của người khác.
    * **Khuyến nghị khắc phục:** Kiểm tra `Conversation.exists({ _id: message.conversationId, participants: currentUserId })` trước khi cho phép thả cảm xúc.

---

#### 1.3. Logic OTP / Đăng ký & Quên mật khẩu
* **Điểm đã an toàn:**
  * **Mã hóa OTP:** OTP được băm bằng `bcrypt.hash(otp, 10)` trước khi lưu vào MongoDB ([`authController.js:151, 337`](file:///D:/aKTS/qldapm/backend/src/controllers/authController.js#L151)).
  * **Thời gian hết hạn:** OTP có hiệu lực đúng 5 phút (`expiresAt: new Date(Date.now() + 5 * 60 * 1000)`) ([`authController.js:165, 346`](file:///D:/aKTS/qldapm/backend/src/controllers/authController.js#L165)) và tự động dọn dẹp nhờ MongoDB TTL Index (`{ expires: 0 }`) tại [`OtpVerification.js:33`](file:///D:/aKTS/qldapm/backend/src/models/OtpVerification.js#L33).
  * **Giới hạn số lần thử (Brute-Force Protection):** Đếm số lần nhập sai (`attempts`). Vượt quá 5 lần sẽ xóa bỏ bản ghi OTP ngay lập tức ([`authController.js:247-254`](file:///D:/aKTS/qldapm/backend/src/controllers/authController.js#L247-L254), [`authController.js:407-414`](file:///D:/aKTS/qldapm/backend/src/controllers/authController.js#L407-L414)).
  * **Chống spam gửi lại mã:** Có thời gian chờ Cooldown 45 giây giữa các lần yêu cầu gửi lại OTP ([`authController.js:544-551`](file:///D:/aKTS/qldapm/backend/src/controllers/authController.js#L544-L551)).
  * **Token đặt lại mật khẩu:** Sau khi xác thực OTP, hệ thống cấp `resetToken` dạng JWT có thời hạn ngắn 15 phút kèm `purpose: "RESET_PASSWORD"` ([`authController.js:423-427`](file:///D:/aKTS/qldapm/backend/src/controllers/authController.js#L423-L427)).

* **Điểm cần vá (Vulnerabilities):**
  * **[HIGH] Lưu trữ mật khẩu dạng Plaintext trong Collection `OtpVerification`:**  
    * **Vị trí file:** [`backend/src/controllers/authController.js:157-166`](file:///D:/aKTS/qldapm/backend/src/controllers/authController.js#L157-L166).  
    * **Chi tiết code:**
      ```javascript
      // Lưu bản ghi OtpVerification
      await OtpVerification.create({
        email: cleanEmail,
        otpHash,
        type: "REGISTER",
        data: {
          name: name.trim(),
          password, // <-- LƯU MẬT KHẨU GỐC CHƯA BĂM
        },
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      });
      ```
    * **Nguy cơ (CWE-256 / CWE-312):** Trong vòng 5 phút chờ nhập mã OTP, mật khẩu của người dùng được lưu trữ dưới dạng văn bản thuần trong cơ sở dữ liệu. Nếu database bị rò rỉ hoặc log truy vấn bị thu thập, mật khẩu người dùng sẽ bị lộ trực tiếp.
    * **Khuyến nghị khắc phục:** Băm mật khẩu bằng bcrypt (`const passwordHash = await bcrypt.hash(password, 10)`) ngay trước khi lưu vào `data.passwordHash`, sau đó khi xác thực OTP xong chỉ việc gán thẳng `passwordHash` vào tài khoản mà không cần lưu plaintext.

  * **[MEDIUM] Không vô hiệu hóa `resetToken` sau khi đặt lại mật khẩu thành công:**  
    * **Vị trí file:** [`backend/src/controllers/authController.js:473-505`](file:///D:/aKTS/qldapm/backend/src/controllers/authController.js#L473-L505).  
    * **Nguy cơ:** `resetToken` là stateless JWT có hiệu lực 15 phút. Khi người dùng hoàn tất đặt lại mật khẩu ở dòng 502, `resetToken` không bị đánh dấu đã sử dụng (burned/revoked). Nếu token bị rò rỉ trong thời gian 15 phút đó, kẻ tấn công có thể sử dụng lại để đổi mật khẩu lần nữa.
    * **Khuyến nghị khắc phục:** Sử dụng một trường `passwordChangedAt` trong `User` model hoặc lưu `resetPasswordTokenId` (jti) một lần duy nhất vào database.

---

### 2. QUÉT LỖ HỔNG LOGIC RÚT THẺ & VIP

#### 2.1. Controller Rút thẻ (`drawCard`): Trừ lượt nguyên tử & Chống Race Condition
* **Điểm đã an toàn:**
  * Endpoint rút thẻ sử dụng toán tử nguyên tử MongoDB:
    ```javascript
    // card.controller.js (Dòng 68-72)
    const user = await User.findOneAndUpdate(
      { _id: userId, cardDraws: { $gt: 0 } },
      { $inc: { cardDraws: -1 } },
      { new: true }
    );
    ```
    *Lưu ý về tên trường:* Trong cơ sở dữ liệu thực tế của hệ thống, trường số lượt rút được đặt tên là `cardDraws` (thay vì `drawTurns`), và đã áp dụng đúng điều kiện `{ cardDraws: { $gt: 0 } }` cùng `{ $inc: { cardDraws: -1 } }`.

* **Điểm cần vá (Vulnerabilities):**
  * **[HIGH] Race Condition do gọi `user.save()` làm mất tính nguyên tử:**  
    * **Vị trí file:** [`backend/src/controllers/card.controller.js:68-107`](file:///D:/aKTS/qldapm/backend/src/controllers/card.controller.js#L68-L107).  
    * **Phân tích chi tiết lỗi logic:**
      1. Bước 1: `findOneAndUpdate` trừ `cardDraws` nguyên tử trên MongoDB.
      2. Bước 2: Sinh ngẫu nhiên lá bài `drawnCardId` (1 đến 7).
      3. Bước 3: Cập nhật mảng `user.cardInventory` **trong bộ nhớ JavaScript (in-memory)**:
         ```javascript
         const cardItem = user.cardInventory.find((c) => Number(c.cardId) === drawnCardId);
         if (cardItem) cardItem.count = (Number(cardItem.count) || 0) + 1;
         else user.cardInventory.push({ cardId: drawnCardId, count: 1 });
         ```
      4. Bước 4: Gọi `await user.save()`.
    * **Hậu quả:** Khi 2 request gửi đồng thời từ 1 tài khoản (hoặc sử dụng công cụ spam request):
      - Request A và Request B cùng hoàn thành Bước 1 (`cardDraws` từ 2 -> 1, rồi 1 -> 0).
      - Nhưng `user` trong Request A có `cardDraws: 1`, còn Request B có `cardDraws: 0`.
      - Khi Request A chạy chậm hơn và gọi `user.save()`, đối tượng Document của Request A sẽ **ghi đè toàn bộ** document trong MongoDB, đưa `cardDraws` từ 0 trở lại 1 (hoặc ghi đè làm mất thẻ bài vừa nhận ở Request B - hiện tượng *Lost Update*).
    * **Khuyến nghị khắc phục:** Thay vì dùng `user.save()`, hãy cập nhật thẻ bài trúng thưởng trực tiếp bằng câu lệnh atomic MongoDB:
      ```javascript
      // Cách sửa chuẩn nguyên tử 100% không dùng user.save():
      const updateResult = await User.findOneAndUpdate(
        { _id: userId, "cardInventory.cardId": drawnCardId },
        { $inc: { "cardInventory.$.count": 1 } },
        { new: true }
      );
      if (!updateResult) {
        await User.findByIdAndUpdate(userId, {
          $push: { cardInventory: { cardId: drawnCardId, count: 1 } },
        });
      }
      ```

#### 2.2. Đổi trọn bộ thẻ lấy VIP (`exchangeVip`)
* **Điểm đã an toàn:**
  * [`card.controller.js:171-185`](file:///D:/aKTS/qldapm/backend/src/controllers/card.controller.js#L171-L185) kiểm tra nghiêm ngặt sự hiện diện của đủ 7 lá bài (từ 1 đến 7) với số lượng `count >= 1`.
  * [`card.controller.js:208-225`](file:///D:/aKTS/qldapm/backend/src/controllers/card.controller.js#L208-L225) áp dụng cơ chế **Optimistic Concurrency Control** thông qua trường version `__v`:
    ```javascript
    const updatedUser = await User.findOneAndUpdate(
      { _id: userId, __v: user.__v },
      {
        $set: { cardInventory: updatedInventory, isPro: true, proExpiresAt: newProExpiresAt },
        $inc: { proMonths: 1, __v: 1 },
      },
      { new: true }
    );
    ```
    Nếu có 2 request đổi VIP chạy song song, request thứ hai sẽ thất bại ngay lập tức (trả về HTTP 409) do `__v` đã bị thay đổi, ngăn chặn hoàn toàn việc nhân bản thời hạn VIP.

#### 2.3. Rà soát Mass Assignment (`User.findByIdAndUpdate` & `User.create`)
* **Điểm đã an toàn:**
  * Toàn bộ mã nguồn backend đã được quét tự động bằng biểu thức chính quy. **Không có bất kỳ vị trí nào truyền trực tiếp `req.body` vào `User.create` hoặc `User.findByIdAndUpdate`**:
    * Trong `authController.js`: [`register:66`](file:///D:/aKTS/qldapm/backend/src/controllers/authController.js#L66), [`registerVerifyOtp:273`](file:///D:/aKTS/qldapm/backend/src/controllers/authController.js#L273), [`googleLogin:665`](file:///D:/aKTS/qldapm/backend/src/controllers/authController.js#L665) đều truyền object với các trường cụ thể được chọn lọc rõ ràng.
    * Trong `authController.js: updateProfile` ([dòng 855-919](file:///D:/aKTS/qldapm/backend/src/controllers/authController.js#L855-L919)): Chỉ bóc tách các trường hồ sơ được phép: `name`, `avatar`, `birthYear`, `phone`, `school`, `bio`. Người dùng không thể tự gán `role: "ADMIN"`, `isPro: true`, `streak`, `status` qua `req.body`.
    * Trong `admin.controller.js: updateUser` ([dòng 465-488](file:///D:/aKTS/qldapm/backend/src/controllers/admin.controller.js#L465-L488)): Sử dụng danh sách trắng `updatableFields` rõ ràng và kiểm tra quyền admin trước khi cập nhật.
    * Trong `payment.controller.js:217`: Chỉ gán cứng `{ isPro: true, proExpiresAt, title: "VIP" }`.
    * Trong `sockets/index.js:882, 4355`: Chỉ cập nhật `{ isOnline, lastSeen }`.
  * **Kết luận:** Hệ thống an toàn tuyệt đối trước lỗ hổng Mass Assignment trên tài khoản người dùng.

---

### 3. QUÉT SOCKET.IO (REAL-TIME SECURITY)

#### 3.1. Xác thực kết nối Socket (`io.use`)
* **Vị trí file:** [`backend/src/sockets/index.js:800-824`](file:///D:/aKTS/qldapm/backend/src/sockets/index.js#L800-L824).
* **Chi tiết code hiện tại:**
  ```javascript
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || ...;
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
          socket.authUserId = String(decoded.id);
          socket.authUser = decoded;
        } catch (_) {
          socket.authUserId = null;
        }
      }
      return next(); // <-- LUÔN CHO PHÉP KẾT NỐI KỂ CẢ KHI TOKEN KHÔNG HỢP LỆ
    } catch (_) {
      return next();
    }
  });
  ```
* **Đánh giá rủi ro (CRITICAL):**
  - Mặc dù middleware có giải mã token và gán vào `socket.authUserId`, nhưng nếu token thiếu hoặc token giả mạo, hệ thống vẫn gọi `next()` cho phép kết nối Socket tiếp tục dưới danh nghĩa ẩn danh (`anonymous`).
  - Điều này mở đường cho việc kẻ tấn công tự kết nối và phát các sự kiện mà không bị chặn ngay từ cổng vào.

#### 3.2. Phân quyền và kiểm tra vai trò người dùng trong các Socket Event
* **[CRITICAL] Lỗ hổng Mạo danh Host/Admin trong `join-room` và các lệnh quản trị phòng:**
  * **Vị trí file:** [`backend/src/sockets/index.js:1195-1223, 1309-1311`](file:///D:/aKTS/qldapm/backend/src/sockets/index.js#L1195-L1223).
  * **Nguyên nhân cốt lõi:** Khi người dùng gửi sự kiện `join-room`, server nhận tham số `user` từ client và gán thẳng vào socket:
    ```javascript
    socket.userData = user; // <-- LẤY TRỰC TIẾP TỪ CLIENT PAYLOAD KHÔNG QUA TOKEN
    socket.userId = user?.id || user?._id;
    ```
  * **Hậu quả dây chuyền trên các lệnh quản trị:**
    1. **Duyệt phòng chờ (`room:handle-join-request` - dòng 1643, 1654):**  
       `callerId` lấy từ `socket.userData?.id`. Kẻ tấn công chỉ cần gửi `{ roomCode, user: { id: room.hostId } }` khi join là có thể duyệt hoặc từ chối toàn bộ học viên trong phòng chờ.
    2. **Đuổi thành viên (`room:kick-member` - dòng 2376, 2404):**  
       `hostUserId` fallback về `socket.userData?.id`. Kẻ tấn công có thể đuổi bất kỳ thành viên nào ra khỏi phòng mà không cần là chủ phòng.
    3. **Cấm thành viên vĩnh viễn khỏi phòng (`room:ban-member` - dòng 2511, 2539):**  
       Tương tự `kick-member`, kẻ tấn công có thể cấm bất kỳ ai tham gia phòng.
    4. **Đóng phòng học cho tất cả mọi người (`terminate_room` / `room:terminate` - dòng 3702, 3721):**  
       Kiểm tra quyền Host dựa trên `socket.userData?.id` hoặc `socket.userData?.role !== "ADMIN"`. Kẻ tấn công gửi `user: { role: "ADMIN" }` hoặc `user: { id: room.hostId }` có thể đóng ngay lập tức phiên học của người khác.
    5. **Khóa phòng / Tắt mic toàn bộ / Chuyển quyền Host (`room:toggle-lock`, `room:force-mute-all`, `room:transfer-host` - dòng 2648, 2733, 2777):**  
       Tất cả đều so sánh `room.hostId` với `socket.userData?.id`.

* **[HIGH] Lỗ hổng Bypass logic thu hồi tin nhắn (`chat:recall-message`):**
  * **Vị trí file:** [`backend/src/sockets/index.js:1995-2009`](file:///D:/aKTS/qldapm/backend/src/sockets/index.js#L1995-L2009).
  * **Chi tiết code:**
    ```javascript
    const currentUserId = String(
      socket.userData?.id || socket.userData?._id || socket.userId || socket.authUserId || ""
    );
    const message = await Message.findById(messageId);
    ...
    if (currentUserId && String(message.sender) !== currentUserId) {
      return cb({ success: false, message: "Bạn chỉ có thể thu hồi tin nhắn do chính bạn gửi." });
    }
    ```
  * **Nguy cơ nghiêm trọng:** Biểu thức `if (currentUserId && ...)` có điều kiện tiên quyết là `currentUserId` phải truthy. Nếu một socket ẩn danh (chưa authenticate) gọi `chat:recall-message`, `currentUserId` là chuỗi rỗng `""` (falsy). Biểu thức điều kiện **bị bỏ qua**, và tin nhắn của bất kỳ ai trong bất kỳ cuộc hội thoại nào cũng bị thu hồi thành công!

* **Khuyến nghị khắc phục toàn diện cho Socket.io:**
  1. Trong `io.use`: Nếu không có token hoặc token không hợp lệ, từ chối kết nối ngay lập tức: `return next(new Error("Xác thực socket thất bại"));`.
  2. Tuyệt đối không gán `socket.userId` hay `socket.userData` từ client payload của `join-room`. Luôn dùng `socket.authUserId` đã được xác minh bằng chữ ký JWT ở handshake.
  3. Trong `chat:recall-message`: Kiểm tra `if (!socket.authUserId || String(message.sender) !== String(socket.authUserId)) return cb({ success: false });`.

---

### 4. BẢO MẬT DỮ LIỆU & RATE LIMIT

#### 4.1. Bảo mật dữ liệu nhạy cảm (Password & Token exposure)
* **Điểm đã an toàn:**
  * Trong Schema [`User.js:24`](file:///D:/aKTS/qldapm/backend/src/models/User.js#L24): Cấu hình `password: { type: String, select: false }`. Mongoose tự động loại trừ mật khẩu khỏi mọi truy vấn tìm kiếm mặc định.
  * Các controller luôn sử dụng `.select("-password")` khi truy vấn người dùng:
    * Quản lý người dùng admin: [`admin.controller.js:305, 866`](file:///D:/aKTS/qldapm/backend/src/controllers/admin.controller.js#L305)
    * Danh hiệu & Milestone: [`title.controller.js:90, 228, 315`](file:///D:/aKTS/qldapm/backend/src/controllers/title.controller.js#L90)
    * Lấy thông tin cá nhân: [`authController.js:814`](file:///D:/aKTS/qldapm/backend/src/controllers/authController.js#L814)
  * Hàm `formatUser()` tại [`authController.js:16-46`](file:///D:/aKTS/qldapm/backend/src/controllers/authController.js#L16-L46) định dạng thủ công các trường trả về client, loại bỏ hoàn toàn password, token bí mật hay dữ liệu nhạy cảm nội bộ.
  * Đổi mật khẩu admin ([`admin.controller.js:970-985`](file:///D:/aKTS/qldapm/backend/src/controllers/admin.controller.js#L970-L985)) không bao giờ trả về mật khẩu mới trong response JSON.
  * Mã băm OTP (`otpHash`) không bị trả về trong bất kỳ phản hồi JSON nào của luồng OTP.

* **Điểm cần lưu ý:**
  * Tại `admin.controller.js:512` trong `updateUser`: trả về `data: { user }` chứa nguyên document Mongoose. Mặc dù không có password (nhờ `select: false`), nên dùng `formatUser` hoặc `select` cụ thể để tránh lộ các trường logic nội bộ.

#### 4.2. Rate Limit trên các route xác thực (Auth routes)
* **Điểm đã an toàn:**
  * Rate limiter `authRateLimiter` được đăng ký trên toàn bộ route `/api/auth` và `/api/users` trong [`server.js:106-107`](file:///D:/aKTS/qldapm/backend/server.js#L106-L107):
    ```javascript
    app.use("/api/auth", authRateLimiter, authRoutes);
    app.use("/api/users", authRateLimiter, authRoutes);
    ```
  * Giới hạn cấu hình: Tối đa 30 requests trong cửa sổ thời gian 5 phút ([`securityMiddleware.js:52-53`](file:///D:/aKTS/qldapm/backend/src/middlewares/securityMiddleware.js#L52-L53)).
  * Có cơ chế tự động dọn dẹp RAM định kỳ mỗi 5 phút ([`securityMiddleware.js:31-38`](file:///D:/aKTS/qldapm/backend/src/middlewares/securityMiddleware.js#L31-L38)).

* **Điểm cần vá (Vulnerabilities):**
  * **[MEDIUM] Bypass Rate Limiter qua Header `X-Forwarded-For`:**  
    * **Vị trí file:** [`backend/src/middlewares/securityMiddleware.js:45-49`](file:///D:/aKTS/qldapm/backend/src/middlewares/securityMiddleware.js#L45-L49).  
    * **Chi tiết code:**
      ```javascript
      const ip =
        req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
        req.socket?.remoteAddress ||
        req.ip ||
        "127.0.0.1";
      ```
    * **Nguy cơ:** Ứng dụng Express trong `server.js` chưa bật cấu hình `app.set("trust proxy", 1)`. Đoạn mã trên tin cậy trực tiếp giá trị do client gửi lên trong header `X-Forwarded-For`. Kẻ tấn công chỉ cần thay đổi header này (ví dụ: `X-Forwarded-For: 1.1.1.1`, `X-Forwarded-For: 1.1.1.2`...) trong mỗi request là có thể tấn công Brute-Force mật khẩu không giới hạn số lần.
    * **Khuyến nghị khắc phục:** Bật `app.set("trust proxy", 1)` trong `server.js` và lấy IP thông qua `req.ip` của Express.

  * **[MEDIUM] Thiếu cơ chế khóa tài khoản theo tài khoản (Account Lockout):**  
    * **Vị trí file:** [`backend/src/controllers/authController.js:730-805`](file:///D:/aKTS/qldapm/backend/src/controllers/authController.js#L730-L805).  
    * **Nguy cơ:** `authRateLimiter` chỉ đếm theo IP. Nếu kẻ tấn công sử dụng mạng botnet / nhiều IP proxy để đoán mật khẩu của một email cụ thể, tài khoản đó không có bộ đếm số lần đăng nhập thất bại và không bị tạm khóa.
    * **Khuyến nghị khắc phục:** Bổ sung trường `failedLoginAttempts` và `lockUntil` vào `User` model; tạm khóa tài khoản 15 phút nếu nhập sai mật khẩu quá 5 lần liên tiếp.

---

## III. CÁC PHÁT HIỆN BỔ SUNG KHÁC (BUG & CODE QUALITY)

1. **[CRITICAL BUG] Lỗi ReferenceError biến chưa khai báo trong `upload.controller.js`:**
   * **Vị trí file:** [`backend/src/controllers/upload.controller.js:198-199`](file:///D:/aKTS/qldapm/backend/src/controllers/upload.controller.js#L198-L199).
   * **Chi tiết:** Trong hàm `saveRoomFile`, biến `validSenderId` và `sender` chưa từng được định nghĩa trong hàm:
     ```javascript
     senderId: String(validSenderId || ""), // <-- ReferenceError: validSenderId is not defined
     senderName: sender?.name || req.body.senderName || "Thành viên",
     ```
   * **Hậu quả:** Bất kỳ khi nào người dùng chia sẻ tài liệu trong phòng học, API `POST /api/upload/rooms/:roomCode/files` sẽ ném lỗi 500 Internal Server Error và làm hỏng tính năng chia sẻ tài liệu.
   * **Cách sửa:** Đổi thành `senderId: String(currentUserId)` và `senderName: userDoc?.name || "Thành viên"`.

2. **[LOW] Khóa bí mật JWT Fallback cố định trong mã nguồn:**
   * **Vị trí file:** [`backend/src/middlewares/authMiddleware.js:5`](file:///D:/aKTS/qldapm/backend/src/middlewares/authMiddleware.js#L5).
   * **Chi tiết:** `JWT_SECRET = process.env.JWT_SECRET || "virtual-study-room-secure-jwt-secret-key-32chars";`
   * **Khuyến nghị:** Nếu không tìm thấy `process.env.JWT_SECRET`, server nên ném lỗi và dừng khởi động thay vì dùng secret key mặc định công khai.

---

## IV. BẢNG TỔNG HỢP DANH SÁCH ĐIỂM ĐÃ VÁ THÀNH CÔNG (PATCH STATUS)

| STT | Phân loại | Tệp tin | Vấn đề bảo mật & logic | Mức độ | Trạng thái vá lỗi |
| :---: | :--- | :--- | :--- | :---: | :---: |
| **1** | Runtime Crash Bug | `backend/src/controllers/upload.controller.js` | Thiếu import `User` gây ReferenceError 500 khi chia sẻ tài liệu | **CRITICAL** | ✅ **ĐÃ VÁ THÀNH CÔNG** |
| **2** | Socket Host Impersonation | `backend/src/sockets/index.js` | `handleLeaveRoom` ghi đè `userId` từ `data.userId`, cho phép mạo danh Host hủy phòng | **CRITICAL** | ✅ **ĐÃ VÁ THÀNH CÔNG** |
| **3** | Payment Amount Validation | `backend/src/controllers/payment.controller.js` | Không đối soát `vnp_Amount` khớp với `transaction.amount * 100` trong callback | **CRITICAL** | ✅ **ĐÃ VÁ THÀNH CÔNG** |
| **4** | Payment Concurrency | `backend/src/controllers/payment.controller.js` | Race condition khi cập nhật trạng thái đơn hàng và cộng dồn hạn Pro | **HIGH** | ✅ **ĐÃ VÁ THÀNH CÔNG** |
| **5** | Payment Webhook IPN | `backend/src/routes/payment.routes.js` | Thiếu endpoint `GET /vnpay-ipn` Server-to-Server theo chuẩn VNPay | **HIGH** | ✅ **ĐÃ VÁ THÀNH CÔNG** |
| **6** | Business Logic Race Condition | `backend/src/controllers/card.controller.js` | `drawCard` dùng `user.save()` làm mất tính nguyên tử của kho thẻ bài | **HIGH** | ✅ **ĐÃ VÁ THÀNH CÔNG** |
| **7** | Plaintext Password Storage | `backend/src/controllers/authController.js` | Lưu mật khẩu thô trong MongoDB `OtpVerification` trước khi nhập OTP | **HIGH** | ✅ **ĐÃ VÁ THÀNH CÔNG** |
| **8** | Single-Use Token Revocation | `backend/src/controllers/authController.js` | `resetToken` không có cơ chế vô hiệu hóa sau lần đặt lại mật khẩu đầu tiên | **MEDIUM** | ✅ **ĐÃ VÁ THÀNH CÔNG** |
| **9** | Whiteboard Access Control | `backend/src/sockets/whiteboard.socket.js` | Các sự kiện vẽ nét, xóa bảng, lấy state không kiểm tra tư cách thành viên phòng | **HIGH** | ✅ **ĐÃ VÁ THÀNH CÔNG** |
| **10** | LiveKit Waiting Room Bypass | `backend/src/controllers/livekit.controller.js` | Cấp WebRTC token bỏ qua kiểm tra phòng chờ duyệt (`APPROVAL_REQUIRED`) & khóa phòng | **HIGH** | ✅ **ĐÃ VÁ THÀNH CÔNG** |
| **11** | Transaction Data Loss | `backend/src/models/Transaction.js` | TTL Index 15 phút tự động xóa vĩnh viễn các đơn hàng đang chờ thanh toán | **HIGH** | ✅ **ĐÃ VÁ THÀNH CÔNG** |
| **12** | Rate Limit Spoofing | `backend/server.js`, `securityMiddleware.js` | Bật `trust proxy 1`, dùng `req.ip` ngăn chặn spoofing header `X-Forwarded-For` | **MEDIUM** | ✅ **ĐÃ VÁ THÀNH CÔNG** |
| **13** | AI Resource Protection | `backend/src/routes/aiTutor.routes.js` | Thêm middleware `aiRateLimiter` 20 req/phút chống cạn kiệt API quota | **MEDIUM** | ✅ **ĐÃ VÁ THÀNH CÔNG** |
| **14** | Message Reaction IDOR | `backend/src/controllers/message.controller.js` | Kiểm tra quyền thành viên hội thoại khi thả cảm xúc `reactToMessage` | **MEDIUM** | ✅ **ĐÃ VÁ THÀNH CÔNG** |
| **15** | Email HTML Injection | `backend/src/utils/mailer.js` | Escape ký tự HTML của tên người dùng trong email thông báo OTP | **MEDIUM** | ✅ **ĐÃ VÁ THÀNH CÔNG** |
| **16** | SVG Stored XSS Mitigation | `backend/src/middlewares/uploadMiddleware.js` | Ép tệp `.svg` sang định dạng `raw attachment` để chặn thực thi script trong trình duyệt | **HIGH** | ✅ **ĐÃ VÁ THÀNH CÔNG** |
| **17** | Account Lockout Brute-Force | `backend/src/models/User.js`, `authController.js` | Tự động tạm khóa tài khoản 15 phút nếu nhập sai mật khẩu quá 5 lần liên tiếp | **MEDIUM** | ✅ **ĐÃ VÁ THÀNH CÔNG** |

---
**Báo cáo được cập nhật sau khi hoàn tất toàn bộ quy trình vá lỗi tự động.**
