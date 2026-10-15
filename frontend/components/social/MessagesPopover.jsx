"use client";

import { useEffect, useState, useRef } from "react";
import {
  MessageSquare,
  Search,
  Plus,
  Users,
  Check,
  Loader2,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { messagesApi, friendsApi } from "@/lib/api";
import { connectSocket } from "@/lib/socket";
import { ICON_STROKE } from "@/lib/constants";

export function MessagesPopover({ user, onSelectConversation }) {
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [friends, setFriends] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);

  // Modal tạo chat / nhóm mới
  const [newChatModalOpen, setNewChatModalOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedFriendIds, setSelectedFriendIds] = useState([]);
  const [creatingGroup, setCreatingGroup] = useState(false);

  const popoverRef = useRef(null);

  // Load danh sách hội thoại và bạn bè
  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [convRes, friendRes] = await Promise.all([
        messagesApi.getConversations(),
        friendsApi.list(),
      ]);
      setConversations(convRes?.data?.conversations || []);
      setFriends(friendRes?.data?.friends || []);
    } catch (err) {
      console.warn("Lỗi tải hội thoại:", err?.message || err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Lắng nghe socket realtime cập nhật status bạn bè và tin nhắn mới
  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return;

    if (user) {
      socket.emit("user:authenticate", { userId: user.id || user._id });
    }

    // Trạng thái online/offline của bạn bè thay đổi
    const handleFriendStatus = ({ userId, isOnline, lastSeen }) => {
      setFriends((prev) =>
        prev.map((f) =>
          String(f._id) === String(userId) ? { ...f, isOnline, lastSeen } : f
        )
      );

      setConversations((prev) =>
        prev.map((conv) => ({
          ...conv,
          participants: conv.participants.map((p) =>
            String(p._id) === String(userId) ? { ...p, isOnline, lastSeen } : p
          ),
        }))
      );
    };

    // Có tin nhắn mới trong hội thoại bất kỳ
    const handleConversationUpdated = ({ conversationId, lastMessage }) => {
      setConversations((prev) => {
        const foundIndex = prev.findIndex((c) => String(c._id) === String(conversationId));
        if (foundIndex === -1) {
          // Tải lại nếu chưa có
          loadData();
          return prev;
        }
        const updated = [...prev];
        updated[foundIndex] = {
          ...updated[foundIndex],
          lastMessage,
          updatedAt: new Date(),
        };
        // Đẩy lên đầu
        const [target] = updated.splice(foundIndex, 1);
        return [target, ...updated];
      });
    };

    // Cuộc hội thoại mới được tạo
    const handleNewConversation = (conv) => {
      setConversations((prev) => {
        const id = conv._id || conv.id;
        if (prev.some((c) => String(c._id || c.id) === String(id))) return prev;
        return [conv, ...prev];
      });
    };

    // Có lời mời được chấp nhận qua socket -> thêm vào danh sách bạn bè
    const handleFriendAccepted = ({ friend }) => {
      if (!friend) return;
      const fId = friend._id || friend.id;
      setFriends((prev) => {
        if (prev.some((f) => String(f._id || f.id) === String(fId))) return prev;
        return [friend, ...prev];
      });
      // Tải lại danh sách để đồng bộ toàn bộ
      loadData();
    };

    socket.on("friend:status-change", handleFriendStatus);
    socket.on("chat:conversation-updated", handleConversationUpdated);
    socket.on("chat:conversation-created", handleNewConversation);
    socket.on("friend:accepted", handleFriendAccepted);

    // Lắng nghe sự kiện kết bạn nội bộ từ NotificationBell trên cùng tab
    const handleLocalFriendAccepted = (e) => {
      const friend = e.detail?.friend;
      if (friend) {
        const fId = friend._id || friend.id;
        setFriends((prev) => {
          if (prev.some((f) => String(f._id || f.id) === String(fId))) return prev;
          return [friend, ...prev];
        });
        loadData();
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("vsr:friend-accepted", handleLocalFriendAccepted);
    }

    return () => {
      socket.off("friend:status-change", handleFriendStatus);
      socket.off("chat:conversation-updated", handleConversationUpdated);
      socket.off("chat:conversation-created", handleNewConversation);
      socket.off("friend:accepted", handleFriendAccepted);
      if (typeof window !== "undefined") {
        window.removeEventListener("vsr:friend-accepted", handleLocalFriendAccepted);
      }
    };
  }, []);

  // Đóng popover khi click ngoài
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  // Số lượng bạn bè đang online
  const onlineFriendsCount = friends.filter((f) => f.isOnline).length;

  // Lọc hội thoại theo search query
  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    if (conv.isGroup) {
      return conv.name?.toLowerCase().includes(q);
    }
    const partner = conv.participants?.find(
      (p) => String(p._id) !== String(user?._id || user?.id)
    );
    return partner?.name?.toLowerCase().includes(q);
  });

  // Xử lý bắt đầu chat trực tiếp từ danh sách bạn bè
  const handleStartDirectChat = async (friendId) => {
    try {
      const res = await messagesApi.getOrCreateDirect(friendId);
      const conv = res?.data?.conversation;
      if (conv) {
        setConversations((prev) => {
          if (prev.some((c) => String(c._id) === String(conv._id))) return prev;
          return [conv, ...prev];
        });
        onSelectConversation(conv);
        setNewChatModalOpen(false);
        setOpen(false);
      }
    } catch (err) {
      console.error("Lỗi mở cuộc trò chuyện:", err);
    }
  };

  // Xử lý tạo nhóm
  const handleCreateGroup = async () => {
    if (selectedFriendIds.length === 0) return;
    setCreatingGroup(true);
    try {
      const res = await messagesApi.createGroup(groupName, selectedFriendIds);
      const conv = res?.data?.conversation;
      if (conv) {
        setConversations((prev) => [conv, ...prev]);
        onSelectConversation(conv);
        setNewChatModalOpen(false);
        setOpen(false);
        setGroupName("");
        setSelectedFriendIds([]);
      }
    } catch (err) {
      console.error("Lỗi tạo nhóm:", err);
    } finally {
      setCreatingGroup(false);
    }
  };

  const toggleSelectFriend = (id) => {
    setSelectedFriendIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Helper format thời gian
  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return date.toLocaleDateString("vi-VN", {
      month: "numeric",
      day: "numeric",
    });
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setOpen(!open)}
        aria-label="Tin nhắn"
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200/80 bg-white/80 text-zinc-600 shadow-sm backdrop-blur-md transition hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800/80 dark:bg-zinc-900/60 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      >
        <MessageSquare className="h-4 w-4" strokeWidth={ICON_STROKE} />
      </button>

      {/* Popover Messages kiểu Messenger */}
      {open && (
        <div className="absolute right-0 top-11 z-50 w-84 sm:w-96 rounded-2xl border border-zinc-200/90 bg-white shadow-xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 dark:border-zinc-800/80 dark:bg-zinc-950/95">
          {/* Header */}
          <div className="border-b border-zinc-100 p-3.5 dark:border-zinc-800/60">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                  Messages
                </h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5" />
                  {onlineFriendsCount} bạn bè đang online
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setNewChatModalOpen(true)}
                className="h-7 gap-1 rounded-lg border-zinc-200 bg-zinc-50 px-2 text-[11px] text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-300 dark:hover:text-zinc-100"
              >
                <Plus className="h-3 w-3" strokeWidth={ICON_STROKE} />
                Tạo nhóm
              </Button>
            </div>

            {/* Ô tìm kiếm */}
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" strokeWidth={ICON_STROKE} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm cuộc trò chuyện..."
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-8 pr-3 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-800/80 dark:bg-zinc-900/80 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-zinc-500"
              />
            </div>
          </div>

          {/* Danh sách hội thoại */}
          <div className="max-h-80 overflow-y-auto p-1.5 space-y-1">
            {filteredConversations.length === 0 ? (
              <div className="py-8 text-center text-zinc-400 dark:text-zinc-500">
                <MessageSquare className="mx-auto h-7 w-7 text-zinc-300 dark:text-zinc-700 mb-1" strokeWidth={1.5} />
                <p className="text-xs">Chưa có cuộc trò chuyện nào</p>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setNewChatModalOpen(true)}
                  className="mt-1 text-xs text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                >
                  Bắt đầu nhắn tin với bạn bè
                </Button>
              </div>
            ) : (
              filteredConversations.map((conv, index) => {
                const isGroup = conv.isGroup;
                const partner = !isGroup
                  ? conv.participants?.find(
                      (p) => String(p._id) !== String(user?._id || user?.id)
                    )
                  : null;

                const title = isGroup ? conv.name || "Nhóm trò chuyện" : partner?.name || "Bạn bè";
                const isOnline = !isGroup ? partner?.isOnline : false;
                const lastMsg = conv.lastMessage?.text || "Chưa có tin nhắn nào";
                const timeStr = formatTime(conv.lastMessage?.createdAt || conv.updatedAt);

                return (
                  <button
                    key={`${conv._id || conv.id}-${index}`}
                    onClick={() => {
                      onSelectConversation(conv);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition hover:bg-zinc-100 dark:hover:bg-zinc-900/80 group"
                  >
                    <div className="relative shrink-0">
                      <Avatar className="h-10 w-10 border border-zinc-200 dark:border-zinc-800">
                        <AvatarImage src={isGroup ? "" : partner?.avatar} />
                        <AvatarFallback className="text-xs font-medium bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                          {isGroup ? (
                            <Users className="h-4 w-4" />
                          ) : (
                            partner?.name?.slice(0, 2).toUpperCase() || "U"
                          )}
                        </AvatarFallback>
                      </Avatar>
                      {!isGroup && (
                        <span
                          className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-zinc-950 ${
                            isOnline ? "bg-emerald-500" : "bg-zinc-400 dark:bg-zinc-600"
                          }`}
                        />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <p className="truncate text-xs font-semibold text-zinc-900 group-hover:text-zinc-950 dark:text-zinc-200 dark:group-hover:text-zinc-50">
                          {title}
                        </p>
                        <span className="shrink-0 text-[10px] text-zinc-400 dark:text-zinc-500">
                          {timeStr}
                        </span>
                      </div>
                      <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {lastMsg}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer popover */}
          <div className="border-t border-zinc-800/60 p-2 text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setNewChatModalOpen(true)}
              className="w-full text-xs text-zinc-400 hover:text-zinc-100"
            >
              + Cuộc trò chuyện mới
            </Button>
          </div>
        </div>
      )}

      {/* Dialog tạo chat / nhóm mới */}
      <Dialog open={newChatModalOpen} onOpenChange={setNewChatModalOpen}>
        <DialogContent className="max-w-md border-zinc-800/80 bg-zinc-950/90 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-zinc-100">
              {selectedFriendIds.length > 1 ? "Tạo nhóm trò chuyện" : "Tin nhắn mới"}
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Chọn một bạn bè để nhắn tin trực tiếp, hoặc chọn nhiều bạn bè để tạo nhóm học tập.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300" htmlFor="input-group-name">
                Tên nhóm <span className="text-zinc-500 font-normal">(bắt buộc khi tạo nhóm nhiều người)</span>
              </label>
              <input
                id="input-group-name"
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Ví dụ: Nhóm ôn thi Toán Cao cấp, Team Dự án..."
                className="w-full rounded-xl border border-zinc-800/80 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">
                Danh sách bạn bè ({friends.length})
              </label>

              <div className="max-h-60 overflow-y-auto rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-2 space-y-1">
                {friends.length === 0 ? (
                  <p className="py-6 text-center text-xs text-zinc-500">
                    Chưa có bạn bè. Hãy kết bạn bằng email trước nhé!
                  </p>
                ) : (
                  friends.map((friend) => {
                    const isSelected = selectedFriendIds.includes(friend._id);

                    return (
                      <div
                        key={friend._id}
                        onClick={() => toggleSelectFriend(friend._id)}
                        className={`flex items-center justify-between rounded-xl p-2 cursor-pointer transition ${
                          isSelected
                            ? "bg-zinc-800/80 border border-zinc-700/60"
                            : "hover:bg-zinc-900 border border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="relative">
                            <Avatar className="h-8 w-8 border border-zinc-800">
                              <AvatarImage src={friend.avatar} />
                              <AvatarFallback className="text-[10px]">
                                {friend.name?.slice(0, 2).toUpperCase() || "U"}
                              </AvatarFallback>
                            </Avatar>
                            <span
                              className={`absolute bottom-0 right-0 h-2 w-2 rounded-full ring-1 ring-zinc-950 ${
                                friend.isOnline ? "bg-emerald-500" : "bg-zinc-600"
                              }`}
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-zinc-200">
                              {friend.name}
                            </p>
                            <p className="truncate text-[10px] text-zinc-500">
                              {friend.isOnline ? "Đang online" : "Ngoại tuyến"}
                            </p>
                          </div>
                        </div>

                        <div
                          className={`flex h-5 w-5 items-center justify-center rounded-md border text-xs ${
                            isSelected
                              ? "border-zinc-100 bg-zinc-100 text-zinc-950"
                              : "border-zinc-700 bg-zinc-800/40"
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3" strokeWidth={2.5} />}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800/60">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setNewChatModalOpen(false);
                  setSelectedFriendIds([]);
                  setGroupName("");
                }}
                className="text-zinc-400 hover:text-zinc-200"
              >
                Hủy
              </Button>

              {selectedFriendIds.length === 1 ? (
                <Button
                  size="sm"
                  onClick={() => handleStartDirectChat(selectedFriendIds[0])}
                  className="bg-zinc-100 text-zinc-950 hover:bg-white"
                >
                  Nhắn tin
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={selectedFriendIds.length < 2 || creatingGroup}
                  onClick={handleCreateGroup}
                  className="gap-2 bg-zinc-100 text-zinc-950 hover:bg-white"
                >
                  {creatingGroup && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Tạo nhóm ({selectedFriendIds.length})
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
