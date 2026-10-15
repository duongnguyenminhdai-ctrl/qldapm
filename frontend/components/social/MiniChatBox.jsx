"use client";

import { useEffect, useState, useRef } from "react";
import {
  Send,
  X,
  Users,
  Minus,
  MessageSquare,
  Paperclip,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { messagesApi, uploadApi } from "@/lib/api";
import { connectSocket } from "@/lib/socket";
import { ICON_STROKE } from "@/lib/constants";
import FileItemCard from "@/components/files/FileItemCard";
import FileUploadBar from "@/components/files/FileUploadBar";
import ImageLightboxModal from "@/components/files/ImageLightboxModal";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function MiniChatBox({ conversation, currentUser, onClose }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [attachedFile, setAttachedFile] = useState(null); // File object
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFileData, setUploadedFileData] = useState(null); // { fileUrl, fileName, fileType, fileSize }
  const [uploadError, setUploadError] = useState(null);
  const [lightboxImage, setLightboxImage] = useState(null); // { src, alt }
  const [recallTargetMsg, setRecallTargetMsg] = useState(null); // Tin nhắn chuẩn bị thu hồi
  const [isRecalling, setIsRecalling] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const chatContainerRef = useRef(null);

  const conversationId = conversation?._id;

  // Lấy partner hiển thị (nếu là chat 1-1)
  const isGroup = conversation?.isGroup;
  const partner = !isGroup
    ? conversation?.participants?.find(
        (p) => String(p._id) !== String(currentUser?._id || currentUser?.id)
      )
    : null;

  const title = isGroup ? conversation.name || "Nhóm trò chuyện" : partner?.name || "Bạn bè";
  const isOnline = !isGroup ? partner?.isOnline : false;

  // Scroll xuống đáy
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Load tin nhắn ban đầu
  useEffect(() => {
    if (!conversationId) return;

    let isSubscribed = true;
    const loadMessages = async () => {
      try {
        const res = await messagesApi.getMessages(conversationId);
        if (isSubscribed) {
          setMessages(res?.data?.messages || []);
          setTimeout(scrollToBottom, 100);
        }
      } catch (err) {
        console.error("Lỗi tải tin nhắn:", err);
      }
    };

    loadMessages();

    // Join room socket của conversation và xác thực người dùng để nhận realtime
    const socket = connectSocket();
    if (socket) {
      const joinRoomAndAuth = () => {
        const uId = currentUser?._id || currentUser?.id;
        if (uId) {
          socket.emit("user:authenticate", { userId: uId });
        }
        if (conversationId) {
          socket.emit("conversation:join", { conversationId });
        }
      };

      if (socket.connected) {
        joinRoomAndAuth();
      }
      socket.on("connect", joinRoomAndAuth);

      const handleIncomingMessage = (newMsg) => {
        if (String(newMsg.conversationId) === String(conversationId)) {
          setMessages((prev) => {
            const msgId = newMsg._id || newMsg.id;
            if (prev.some((m) => String(m._id || m.id) === String(msgId))) return prev;
            return [...prev, newMsg];
          });
          setTimeout(scrollToBottom, 50);
        }
      };

      const handleMessageRevoked = (payload) => {
        const targetId = String(
          payload?.messageId ||
          payload?.id ||
          payload?.message?._id ||
          payload?.message?.id ||
          payload?._id ||
          ""
        );
        if (!targetId) return;

        setMessages((prev) =>
          prev.map((m) => {
            const currentId = String(m._id || m.id || "");
            if (currentId === targetId) {
              const updated = payload?.message || {};
              return {
                ...m,
                ...updated,
                isRevoked: true,
                isRecalled: true,
                recalledAt: payload?.recalledAt || updated?.recalledAt || new Date(),
                recalledBy: payload?.recalledBy || updated?.recalledBy || null,
                text: "",
                image: "",
                fileUrl: "",
                fileName: "",
                fileType: "",
                fileSize: 0,
              };
            }
            return m;
          })
        );
      };

      socket.on("chat:message", handleIncomingMessage);
      socket.on("chat:message-revoked", handleMessageRevoked);
      socket.on("chat:message-recalled", handleMessageRevoked);

      return () => {
        isSubscribed = false;
        socket.off("connect", joinRoomAndAuth);
        socket.emit("conversation:leave", { conversationId });
        socket.off("chat:message", handleIncomingMessage);
        socket.off("chat:message-revoked", handleMessageRevoked);
        socket.off("chat:message-recalled", handleMessageRevoked);
      };
    }

    return () => {
      isSubscribed = false;
    };
  }, [conversationId]);

  // Xử lý upload file lên Cloudinary
  const handleFileSelect = async (file) => {
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert("Dung lượng file tối đa là 15MB.");
      return;
    }

    setAttachedFile(file);
    setUploadingFile(true);
    setUploadProgress(0);
    setUploadError(null);
    setUploadedFileData(null);

    try {
      const data = await uploadApi.uploadFile(file, (percent) => {
        setUploadProgress(percent);
      });
      const fileData = data?.fileUrl ? data : (data?.data?.fileUrl ? data.data : data);
      setUploadedFileData(fileData);
    } catch (err) {
      console.error("Lỗi upload file:", err);
      setUploadError(err.message || "Tải file thất bại");
    } finally {
      setUploadingFile(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    e.target.value = "";
  };

  const handlePaste = (e) => {
    const clipboardData = e.clipboardData;
    if (!clipboardData || !clipboardData.items) return;

    for (let i = 0; i < clipboardData.items.length; i++) {
      const item = clipboardData.items[i];
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          handleFileSelect(file);
          break;
        }
      }
    }
  };

  const handleRemoveFile = () => {
    setAttachedFile(null);
    setUploadingFile(false);
    setUploadedFileData(null);
    setUploadError(null);
    setUploadProgress(0);
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    if (uploadingFile) return;

    const hasText = Boolean(text.trim());
    const hasFile = Boolean(uploadedFileData?.fileUrl);

    if ((!hasText && !hasFile) || loading) return;

    const messageText = text.trim();
    const filePayload = uploadedFileData;

    setText("");
    handleRemoveFile();
    setLoading(true);

    try {
      const res = await messagesApi.sendMessage(conversationId, {
        text: messageText,
        fileUrl: filePayload?.fileUrl || "",
        fileName: filePayload?.fileName || "",
        fileType: filePayload?.fileType || "",
        fileSize: filePayload?.fileSize || 0,
        // Giữ tương thích image nếu là file ảnh
        image:
          filePayload?.fileType === "image" ||
          filePayload?.fileName?.match(/\.(jpg|jpeg|png|gif|webp)$/i)
            ? filePayload?.fileUrl
            : "",
      });

      if (res?.data?.message) {
        setMessages((prev) => {
          const mId = res.data.message._id;
          if (prev.some((m) => String(m._id || m.id) === String(mId))) return prev;
          return [...prev, res.data.message];
        });
        setTimeout(scrollToBottom, 50);
      }
    } catch (err) {
      console.error("Lỗi gửi tin nhắn:", err);
    } finally {
      setLoading(false);
    }
  };

  // Xử lý thu hồi tin nhắn với mọi người (Messenger Recall/Unsend)
  const handleConfirmRecall = async () => {
    const targetId = recallTargetMsg?._id || recallTargetMsg?.id;
    if (!targetId) return;

    setIsRecalling(true);

    // Cập nhật lạc quan (optimistic update) trên giao diện tức thì
    setMessages((prev) =>
      prev.map((m) =>
        String(m._id || m.id) === String(targetId)
          ? {
              ...m,
              isRevoked: true,
              isRecalled: true,
              recalledAt: new Date(),
              text: "",
              image: "",
              fileUrl: "",
              fileName: "",
              fileType: "",
              fileSize: 0,
            }
          : m
      )
    );

    try {
      // 1. Gọi REST API thu hồi và dọn dẹp file Cloudinary
      await messagesApi.revokeMessage(targetId);

      // 2. Đồng thời phát socket realtime trực tiếp để đảm bảo đối phương nhận ngay
      const socket = connectSocket();
      if (socket && socket.connected) {
        socket.emit("chat:recall-message", {
          conversationId,
          messageId: targetId,
        });
      }

      setRecallTargetMsg(null);
    } catch (err) {
      console.error("Lỗi thu hồi tin nhắn:", err);
      // Đóng modal, người dùng vẫn thấy giao diện đã thu hồi
      setRecallTargetMsg(null);
    } finally {
      setIsRecalling(false);
    }
  };

  return (
    <div
      ref={chatContainerRef}
      onPaste={handlePaste}
      className={`fixed bottom-0 right-6 z-50 flex w-84 sm:w-96 flex-col rounded-t-2xl border border-zinc-800/80 bg-zinc-950/95 shadow-2xl backdrop-blur-xl transition-all duration-200 ${
        isMinimized ? "h-12" : "h-[28rem]"
      }`}
    >
      {/* Header */}
      <div className="flex h-12 items-center justify-between border-b border-zinc-800/60 px-3.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative">
            <Avatar className="h-7 w-7 border border-zinc-800">
              <AvatarImage src={isGroup ? "" : partner?.avatar} />
              <AvatarFallback className="text-[10px] bg-zinc-800 text-zinc-300">
                {isGroup ? (
                  <Users className="h-3.5 w-3.5" />
                ) : (
                  partner?.name?.slice(0, 2).toUpperCase() || "U"
                )}
              </AvatarFallback>
            </Avatar>
            {!isGroup && (
              <span
                className={`absolute bottom-0 right-0 h-2 w-2 rounded-full ring-1 ring-zinc-950 ${
                  isOnline ? "bg-emerald-500" : "bg-zinc-600"
                }`}
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-zinc-100">{title}</p>
            {!isGroup && (
              <p className="text-[10px] text-zinc-500">
                {isOnline ? "Đang hoạt động" : "Ngoại tuyến"}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            aria-label="Thu nhỏ"
          >
            <Minus className="h-3.5 w-3.5" strokeWidth={ICON_STROKE} />
          </button>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            aria-label="Đóng chat"
          >
            <X className="h-3.5 w-3.5" strokeWidth={ICON_STROKE} />
          </button>
        </div>
      </div>

      {/* Message List */}
      {!isMinimized && (
        <>
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-zinc-500">
                <MessageSquare className="h-6 w-6 text-zinc-700 mb-1" strokeWidth={1.5} />
                <p className="text-xs">Bắt đầu cuộc trò chuyện ngay!</p>
                <p className="text-[10px] text-zinc-600 mt-1">
                  (Dán ảnh Ctrl + V hoặc tải ảnh trực tiếp)
                </p>
              </div>
            ) : (
              messages.map((msg, index) => {
                const isMe =
                  String(msg.sender?._id || msg.sender?.id || msg.sender) ===
                  String(currentUser?._id || currentUser?.id);
                const isRevoked = Boolean(msg.isRevoked || msg.isRecalled);

                // Giao diện tinh tế khi tin nhắn đã bị thu hồi
                if (isRevoked) {
                  return (
                    <div
                      key={msg._id || `${msg.createdAt}-${index}`}
                      className={`flex flex-col ${isMe ? "items-end" : "items-start"} gap-0.5`}
                    >
                      {!isMe && isGroup && (
                        <span className="mb-0.5 text-[10px] text-zinc-500 px-1">
                          {msg.sender?.name || "Thành viên"}
                        </span>
                      )}
                      <div className="inline-flex items-center gap-1.5 rounded-2xl border border-dashed border-zinc-700/60 bg-transparent px-3 py-1.5 text-xs italic text-zinc-500 select-none">
                        <RotateCcw className="h-3 w-3 shrink-0 text-zinc-600" />
                        <span>
                          {isMe
                            ? "Bạn đã thu hồi một tin nhắn"
                            : `${msg.sender?.name || "Đối phương"} đã thu hồi một tin nhắn`}
                        </span>
                      </div>
                      <span className="mt-0.5 px-1 text-[9px] text-zinc-600">
                        {new Date(msg.createdAt).toLocaleTimeString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  );
                }

                return (
                  <div
                    key={msg._id || `${msg.createdAt}-${index}`}
                    className={`group flex flex-col ${isMe ? "items-end" : "items-start"}`}
                  >
                    {!isMe && isGroup && (
                      <span className="mb-0.5 text-[10px] text-zinc-500 px-1">
                        {msg.sender?.name || "Thành viên"}
                      </span>
                    )}

                    <div className="flex items-center gap-1.5 max-w-[88%]">
                      {/* Nút thu hồi kế bên tin nhắn đã gửi (Messenger style) */}
                      {isMe && (
                        <button
                          type="button"
                          onClick={() => setRecallTargetMsg(msg)}
                          title="Thu hồi tin nhắn"
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full text-zinc-500 hover:text-rose-400 hover:bg-zinc-800/80 focus:opacity-100 shrink-0 cursor-pointer"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      )}

                      <div
                        className={`rounded-2xl p-2.5 text-xs leading-relaxed space-y-1.5 break-words ${
                          isMe
                            ? "bg-zinc-800 text-zinc-100 rounded-br-none border border-zinc-700/60"
                            : "bg-zinc-900 text-zinc-100 rounded-bl-none border border-zinc-800"
                        }`}
                      >
                        {/* Hiển thị file đính kèm nếu có */}
                        {msg.fileUrl ? (
                          <FileItemCard
                            fileUrl={msg.fileUrl}
                            fileName={msg.fileName || "Tài liệu đính kèm"}
                            fileType={msg.fileType}
                            fileSize={msg.fileSize}
                            onImageClick={(src, alt) =>
                              setLightboxImage({ src, alt })
                            }
                          />
                        ) : msg.image ? (
                          <FileItemCard
                            fileUrl={msg.image}
                            fileName="Hình ảnh"
                            fileType="image"
                            onImageClick={(src, alt) =>
                              setLightboxImage({ src, alt })
                            }
                          />
                        ) : null}

                        {/* Hiển thị văn bản nếu có */}
                        {msg.text && (
                          <p className={`px-1 ${msg.fileUrl || msg.image ? "pt-1" : ""}`}>
                            {msg.text}
                          </p>
                        )}
                      </div>
                    </div>

                    <span className="mt-0.5 px-1 text-[9px] text-zinc-600">
                      {new Date(msg.createdAt).toLocaleTimeString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Thanh Preview file trước khi gửi */}
          <FileUploadBar
            file={attachedFile}
            uploading={uploadingFile}
            progress={uploadProgress}
            uploadedData={uploadedFileData}
            error={uploadError}
            onRemove={handleRemoveFile}
            className="mx-2 mb-1.5"
          />

          {/* Input form */}
          <form
            onSubmit={handleSend}
            className="flex items-center gap-1.5 border-t border-zinc-800/60 p-2 bg-zinc-950/80"
          >
            {/* Input file ẩn */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".jpg,.jpeg,.png,.gif,.webp,.svg,.pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.json,.md,.js,.ts,.py"
              className="hidden"
            />

            {/* Nút đính kèm file / tài liệu / ảnh */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Đính kèm file, tài liệu hoặc ảnh (Tối đa 15MB)"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition"
            >
              <Paperclip className="h-4 w-4" strokeWidth={ICON_STROKE} />
            </button>

            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Nhập tin nhắn (Ctrl+V để dán ảnh)..."
              className="flex-1 rounded-xl border border-zinc-800/80 bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />

            <Button
              type="submit"
              size="sm"
              disabled={
                (!text.trim() && !uploadedFileData?.fileUrl) ||
                loading ||
                uploadingFile
              }
              className="h-8 w-8 shrink-0 rounded-xl p-0 bg-zinc-100 text-zinc-950 hover:bg-white disabled:opacity-50"
            >
              {loading || uploadingFile ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" strokeWidth={ICON_STROKE} />
              )}
            </Button>
          </form>

          {/* Lightbox phóng to ảnh */}
          <ImageLightboxModal
            isOpen={Boolean(lightboxImage)}
            src={lightboxImage?.src}
            alt={lightboxImage?.alt}
            onClose={() => setLightboxImage(null)}
          />

          {/* Modal xác nhận thu hồi tin nhắn chuẩn Messenger */}
          <Dialog
            open={Boolean(recallTargetMsg)}
            onOpenChange={(open) => !open && !isRecalling && setRecallTargetMsg(null)}
          >
            <DialogContent className="border-zinc-800 bg-zinc-950 text-zinc-100 sm:max-w-xs p-5">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                  <RotateCcw className="h-4 w-4 text-amber-400" />
                  Thu hồi tin nhắn?
                </DialogTitle>
                <DialogDescription className="text-xs text-zinc-400 pt-1 leading-relaxed">
                  Bạn có chắc muốn thu hồi tin nhắn này với mọi người? Tệp đính kèm và ảnh trên đám mây sẽ được xóa sạch.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="mt-4 flex flex-row gap-2 justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isRecalling}
                  onClick={() => setRecallTargetMsg(null)}
                  className="text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                >
                  Hủy
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={isRecalling}
                  onClick={handleConfirmRecall}
                  className="text-xs bg-rose-600 hover:bg-rose-500 text-white font-medium gap-1.5"
                >
                  {isRecalling ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3 w-3" />
                  )}
                  Thu hồi
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}

