"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User as UserIcon,
  Shield,
  Lock,
  Eye,
  EyeOff,
  Camera,
  Sparkles,
  Check,
  AlertCircle,
  Save,
  ArrowLeft,
  School,
  Phone,
  Calendar,
  Mail,
  Loader2,
  Clock,
  Flame,
  Layers,
  Gift,
  Crown,
  ExternalLink,
  SquareStack,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  authApi,
  uploadApi,
  cardsApi,
  getStoredUser,
  setStoredUser,
  getAuthToken,
} from "@/lib/api";
import { connectSocket } from "@/lib/socket";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ConfirmModal from "@/components/ui/ConfirmModal";
import UserTitleBadge from "@/components/titles/UserTitleBadge";
import TitlesModal from "@/components/titles/TitlesModal";
import VipBadge from "@/components/payment/VipBadge";
import VipStatusModal from "@/components/vip/VipStatusModal";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import CardsTab, { SCHOLAR_CARDS } from "./CardsTab";
export { SCHOLAR_CARDS };

function getPasswordStrength(pwd = "") {
  if (!pwd) return { score: 0, text: "", color: "" };
  let score = 0;
  if (pwd.length >= 6) score += 1;
  if (pwd.length >= 10) score += 1;
  if (/[A-Z]/.test(pwd)) score += 1;
  if (/[0-9]/.test(pwd)) score += 1;
  if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

  if (score <= 2) {
    return { score: 1, text: "Yếu", color: "bg-rose-500 text-rose-400" };
  }
  if (score <= 3) {
    return { score: 2, text: "Trung bình", color: "bg-amber-500 text-amber-400" };
  }
  return { score: 3, text: "Mạnh", color: "bg-emerald-500 text-emerald-400" };
}

