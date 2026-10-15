"use client";

import { useState, useEffect, useRef } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  authApi,
  uploadApi,
  getStoredUser,
  setStoredUser,
  getAuthToken,
} from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import UserTitleBadge from "@/components/titles/UserTitleBadge";
import VipBadge from "@/components/payment/VipBadge";

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
  const [activeTab, setActiveTab] = useState("profile"); // 'profile' | 'security'
  const [loading, setLoading] = useState(true);

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
  }, [router]);

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
      <div className="flex min-h-[100dvh] items-center justify-center bg-zinc-950 text-zinc-400">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100">
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
      <header className="border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur sticky top-0 z-20">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-zinc-100 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại Dashboard</span>
          </Link>

          <div className="flex items-center gap-2">
            {user?.isPro && <VipBadge size="sm" showLabel={true} />}
            <UserTitleBadge
              title={user?.equippedTitle || user?.title || "Nhập môn học giả"}
              size="sm"
            />
          </div>
        </div>
      </header>

      {/* Nội dung chính */}
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        {/* Tiêu đề & Tóm tắt người dùng */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/60 pb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-50">
              Hồ sơ & Bảo mật tài khoản
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-zinc-400">
              Quản lý thông tin cá nhân, định danh học giả và bảo vệ mật khẩu của bạn.
            </p>
          </div>

          {/* Huy hiệu streak & thời gian học */}
          <div className="flex items-center gap-2 font-mono text-xs">
            <div className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-amber-400">
              <Flame className="h-3.5 w-3.5 fill-amber-400" />
              <span>{user?.streak || 1} ngày streak</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-zinc-300">
              <Clock className="h-3.5 w-3.5 text-zinc-400" />
              <span>{Math.round((user?.totalStudySeconds || 0) / 60)} phút</span>
            </div>
          </div>
        </div>

        {/* Tabs chuyển đổi */}
        <div className="flex items-center gap-2 border-b border-zinc-800/60 pb-3 mb-8">
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-medium transition",
              activeTab === "profile"
                ? "bg-zinc-100 text-zinc-950 font-semibold shadow-xs"
                : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
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
                ? "bg-zinc-100 text-zinc-950 font-semibold shadow-xs"
                : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
            )}
          >
            <Shield className="h-4 w-4" />
            <span>Đổi mật khẩu & Bảo mật</span>
          </button>
        </div>

        {/* TAB 1: THÔNG TIN CÁ NHÂN */}
        {activeTab === "profile" && (
          <form onSubmit={handleSaveProfile} className="space-y-8">
            {/* Vùng Avatar */}
            <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-5 sm:p-6 backdrop-blur-xs">
              <h3 className="text-sm font-semibold text-zinc-200 mb-4">
                Ảnh đại diện (Avatar)
              </h3>
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                <div className="relative group shrink-0">
                  <Avatar className="h-24 w-24 border-2 border-zinc-700/80 shadow-md">
                    <AvatarImage src={avatar} alt={name} />
                    <AvatarFallback className="bg-zinc-800 text-lg font-bold text-zinc-300">
                      {name ? name.slice(0, 2).toUpperCase() : "US"}
                    </AvatarFallback>
                  </Avatar>
                  {avatarUploading && (
                    <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-white" />
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-3 text-center sm:text-left">
                  <p className="text-xs text-zinc-400 max-w-md">
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
                      className="h-8 gap-1.5 border-zinc-800 bg-zinc-900 text-xs text-zinc-200 hover:bg-zinc-800 hover:text-zinc-100"
                    >
                      <Camera className="h-3.5 w-3.5" />
                      <span>{avatarUploading ? "Đang tải lên..." : "Tải ảnh từ máy"}</span>
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={handleRandomAvatar}
                      className="h-8 gap-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                      <span>Avatar ngẫu nhiên</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Các trường thông tin */}
            <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-5 sm:p-6 space-y-5">
              <h3 className="text-sm font-semibold text-zinc-200">
                Chi tiết hồ sơ học giả
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Họ và tên */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                    <UserIcon className="h-3.5 w-3.5 text-zinc-500" />
                    <span>Họ và tên</span>
                    <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    maxLength={50}
                    required
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600 transition"
                  />
                </div>

                {/* Email (Readonly) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-zinc-500" />
                    <span>Địa chỉ Email</span>
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={user?.email || ""}
                      readOnly
                      disabled
                      className="w-full rounded-xl border border-zinc-800/60 bg-zinc-900/50 px-3.5 py-2.5 text-xs sm:text-sm text-zinc-400 cursor-not-allowed"
                    />
                    <Badge
                      variant="outline"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 border-emerald-500/30 bg-emerald-950/40 text-[10px] text-emerald-400"
                    >
                      Đã xác thực
                    </Badge>
                  </div>
                </div>

                {/* Năm sinh */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-zinc-500" />
                    <span>Năm sinh</span>
                  </label>
                  <input
                    type="number"
                    value={birthYear}
                    onChange={(e) => setBirthYear(e.target.value)}
                    placeholder="Ví dụ: 2003"
                    min={1920}
                    max={new Date().getFullYear()}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600 transition font-mono"
                  />
                </div>

                {/* Số điện thoại */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-zinc-500" />
                    <span>Số điện thoại</span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ví dụ: 0912345678"
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600 transition font-mono"
                  />
                </div>
              </div>

              {/* Địa chỉ / Trường học */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                  <School className="h-3.5 w-3.5 text-zinc-500" />
                  <span>Trường học / Nơi làm việc</span>
                </label>
                <input
                  type="text"
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  placeholder="Ví dụ: Đại học Bách Khoa Hà Nội, THPT Chuyên..."
                  maxLength={100}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600 transition"
                />
              </div>

              {/* Bio giới thiệu */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-zinc-300">
                    Tiểu sử ngắn (Bio)
                  </label>
                  <span className="text-[11px] font-mono text-zinc-500">
                    {bio.length}/300 ký tự
                  </span>
                </div>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Chia sẻ mục tiêu học tập, sở thích hoặc phương châm của bạn..."
                  rows={3}
                  maxLength={300}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600 transition resize-none"
                />
              </div>
            </div>

            {/* Nút lưu thay đổi */}
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="submit"
                disabled={savingProfile}
                className="h-10 px-6 gap-2 bg-zinc-100 text-zinc-950 hover:bg-white font-medium text-xs sm:text-sm shadow-md"
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
            <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-5 sm:p-6 space-y-5">
              <div className="flex items-center gap-2.5 border-b border-zinc-800/60 pb-4">
                <div className="p-2 rounded-xl bg-zinc-800 text-zinc-300">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-zinc-200">
                    Đổi mật khẩu tài khoản
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Để đảm bảo an toàn, hãy sử dụng mật khẩu kết hợp chữ in hoa, số và ký tự đặc biệt.
                  </p>
                </div>
              </div>

              {/* Mật khẩu hiện tại */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300">
                  Mật khẩu hiện tại
                </label>
                <div className="relative">
                  <input
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Nhập mật khẩu hiện tại"
                    required
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 pr-10 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
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
                <label className="text-xs font-medium text-zinc-300">
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
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 pr-10 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
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
                      <span className="text-zinc-500">Độ mạnh mật khẩu:</span>
                      <span className={cn("font-medium", passwordStrength.color)}>
                        {passwordStrength.text}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden flex gap-1">
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
                <label className="text-xs font-medium text-zinc-300">
                  Xác nhận mật khẩu mới
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu mới"
                    required
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 pr-10 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    {showConfirm ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-[11px] text-rose-400">
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
                className="h-10 px-6 gap-2 bg-zinc-100 text-zinc-950 hover:bg-white font-medium text-xs sm:text-sm shadow-md disabled:opacity-40"
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
      </main>
    </div>
  );
}
