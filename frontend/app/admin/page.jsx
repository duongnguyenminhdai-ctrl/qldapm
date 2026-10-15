import { AdminClient } from "@/components/admin/AdminClient";

export const metadata = {
  title: "Admin Portal — Virtual Study Room",
  description:
    "Cổng quản trị viên Virtual Study Room: Quản lý người dùng, doanh thu VNPay và gói dịch vụ VIP.",
};

export default function AdminPage() {
  return <AdminClient />;
}
