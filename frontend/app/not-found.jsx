import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#141210] text-[#f5ede3] p-4 text-center">
      <h1 className="text-6xl font-bold font-serif text-amber-500 mb-4">404</h1>
      <h2 className="text-2xl font-semibold mb-2">Trang không tồn tại</h2>
      <p className="text-stone-400 max-w-md mb-6 text-sm">
        Địa chỉ bạn đang tìm kiếm không tồn tại hoặc đã được di chuyển.
      </p>
      <Link
        href="/"
        className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-900 font-medium transition"
      >
        Về trang chủ
      </Link>
    </div>
  );
}
