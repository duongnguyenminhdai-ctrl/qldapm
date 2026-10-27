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
  UserMinus,
  Mic,
  Trash2,
  Sparkles,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { messagesApi, uploadApi, friendsApi } from "@/lib/api";
import { connectSocket } from "@/lib/socket";
import { ICON_STROKE } from "@/lib/constants";
import FileItemCard from "@/components/files/FileItemCard";
import FileUploadBar from "@/components/files/FileUploadBar";
import ImageLightboxModal from "@/components/files/ImageLightboxModal";
import { VAIChatSection } from "@/components/ai/VAIChatSection";
import { UnfriendConfirmModal } from "@/components/social/UnfriendConfirmModal";
import { DeleteConversationConfirmModal } from "@/components/social/DeleteConversationConfirmModal";
import {
  VoiceRecorder,
  AudioPlayer,
  EmojiPickerPopover,
  MessageReactions,
  ReactionBadge,
} from "@/components/chat";
import { cn } from "@/lib/utils";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useConfirm } from "@/context/ConfirmContext";

export function MiniChatBox({ conversation, currentUser, onClose, onOpenPricing }) {
  const confirm = useConfirm();
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
  const [isUnfriendModalOpen, setIsUnfriendModalOpen] = useState(false);
  const [isUnfriending, setIsUnfriending] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
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

  const handleConfirmUnfriend = async () => {
    const friendId = partner?._id || partner?.id;
    if (!friendId) return;

    setIsUnfriending(true);
    try {
      await friendsApi.unfriend(friendId);
      window.dispatchEvent(
        new CustomEvent("friend:removed", { detail: { friendId } })
      );
      setIsUnfriendModalOpen(false);
    } catch (err) {
      console.error("Lỗi khi hủy kết bạn:", err);
    } finally {
      setIsUnfriending(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!conversationId) return;
    setIsDeleting(true);
    try {
      await messagesApi.deleteConversation(conversationId);
      setIsDeleteModalOpen(false);
      onClose?.();
    } catch (err) {
      console.error("Lỗi xóa cuộc trò chuyện:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const title = isGroup ? conversation.name || "Nhóm trò chuyện" : partner?.name || "Bạn bè";
  const isOnline = !isGroup ? partner?.isOnline : false;

  // Scroll xuống đáy (ưu tiên scroll trực tiếp trên container để tránh layout shift toàn trang)
  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      const msgList = chatContainerRef.current.querySelector(".overflow-y-auto");
      if (msgList) {
        msgList.scrollTo({ top: msgList.scrollHeight, behavior: "smooth" });
        return;
      }
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  // Load tin nhắn ban đầu
  useEffect(() => {
    if (!conversationId || conversation?.isAi) return;

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

      const handleReactionUpdated = (payload) => {
        const targetId = String(payload?.messageId || "");
        const newReactions = payload?.reactions;
        if (!targetId || !newReactions) return;
        setMessages((prev) =>
          prev.map((m) =>
            String(m._id || m.id) === targetId
              ? { ...m, reactions: newReactions }
              : m
          )
        );
      };

      socket.on("chat:message", handleIncomingMessage);
      socket.on("message:new", handleIncomingMessage);
      socket.on("new_voice_message", handleIncomingMessage);
      socket.on("chat:message-revoked", handleMessageRevoked);
      socket.on("chat:message-recalled", handleMessageRevoked);
      socket.on("message_reaction_updated", handleReactionUpdated);
      socket.on("chat:message-reaction-updated", handleReactionUpdated);
      socket.on("message:reaction", handleReactionUpdated);

      return () => {
        isSubscribed = false;
        socket.off("connect", joinRoomAndAuth);
        socket.emit("conversation:leave", { conversationId });
        socket.off("chat:message", handleIncomingMessage);
        socket.off("message:new", handleIncomingMessage);
        socket.off("new_voice_message", handleIncomingMessage);
        socket.off("chat:message-revoked", handleMessageRevoked);
        socket.off("chat:message-recalled", handleMessageRevoked);
        socket.off("message_reaction_updated", handleReactionUpdated);
        socket.off("chat:message-reaction-updated", handleReactionUpdated);
        socket.off("message:reaction", handleReactionUpdated);
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
      confirm.alert("Dung lượng file tối đa là 15MB.");
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

  // Gửi tin nhắn thoại (Voice Message)
  const handleSendVoice = async ({ file, duration }) => {
    if (!conversationId || !file) return;
    try {
      const data = await uploadApi.uploadFile(file);
      const audioUrl =
        data?.fileUrl ||
        (data?.data?.fileUrl
          ? data.data.fileUrl
          : data?.data?.url || data?.url);
      if (!audioUrl) throw new Error("Không nhận được URL âm thanh sau khi tải lên.");

      const payload = {
        type: "audio",
        audioUrl,
        duration: Math.round(duration || 1),
        text: "",
      };

      const res = await messagesApi.sendMessage(conversationId, payload);
      if (res?.data?.message) {
        setMessages((prev) => {
          const mId = res.data.message._id;
          if (prev.some((m) => String(m._id || m.id) === String(mId))) return prev;
          return [...prev, res.data.message];
        });
        setTimeout(scrollToBottom, 50);
      }
      setIsRecordingVoice(false);
    } catch (err) {
      console.error("Lỗi gửi tin nhắn thoại:", err);
      confirm.alert(err.message || "Gửi tin nhắn thoại thất bại.");
    }
  };

  // Thả hoặc hủy biểu tượng cảm xúc (Emoji reactions)
  const handleReactMessage = async (messageId, emoji) => {
    if (!messageId || !emoji) return;
    const currentUserId = String(currentUser?._id || currentUser?.id);

    // Cập nhật lạc quan giao diện (Optimistic update)
    setMessages((prev) =>
      prev.map((m) => {
        if (String(m._id || m.id) !== String(messageId)) return m;
        const reactions = [...(m.reactions || [])];
        const existingIdx = reactions.findIndex(
          (r) => String(r.userId?._id || r.userId?.id || r.userId) === currentUserId
        );

        if (existingIdx > -1) {
          if (reactions[existingIdx].emoji === emoji) {
            reactions.splice(existingIdx, 1);
          } else {
            reactions[existingIdx] = {
              ...reactions[existingIdx],
              emoji,
              userId: currentUser,
              createdAt: new Date(),
            };
          }
        } else {
          reactions.push({
            emoji,
            userId: currentUser,
            createdAt: new Date(),
          });
        }
        return { ...m, reactions };
      })
    );

    try {
      const res = await messagesApi.reactMessage(messageId, emoji);
      if (res?.data?.reactions) {
        setMessages((prev) =>
          prev.map((m) =>
            String(m._id || m.id) === String(messageId)
              ? { ...m, reactions: res.data.reactions }
              : m
          )
        );
      }
    } catch (err) {
      console.error("Lỗi thả cảm xúc tin nhắn:", err);
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

  if (conversation?.isAi) {
    return (
      <div
        className={cn(
          "fixed z-50 flex flex-col border border-amber-500/30 bg-[#16120f]/98 shadow-2xl backdrop-blur-md transition-all duration-200 overflow-hidden",
          "w-[94vw] max-h-[85dvh] mx-auto rounded-2xl inset-x-0 bottom-2.5 sm:inset-x-auto sm:right-6 sm:bottom-0 sm:w-96 sm:mx-0 sm:rounded-b-none",
          isMinimized ? "h-12" : "h-[80vh] sm:h-[30rem]"
        )}
      >
        {isMinimized ? (
          <div className="flex h-12 items-center justify-between border-b border-amber-500/20 px-3.5 bg-gradient-to-r from-amber-500/10 via-transparent to-transparent">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative shrink-0">
                <div className="w-7 h-7 rounded-full p-[1.5px] bg-gradient-to-tr from-amber-400 via-rose-500 to-cyan-400 shadow-[0_0_8px_rgba(245,158,11,0.35)]">
                  <div className="w-full h-full rounded-full bg-[#181310] flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300 drop-shadow-[0_0_4px_rgba(251,191,36,0.85)]" />
                  </div>
                </div>
                <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full ring-1 ring-zinc-950 bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.8)]" />
              </div>
              <div className="min-w-0 flex-1 flex items-center gap-1.5">
                <p className="truncate text-xs font-serif font-bold text-amber-200">V AI</p>
                <span className="px-1.5 py-0.2 rounded text-[8px] font-mono font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-400/40">
                  AI Agent
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsMinimized(false)}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-800 hover:text-stone-100 cursor-pointer"
                title="Mở rộng cửa sổ"
              >
                <Minus className="h-3.5 w-3.5" strokeWidth={ICON_STROKE} />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-800 hover:text-stone-100 cursor-pointer"
                title="Đóng cửa sổ"
              >
                <X className="h-3.5 w-3.5" strokeWidth={ICON_STROKE} />
              </button>
            </div>
          </div>
        ) : (
          <VAIChatSection
            user={currentUser}
            onOpenPricing={onOpenPricing}
            onClose={onClose}
            headerActions={
              <button
                type="button"
                onClick={() => setIsMinimized(true)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800/80 transition-colors cursor-pointer"
                title="Thu nhỏ cửa sổ"
                aria-label="Thu nhỏ cửa sổ"
              >
                <Minus className="w-4 h-4" />
              </button>
            }
            className="flex-1 min-h-0 border-0 rounded-2xl sm:rounded-b-none"
          />
        )}
      </div>
    );
  }

  return (
    <div
      ref={chatContainerRef}
      onPaste={handlePaste}
      className={cn(
        "fixed z-50 flex flex-col border border-zinc-800/80 bg-zinc-950/95 shadow-2xl backdrop-blur-sm transition-all duration-200",
        "w-[94vw] max-h-[85dvh] mx-auto rounded-2xl inset-x-0 bottom-2.5 sm:inset-x-auto sm:right-6 sm:bottom-0 sm:w-96 sm:mx-0 sm:rounded-b-none",
        isMinimized ? "h-12" : "h-[80vh] sm:h-[28rem]"
      )}
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
            type="button"
            onClick={() => setIsDeleteModalOpen(true)}
            className="rounded-lg p-1 text-zinc-400 hover:bg-rose-950/40 hover:text-rose-400 transition-colors"
            title="Xóa cuộc trò chuyện này"
            aria-label="Xóa cuộc trò chuyện"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={ICON_STROKE} />
          </button>
          {!isGroup && partner && (
            <button
              type="button"
              onClick={() => setIsUnfriendModalOpen(true)}
              className="rounded-lg p-1 text-zinc-400 hover:bg-rose-950/40 hover:text-rose-400 transition-colors"
              title={`Hủy kết bạn với ${partner.name || "người dùng"}`}
              aria-label="Hủy kết bạn"
            >
              <UserMinus className="h-3.5 w-3.5" strokeWidth={ICON_STROKE} />
            </button>
          )}
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
          <div className="overflow-y-auto flex-1 p-3 space-y-2.5">
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

                const isAudio =
                  msg.type === "audio" ||
                  Boolean(msg.audioUrl) ||
                  msg.fileType?.startsWith("audio/");

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

                    <div className="flex items-center gap-1.5 max-w-[88%] relative">
                      {/* Nút thu hồi & nút Thả cảm xúc */}
                      <div className="flex items-center gap-0.5 shrink-0">
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
                        <MessageReactions
                          message={msg}
                          currentUserId={currentUser?._id || currentUser?.id}
                          onReact={(emoji) => handleReactMessage(msg._id || msg.id, emoji)}
                          isMine={isMe}
                          canReact={!isRevoked}
                        />
                      </div>

                      {/* Bong bóng tin nhắn */}
                      {isAudio ? (
                        <AudioPlayer
                          audioUrl={msg.audioUrl || msg.fileUrl}
                          duration={msg.duration}
                          isMine={isMe}
                        />
                      ) : (
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
                          {(msg.text || msg.content) && (
                            <p className={`px-1 ${msg.fileUrl || msg.image ? "pt-1" : ""}`}>
                              {msg.text || msg.content}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Huy hiệu cảm xúc (Reaction Badge) */}
                    {msg.reactions && msg.reactions.length > 0 && (
                      <div className={`mt-0.5 ${isMe ? "mr-1 self-end" : "ml-1 self-start"}`}>
                        <ReactionBadge
                          reactions={msg.reactions}
                          currentUserId={currentUser?._id || currentUser?.id}
                          onReact={(emoji) => handleReactMessage(msg._id || msg.id, emoji)}
                        />
                      </div>
                    )}

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
            fileName={attachedFile?.name || uploadedFileData?.fileName}
            fileSize={attachedFile?.size || uploadedFileData?.fileSize}
            fileType={attachedFile?.type || uploadedFileData?.fileType}
            uploading={uploadingFile}
            progress={uploadProgress}
            uploadedData={uploadedFileData}
            error={uploadError}
            onRemove={handleRemoveFile}
            className="mx-2 mb-1.5"
          />

          {/* Input form */}
          {isRecordingVoice ? (
            <div className="border-t border-zinc-800/60 p-2 pb-[env(safe-area-inset-bottom,1.5rem)] sm:pb-2 bg-zinc-950/80">
              <VoiceRecorder
                onSend={handleSendVoice}
                onCancel={() => setIsRecordingVoice(false)}
                className="w-full"
              />
            </div>
          ) : (
            <form
              onSubmit={handleSend}
              className="flex items-center gap-1.5 border-t border-zinc-800/60 p-2 pb-[env(safe-area-inset-bottom,1.5rem)] sm:pb-2 bg-zinc-950/80 relative z-20"
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

              {/* Nút ghi âm tin nhắn thoại */}
              <button
                type="button"
                onClick={() => setIsRecordingVoice(true)}
                title="Ghi âm tin nhắn thoại"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-amber-400 transition"
              >
                <Mic className="h-4 w-4" strokeWidth={ICON_STROKE} />
              </button>

              {/* Emoji Picker Popover */}
              <EmojiPickerPopover
                onSelect={(emoji) => setText((prev) => prev + emoji)}
                triggerClassName="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-amber-400 transition"
                align="left"
                popoverClassName="-left-14 sm:-left-16"
              />

              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onFocus={() => {
                  if (typeof window !== "undefined") {
                    window.scrollTo(0, 0);
                    document.documentElement.scrollTop = 0;
                    document.body.scrollTop = 0;
                  }
                }}
                placeholder={
                  attachedFile || uploadedFileData
                    ? "Thêm ghi chú cho tệp đính kèm..."
                    : "Nhập tin nhắn (Ctrl+V để dán ảnh)..."
                }
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
          )}

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

      {/* Modal xác nhận hủy kết bạn */}
      <UnfriendConfirmModal
        isOpen={isUnfriendModalOpen}
        onClose={() => !isUnfriending && setIsUnfriendModalOpen(false)}
        onConfirm={handleConfirmUnfriend}
        friendName={partner?.name || "người dùng này"}
        isLoading={isUnfriending}
      />

      {/* Modal xác nhận xóa cuộc trò chuyện */}
      <DeleteConversationConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => !isDeleting && setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        conversationName={title ? `cuộc trò chuyện với ${title}` : "cuộc trò chuyện này"}
        isLoading={isDeleting}
      />
    </div>
  );
}