export default function ProfileClient() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("profile"); // 'profile' | 'security' | 'cards'
  const [loading, setLoading] = useState(true);
  const [isTitlesModalOpen, setIsTitlesModalOpen] = useState(false);
  const [isVipModalOpen, setIsVipModalOpen] = useState(false);

  // Form State: Profile
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [phone, setPhone] = useState("");
  const [school, setSchool] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Form State: Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // State: Thẻ bài học giả
  const [cardsData, setCardsData] = useState({
    cardDraws: 0,
    cardInventory: [],
    dailyStudyMinutes: 0,
  });
  const [loadingCards, setLoadingCards] = useState(false);
  const [isExchangeModalOpen, setIsExchangeModalOpen] = useState(false);
  const [exchangingVip, setExchangingVip] = useState(false);

  // Toast feedback state
  const [toast, setToast] = useState(null); // { type: 'success' | 'error', message: '' }
  const avatarInputRef = useRef(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Tải dữ liệu người dùng
  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      router.push("/login");
      return;
    }

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (tabParam === "cards" || tabParam === "the-bai") {
        setActiveTab("cards");
      }
    }

    const handleOpenCards = () => setActiveTab("cards");
    const handleOpenVip = () => setIsVipModalOpen(true);
    window.addEventListener("vsr:open-cards-tab", handleOpenCards);
    window.addEventListener("vsr:open-vip-modal", handleOpenVip);

    const cached = getStoredUser();
    if (cached) {
      setUser(cached);
      setName(cached.name || "");
      setAvatar(cached.avatar || "");
      setBirthYear(cached.birthYear ? String(cached.birthYear) : "");
      setPhone(cached.phone || "");
      setSchool(cached.school || "");
      setBio(cached.bio || "");
    }

    authApi
      .me()
      .then((res) => {
        if (res?.data?.user) {
          const u = res.data.user;
          setUser(u);
          setStoredUser(u);
          setName(u.name || "");
          setAvatar(u.avatar || "");
          setBirthYear(u.birthYear ? String(u.birthYear) : "");
          setPhone(u.phone || "");
          setSchool(u.school || "");
          setBio(u.bio || "");
        }
      })
      .catch((err) => {
        console.error("Lỗi tải thông tin cá nhân:", err);
      })
      .finally(() => {
        setLoading(false);
      });

    return () => {
      window.removeEventListener("vsr:open-cards-tab", handleOpenCards);
      window.removeEventListener("vsr:open-vip-modal", handleOpenVip);
    };
  }, [router]);

  // Lấy dữ liệu Thẻ Bài Học Giả
  const loadCards = useCallback(async () => {
    try {
      setLoadingCards(true);
      const res = await cardsApi.getMyCards();
      const payload = res?.data || res;
      if (payload && (payload.cardInventory !== undefined || payload.cardDraws !== undefined)) {
        const inv = Array.isArray(payload.cardInventory) ? payload.cardInventory : [];
        const draws = payload.cardDraws ?? 0;
        const studyMins = payload.dailyStudyMinutes ?? 0;
        setCardsData({
          cardDraws: draws,
          cardInventory: inv,
          dailyStudyMinutes: studyMins,
        });
        setUser((prev) => {
          if (!prev) return prev;
          const updated = {
            ...prev,
            cardDraws: draws,
            cardInventory: inv,
          };
          setStoredUser(updated);
          return updated;
        });
      }
    } catch (err) {
      console.warn("[ProfileClient] Lỗi tải dữ liệu thẻ bài:", err);
    } finally {
      setLoadingCards(false);
    }
  }, []);

  const currentCardInventory = useMemo(() => {
    if (Array.isArray(cardsData?.cardInventory) && cardsData.cardInventory.length > 0) {
      return cardsData.cardInventory;
    }
    if (Array.isArray(user?.cardInventory) && user.cardInventory.length > 0) {
      return user.cardInventory;
    }
    return [];
  }, [cardsData?.cardInventory, user?.cardInventory]);

  const inventoryMap = useMemo(() => {
    const map = {};
    currentCardInventory.forEach((item) => {
      map[Number(item.cardId)] = Number(item.count) || 0;
    });
    return map;
  }, [currentCardInventory]);

  const distinctCount = useMemo(() => {
    return [1, 2, 3, 4, 5, 6, 7].filter((id) => (inventoryMap[id] || 0) > 0).length;
  }, [inventoryMap]);

  const totalCardsCount = useMemo(() => {
    return [1, 2, 3, 4, 5, 6, 7].reduce(
      (acc, id) => acc + (inventoryMap[id] || 0),
      0
    );
  }, [inventoryMap]);

  const canExchangeVip = distinctCount === 7;

  // Tự động re-fetch lại profile data & cards khi tab Thẻ bài được chọn
  useEffect(() => {
    if (activeTab === "cards") {
      loadCards();
      authApi
        .me()
        .then((res) => {
          if (res?.data?.user) {
            setUser(res.data.user);
            setStoredUser(res.data.user);
          }
        })
        .catch(() => {});
    }
  }, [activeTab, loadCards]);

  useEffect(() => {
    loadCards();

    const handleCardDrawn = () => {
      loadCards();
      authApi
        .me()
        .then((res) => {
          if (res?.data?.user) {
            setUser(res.data.user);
            setStoredUser(res.data.user);
          }
        })
        .catch(() => {});
    };

    window.addEventListener("vsr:card-drawn", handleCardDrawn);

    const socket = connectSocket();
    if (socket) {
      socket.on("card:updated", handleCardDrawn);
      socket.on("card:reward-available", handleCardDrawn);
      socket.on("user:updated", handleCardDrawn);
      socket.on("user:pro-updated", async (data) => {
        if (data?.proExpiresAt || data?.vipExpiresAt) {
          const newExp = data.vipExpiresAt || data.proExpiresAt;
          setUser((prev) => {
            const nextU = { ...prev, isPro: true, isVip: true, proExpiresAt: newExp, vipExpiresAt: newExp };
            setStoredUser(nextU);
            return nextU;
          });
        }
        const res = await authApi.me();
        if (res?.data?.user) {
          setUser(res.data.user);
          setStoredUser(res.data.user);
        }
      });
    }

    return () => {
      window.removeEventListener("vsr:card-drawn", handleCardDrawn);
      if (socket) {
        socket.off("card:updated", handleCardDrawn);
        socket.off("card:reward-available", handleCardDrawn);
        socket.off("user:updated", handleCardDrawn);
        socket.off("user:pro-updated");
      }
    };
  }, [loadCards]);

  // Đổi bộ 7 thẻ lấy 30 ngày VIP
  const handleExchangeVip = async () => {
    setIsExchangeModalOpen(false);
    setExchangingVip(true);
    try {
      const res = await cardsApi.exchangeVip();
      if (res?.success) {
        showToast(
          res.message ||
            "Đổi 30 ngày VIP thành công! Bạn đã được kích hoạt đặc quyền VIP.",
          "success"
        );
        const newExpiry =
          res.vipExpiresAt ||
          res.proExpiresAt ||
          res.data?.vipExpiresAt ||
          res.data?.proExpiresAt;
        if (newExpiry) {
          const updatedUser = {
            ...(getStoredUser() || user || {}),
            isPro: true,
            isVip: true,
            proExpiresAt: newExpiry,
            vipExpiresAt: newExpiry,
          };
          setUser(updatedUser);
          setStoredUser(updatedUser);
        }
        await loadCards();
        const meRes = await authApi.me();
        if (meRes?.data?.user) {
          setUser(meRes.data.user);
          setStoredUser(meRes.data.user);
        }
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("vsr:card-drawn"));
        }
      } else {
        showToast(res?.message || "Đổi VIP thất bại.", "error");
      }
    } catch (err) {
      showToast(err?.message || "Đổi VIP thất bại.", "error");
    } finally {
      setExchangingVip(false);
    }
  };

  // Xử lý upload ảnh đại diện mới qua Cloudinary
  const handleAvatarFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (avatarInputRef.current) avatarInputRef.current.value = "";

    if (file.size > 10 * 1024 * 1024) {
      showToast("Dung lượng ảnh tối đa là 10MB.", "error");
      return;
    }

    setAvatarUploading(true);
    try {
      const res = await uploadApi.uploadFile(file);
      const url = res?.fileUrl || res?.data?.fileUrl;
      if (url) {
        setAvatar(url);
        showToast("Đã tải ảnh đại diện lên thành công!", "success");
      } else {
        throw new Error("Không nhận được link ảnh.");
      }
    } catch (err) {
      showToast(err.message || "Tải ảnh lên thất bại.", "error");
    } finally {
      setAvatarUploading(false);
    }
  };

  // Tạo avatar ngẫu nhiên Dicebear
  const handleRandomAvatar = () => {
    const seed = Math.random().toString(36).substring(2, 9);
    const randomUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}`;
    setAvatar(randomUrl);
    showToast("Đã tạo avatar ngẫu nhiên!", "success");
  };

  // Lưu thông tin cá nhân
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast("Họ và tên không được để trống.", "error");
      return;
    }

    setSavingProfile(true);
    try {
      const payload = {
        name: name.trim(),
        avatar: avatar.trim(),
        birthYear: birthYear ? parseInt(birthYear, 10) : null,
        phone: phone.trim(),
        school: school.trim(),
        bio: bio.trim(),
      };

      const res = await authApi.updateProfile(payload);
      if (res?.data?.user) {
        const updated = res.data.user;
        setUser(updated);
        setStoredUser(updated);
        showToast("Cập nhật thông tin cá nhân thành công!", "success");
      }
    } catch (err) {
      showToast(
        err?.data?.message || err?.message || "Cập nhật hồ sơ thất bại.",
        "error"
      );
    } finally {
      setSavingProfile(false);
    }
  };

  // Đổi mật khẩu
  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      showToast("Vui lòng nhập đầy đủ các trường mật khẩu.", "error");
      return;
    }

    if (newPassword.length < 6) {
      showToast("Mật khẩu mới phải từ 6 ký tự trở lên.", "error");
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast("Mật khẩu xác nhận không trùng khớp.", "error");
      return;
    }

    if (newPassword === currentPassword) {
      showToast("Mật khẩu mới không được giống mật khẩu cũ.", "error");
      return;
    }

    setSavingPassword(true);
    try {
      await authApi.changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showToast("Đổi mật khẩu thành công! Mật khẩu mới đã được cập nhật.", "success");
    } catch (err) {
      showToast(
        err?.data?.message || err?.message || "Đổi mật khẩu thất bại.",
        "error"
      );
    } finally {
      setSavingPassword(false);
    }
  };

  const passwordStrength = getPasswordStrength(newPassword);

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#F7F4EB] dark:bg-[#141210] text-[#6e6358] dark:text-[#a89b8d]">
        <Loader2 className="h-6 w-6 animate-spin text-amber-600 dark:text-[#c3a47b]" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#F7F4EB] dark:bg-[#141210] text-[#6e6358] dark:text-[#a89b8d] transition-colors duration-200">
      {/* Toast Notification */}
      {toast && (
        <div
          role="alert"
          className={cn(
            "fixed top-5 right-5 z-50 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-xs font-medium shadow-2xl backdrop-blur-md transition-all animate-in fade-in slide-in-from-top-3",
            toast.type === "success"
              ? "border-emerald-500/30 bg-emerald-950/80 text-emerald-200"
              : "border-rose-500/30 bg-rose-950/80 text-rose-200"
          )}
        >
          {toast.type === "success" ? (
            <Check className="h-4 w-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header điều hướng */}
      <header className="border-b border-[#E6DEC8] dark:border-[#3a3128] bg-[#F7F4EB]/90 dark:bg-[#181513]/90 backdrop-blur-sm sticky top-0 z-20 transition-colors duration-200">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-3 sm:px-6 gap-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 sm:gap-2 text-xs font-medium text-[#6e6358] dark:text-[#a89b8d] hover:text-[#2D241E] dark:hover:text-[#f5ede3] transition shrink-0"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span className="truncate">Quay lại Dashboard</span>
          </Link>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {(user?.isPro || user?.isVip) && (
              <VipBadge
                size="xs"
                showLabel={true}
                onClick={() => setIsVipModalOpen(true)}
                className="cursor-pointer transition-all hover:scale-105 active:scale-95 hover:shadow-md hover:shadow-amber-500/20 text-xs px-2 py-1"
              />
            )}
            <UserTitleBadge
              title={user?.equippedTitle || user?.title || "Nhập môn học giả"}
              size="xs"
              onClick={() => setIsTitlesModalOpen(true)}
              className="text-xs px-2 py-1"
            />
          </div>
        </div>
      </header>

      {/* Nội dung chính */}
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        {/* Tiêu đề & Tóm tắt người dùng */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E6DEC8] dark:border-[#3a3128] pb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-serif font-semibold tracking-tight text-[#2D241E] dark:text-[#f5ede3]">
              Hồ sơ & Bảo mật tài khoản
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-[#6e6358] dark:text-[#a89b8d]">
              Quản lý thông tin cá nhân, định danh học giả và bảo vệ mật khẩu của bạn.
            </p>
          </div>

          {/* Huy hiệu streak & thời gian học */}
          <div className="flex items-center gap-2 font-mono text-xs">
            <div className="flex items-center gap-1.5 rounded-lg border border-[#E6DEC8] dark:border-[#3a3128] bg-[#fbf9f5] dark:bg-[#201b18] px-3 py-1.5 text-amber-700 dark:text-[#c3a47b]">
              <Flame className="h-3.5 w-3.5 fill-current" />
              <span>{user?.streak || 1} ngày streak</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-[#E6DEC8] dark:border-[#3a3128] bg-[#fbf9f5] dark:bg-[#201b18] px-3 py-1.5 text-[#4a3f35] dark:text-[#d8c8b4]">
              <Clock className="h-3.5 w-3.5 text-[#8C7E72] dark:text-[#75695e]" />
              <span>{Math.round((user?.totalStudySeconds || 0) / 60)} phút</span>
            </div>
          </div>
        </div>

        {/* Tabs chuyển đổi */}
        <div className="flex items-center gap-2 border-b border-[#E6DEC8] dark:border-[#3a3128] pb-3 mb-8">
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-medium transition",
              activeTab === "profile"
                ? "bg-[#b3894e] dark:bg-[#c3a47b] text-white dark:text-[#161311] font-semibold shadow-xs"
                : "text-[#6e6358] dark:text-[#a89b8d] hover:bg-[#ece5da] dark:hover:bg-[#201b18] hover:text-[#2D241E] dark:hover:text-[#f5ede3]"
            )}
          >
            <UserIcon className="h-4 w-4" />
            <span>Thông tin cá nhân</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("security")}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-medium transition",
              activeTab === "security"
                ? "bg-[#b3894e] dark:bg-[#c3a47b] text-white dark:text-[#161311] font-semibold shadow-xs"
                : "text-[#6e6358] dark:text-[#a89b8d] hover:bg-[#ece5da] dark:hover:bg-[#201b18] hover:text-[#2D241E] dark:hover:text-[#f5ede3]"
            )}
          >
            <Shield className="h-4 w-4" />
            <span>Đổi mật khẩu & Bảo mật</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("cards")}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-medium transition relative",
              activeTab === "cards"
                ? "bg-[#b3894e] dark:bg-[#c3a47b] text-white dark:text-[#161311] font-semibold shadow-xs"
                : "text-[#6e6358] dark:text-[#a89b8d] hover:bg-[#ece5da] dark:hover:bg-[#201b18] hover:text-[#2D241E] dark:hover:text-[#f5ede3]"
            )}
          >
            <Layers className="h-4 w-4" />
            <span>Thẻ bài</span>
            {(cardsData?.cardDraws || 0) > 0 && (
              <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-[#141210]">
                {cardsData.cardDraws}
              </span>
            )}
          </button>
        </div>

        {/* TAB 1: THÔNG TIN CÁ NHÂN */}
        {activeTab === "profile" && (
          <form onSubmit={handleSaveProfile} className="space-y-8">
            {/* Vùng Avatar */}
            <div className="rounded-2xl border border-[#E6DEC8] dark:border-[#3a3128] bg-[#fbf9f5] dark:bg-[#201b18] p-5 sm:p-6 backdrop-blur-xs shadow-xs">
              <h3 className="text-sm font-serif font-semibold text-[#2D241E] dark:text-[#f5ede3] mb-4">
                Ảnh đại diện (Avatar)
              </h3>
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                <div className="relative group shrink-0">
                  <Avatar className="h-24 w-24 border-2 border-[#E6DEC8] dark:border-[#3a3128] shadow-md">
                    <AvatarImage src={avatar} alt={name} />
                    <AvatarFallback className="bg-[#eee5da] dark:bg-[#181513] text-lg font-bold text-[#2D241E] dark:text-[#f5ede3]">
                      {name ? name.slice(0, 2).toUpperCase() : "US"}
                    </AvatarFallback>
                  </Avatar>
                  {avatarUploading && (
                    <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-amber-500 dark:text-[#c3a47b]" />
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-3 text-center sm:text-left">
                  <p className="text-xs text-[#6e6358] dark:text-[#a89b8d] max-w-md">
                    Tải lên ảnh chân dung sắc nét để bạn bè và các bạn cùng phòng học dễ dàng nhận diện. Hỗ trợ JPG, PNG, WEBP tối đa 10MB.
                  </p>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                    <input
                      type="file"
                      ref={avatarInputRef}
                      onChange={handleAvatarFile}
                      accept="image/*"
                      className="hidden"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={avatarUploading}
                      className="h-8 gap-1.5 border-[#E6DEC8] dark:border-[#3a3128] bg-[#F7F4EB] dark:bg-[#181513] text-xs text-[#4a3f35] dark:text-[#d8c8b4] hover:bg-[#eee5da] dark:hover:bg-[#26201c] hover:text-[#2D241E] dark:hover:text-[#f5ede3]"
                    >
                      <Camera className="h-3.5 w-3.5 text-amber-700 dark:text-[#c3a47b]" />
                      <span>{avatarUploading ? "Đang tải lên..." : "Tải ảnh từ máy"}</span>
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={handleRandomAvatar}
                      className="h-8 gap-1.5 text-xs text-[#6e6358] dark:text-[#a89b8d] hover:bg-[#eee5da] dark:hover:bg-[#26201c] hover:text-[#2D241E] dark:hover:text-[#f5ede3]"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-amber-700 dark:text-[#c3a47b]" />
                      <span>Avatar ngẫu nhiên</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Các trường thông tin */}
            <div className="rounded-2xl border border-[#E6DEC8] dark:border-[#3a3128] bg-[#fbf9f5] dark:bg-[#201b18] p-5 sm:p-6 space-y-5 shadow-xs">
              <h3 className="text-sm font-serif font-semibold text-[#2D241E] dark:text-[#f5ede3]">
                Chi tiết hồ sơ học giả
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Họ và tên */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#4a3f35] dark:text-[#d8c8b4] flex items-center gap-1.5">
                    <UserIcon className="h-3.5 w-3.5 text-[#8C7E72] dark:text-[#75695e]" />
                    <span>Họ và tên</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    maxLength={50}
                    required
                    className="w-full rounded-xl border border-[#E6DEC8] dark:border-[#3a3128] bg-[#F7F4EB] dark:bg-[#141210] px-3.5 py-2.5 text-xs sm:text-sm text-[#2D241E] dark:text-[#f5ede3] placeholder:text-[#8C7E72] dark:placeholder:text-[#75695e] focus:border-amber-500/60 dark:focus:border-[#5c4e40] focus:outline-none focus:ring-1 focus:ring-amber-500/30 dark:focus:ring-[#c3a47b] transition"
                  />
                </div>

                {/* Email (Readonly) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#4a3f35] dark:text-[#d8c8b4] flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-[#8C7E72] dark:text-[#75695e]" />
                    <span>Địa chỉ Email</span>
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={user?.email || ""}
                      readOnly
                      disabled
                      className="w-full rounded-xl border border-[#E6DEC8]/60 dark:border-[#3a3128]/60 bg-[#ece5da]/50 dark:bg-[#181513]/70 px-3.5 py-2.5 text-xs sm:text-sm text-[#8C7E72] dark:text-[#75695e] cursor-not-allowed"
                    />
                    <Badge
                      variant="outline"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 border-amber-600/30 dark:border-[#c3a47b]/40 bg-amber-500/10 dark:bg-[#c3a47b]/15 text-[10px] text-amber-800 dark:text-[#e8cca4]"
                    >
                      Đã xác thực
                    </Badge>
                  </div>
                </div>

                {/* Năm sinh */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#4a3f35] dark:text-[#d8c8b4] flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-[#8C7E72] dark:text-[#75695e]" />
                    <span>Năm sinh</span>
                  </label>
                  <input
                    type="number"
                    value={birthYear}
                    onChange={(e) => setBirthYear(e.target.value)}
                    placeholder="Ví dụ: 2003"
                    min={1920}
                    max={new Date().getFullYear()}
                    className="w-full rounded-xl border border-[#E6DEC8] dark:border-[#3a3128] bg-[#F7F4EB] dark:bg-[#141210] px-3.5 py-2.5 text-xs sm:text-sm text-[#2D241E] dark:text-[#f5ede3] placeholder:text-[#8C7E72] dark:placeholder:text-[#75695e] focus:border-amber-500/60 dark:focus:border-[#5c4e40] focus:outline-none focus:ring-1 focus:ring-amber-500/30 dark:focus:ring-[#c3a47b] transition font-mono"
                  />
                </div>

                {/* Số điện thoại */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#4a3f35] dark:text-[#d8c8b4] flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-[#8C7E72] dark:text-[#75695e]" />
                    <span>Số điện thoại</span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ví dụ: 0912345678"
                    className="w-full rounded-xl border border-[#E6DEC8] dark:border-[#3a3128] bg-[#F7F4EB] dark:bg-[#141210] px-3.5 py-2.5 text-xs sm:text-sm text-[#2D241E] dark:text-[#f5ede3] placeholder:text-[#8C7E72] dark:placeholder:text-[#75695e] focus:border-amber-500/60 dark:focus:border-[#5c4e40] focus:outline-none focus:ring-1 focus:ring-amber-500/30 dark:focus:ring-[#c3a47b] transition font-mono"
                  />
                </div>
              </div>

              {/* Địa chỉ / Trường học */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#4a3f35] dark:text-[#d8c8b4] flex items-center gap-1.5">
                  <School className="h-3.5 w-3.5 text-[#8C7E72] dark:text-[#75695e]" />
                  <span>Trường học / Nơi làm việc</span>
                </label>
                <input
                  type="text"
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  placeholder="Ví dụ: Đại học Bách Khoa Hà Nội, THPT Chuyên..."
                  maxLength={100}
                  className="w-full rounded-xl border border-[#E6DEC8] dark:border-[#3a3128] bg-[#F7F4EB] dark:bg-[#141210] px-3.5 py-2.5 text-xs sm:text-sm text-[#2D241E] dark:text-[#f5ede3] placeholder:text-[#8C7E72] dark:placeholder:text-[#75695e] focus:border-amber-500/60 dark:focus:border-[#5c4e40] focus:outline-none focus:ring-1 focus:ring-amber-500/30 dark:focus:ring-[#c3a47b] transition"
                />
              </div>

              {/* Bio giới thiệu */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-[#4a3f35] dark:text-[#d8c8b4]">
                    Tiểu sử ngắn (Bio)
                  </label>
                  <span className="text-[11px] font-mono text-[#8C7E72] dark:text-[#75695e]">
                    {bio.length}/300 ký tự
                  </span>
                </div>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Chia sẻ mục tiêu học tập, sở thích hoặc phương châm của bạn..."
                  rows={3}
                  maxLength={300}
                  className="w-full rounded-xl border border-[#E6DEC8] dark:border-[#3a3128] bg-[#F7F4EB] dark:bg-[#141210] p-3 text-xs sm:text-sm text-[#2D241E] dark:text-[#f5ede3] placeholder:text-[#8C7E72] dark:placeholder:text-[#75695e] focus:border-amber-500/60 dark:focus:border-[#5c4e40] focus:outline-none focus:ring-1 focus:ring-amber-500/30 dark:focus:ring-[#c3a47b] transition resize-none"
                />
              </div>
            </div>

            {/* Nút lưu thay đổi */}
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="submit"
                disabled={savingProfile}
                className="h-10 px-6 gap-2 bg-gradient-to-r from-amber-600 to-amber-700 dark:from-[#c3a47b] dark:to-[#d6b88f] text-white dark:text-[#161311] hover:brightness-105 font-semibold text-xs sm:text-sm shadow-md transition-all"
              >
                {savingProfile ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span>{savingProfile ? "Đang lưu..." : "Lưu thay đổi"}</span>
              </Button>
            </div>
          </form>
        )}

        {/* TAB 2: ĐỔI MẬT KHẨU & BẢO MẬT */}
        {activeTab === "security" && (
          <form onSubmit={handleChangePassword} className="space-y-6 max-w-xl">
            <div className="rounded-2xl border border-[#E6DEC8] dark:border-[#3a3128] bg-[#fbf9f5] dark:bg-[#201b18] p-5 sm:p-6 space-y-5 shadow-xs">
              <div className="flex items-center gap-2.5 border-b border-[#E6DEC8] dark:border-[#3a3128] pb-4">
                <div className="p-2 rounded-xl border border-[#E6DEC8] dark:border-[#3a3128] bg-[#F7F4EB] dark:bg-[#181513] text-amber-700 dark:text-[#c3a47b]">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-serif font-semibold text-[#2D241E] dark:text-[#f5ede3]">
                    Đổi mật khẩu tài khoản
                  </h3>
                  <p className="text-xs text-[#6e6358] dark:text-[#a89b8d]">
                    Để đảm bảo an toàn, hãy sử dụng mật khẩu kết hợp chữ in hoa, số và ký tự đặc biệt.
                  </p>
                </div>
              </div>

              {/* Mật khẩu hiện tại */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#4a3f35] dark:text-[#d8c8b4]">
                  Mật khẩu hiện tại
                </label>
                <div className="relative">
                  <input
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Nhập mật khẩu hiện tại"
                    required
                    className="w-full rounded-xl border border-[#E6DEC8] dark:border-[#3a3128] bg-[#F7F4EB] dark:bg-[#141210] px-3.5 py-2.5 pr-10 text-xs sm:text-sm text-[#2D241E] dark:text-[#f5ede3] placeholder:text-[#8C7E72] dark:placeholder:text-[#75695e] focus:border-amber-500/60 dark:focus:border-[#5c4e40] focus:outline-none focus:ring-1 focus:ring-amber-500/30 dark:focus:ring-[#c3a47b] transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8C7E72] dark:text-[#75695e] hover:text-[#2D241E] dark:hover:text-[#d8c8b4]"
                  >
                    {showCurrent ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Mật khẩu mới */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#4a3f35] dark:text-[#d8c8b4]">
                  Mật khẩu mới
                </label>
                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mật khẩu mới (tối thiểu 6 ký tự)"
                    required
                    minLength={6}
                    className="w-full rounded-xl border border-[#E6DEC8] dark:border-[#3a3128] bg-[#F7F4EB] dark:bg-[#141210] px-3.5 py-2.5 pr-10 text-xs sm:text-sm text-[#2D241E] dark:text-[#f5ede3] placeholder:text-[#8C7E72] dark:placeholder:text-[#75695e] focus:border-amber-500/60 dark:focus:border-[#5c4e40] focus:outline-none focus:ring-1 focus:ring-amber-500/30 dark:focus:ring-[#c3a47b] transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8C7E72] dark:text-[#75695e] hover:text-[#2D241E] dark:hover:text-[#d8c8b4]"
                  >
                    {showNew ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {/* Password Strength Meter */}
                {newPassword && (
                  <div className="pt-1.5 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#8C7E72] dark:text-[#75695e]">Độ mạnh mật khẩu:</span>
                      <span className={cn("font-medium", passwordStrength.color)}>
                        {passwordStrength.text}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-[#eee5da] dark:bg-[#181513] rounded-full overflow-hidden flex gap-1 border border-[#E6DEC8] dark:border-[#3a3128]">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          passwordStrength.score >= 1 ? passwordStrength.color : "bg-transparent",
                          "w-1/3"
                        )}
                      />
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          passwordStrength.score >= 2 ? passwordStrength.color : "bg-transparent",
                          "w-1/3"
                        )}
                      />
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          passwordStrength.score >= 3 ? passwordStrength.color : "bg-transparent",
                          "w-1/3"
                        )}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Xác nhận mật khẩu mới */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#4a3f35] dark:text-[#d8c8b4]">
                  Xác nhận mật khẩu mới
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu mới"
                    required
                    className="w-full rounded-xl border border-[#E6DEC8] dark:border-[#3a3128] bg-[#F7F4EB] dark:bg-[#141210] px-3.5 py-2.5 pr-10 text-xs sm:text-sm text-[#2D241E] dark:text-[#f5ede3] placeholder:text-[#8C7E72] dark:placeholder:text-[#75695e] focus:border-amber-500/60 dark:focus:border-[#5c4e40] focus:outline-none focus:ring-1 focus:ring-amber-500/30 dark:focus:ring-[#c3a47b] transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8C7E72] dark:text-[#75695e] hover:text-[#2D241E] dark:hover:text-[#d8c8b4]"
                  >
                    {showConfirm ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-[11px] text-rose-500">
                    Mật khẩu xác nhận chưa khớp với mật khẩu mới.
                  </p>
                )}
              </div>
            </div>

            {/* Nút submit đổi mật khẩu */}
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="submit"
                disabled={
                  savingPassword ||
                  !currentPassword ||
                  !newPassword ||
                  newPassword !== confirmPassword
                }
                className="h-10 px-6 gap-2 bg-gradient-to-r from-amber-600 to-amber-700 dark:from-[#c3a47b] dark:to-[#d6b88f] text-white dark:text-[#161311] hover:brightness-105 font-semibold text-xs sm:text-sm shadow-md disabled:opacity-40 transition-all"
              >
                {savingPassword ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Shield className="h-4 w-4" />
                )}
                <span>{savingPassword ? "Đang xử lý..." : "Cập nhật mật khẩu"}</span>
              </Button>
            </div>
          </form>
        )}

        {/* TAB 3: THẺ BÀI HỌC GIẢ */}
        {activeTab === "cards" && (
          <CardsTab
            user={user}
            cardsData={cardsData}
            distinctCount={distinctCount}
            totalCardsCount={totalCardsCount}
            canExchangeVip={canExchangeVip}
            exchangingVip={exchangingVip}
            handleExchangeVip={handleExchangeVip}
            isExchangeModalOpen={isExchangeModalOpen}
            setIsExchangeModalOpen={setIsExchangeModalOpen}
          />
        )}
      </main>

      {/* Modal bộ sưu tập danh hiệu */}
      <TitlesModal
        isOpen={isTitlesModalOpen}
        onClose={() => setIsTitlesModalOpen(false)}
        onEquippedChange={(newTitle) => {
          setUser((prev) => {
            if (!prev) return prev;
            const updated = {
              ...prev,
              equippedTitle: newTitle,
              activeTitle: newTitle,
              title: newTitle,
            };
            setStoredUser(updated);
            return updated;
          });
        }}
      />

      {/* Modal chi tiết thời hạn & đặc quyền VIP */}
      <VipStatusModal
        isOpen={isVipModalOpen}
        onClose={() => setIsVipModalOpen(false)}
        user={user}
      />
    </div>
  );
}
