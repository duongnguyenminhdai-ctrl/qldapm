/**
 * Helpers parse lỗi API auth thành errors theo field cho form.
 */

/**
 * @param {unknown} error - Error từ apiClient (có .data, .status)
 * @returns {{ formError: string, fieldErrors: Record<string, string> }}
 */
export function parseAuthErrors(error) {
  const data = error?.data;
  const fieldErrors = {};

  if (data?.errors && typeof data.errors === "object" && !Array.isArray(data.errors)) {
    for (const [key, value] of Object.entries(data.errors)) {
      if (typeof value === "string" && value.trim()) {
        fieldErrors[key] = value;
      }
    }
  }

  if (Array.isArray(data?.errors)) {
    for (const item of data.errors) {
      const field = item.field || item.path || item.param;
      const message = item.message || item.msg;
      if (field && message && !fieldErrors[field]) {
        fieldErrors[field] = message;
      }
    }
  }

  const formError =
    data?.message ||
    error?.message ||
    "Có lỗi xảy ra. Vui lòng thử lại.";

  return { formError, fieldErrors };
}

/**
 * Validate phía client trước khi gọi API (phản hồi nhanh dưới từng ô).
 */
export function validateRegisterFields({ name, email, password, confirmPassword }) {
  const errors = {};

  if (!name || !name.trim()) {
    errors.name = "Họ và tên không được để trống.";
  }

  if (!email || !email.trim()) {
    errors.email = "Email không được để trống.";
  } else if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
    errors.email = "Email không đúng định dạng.";
  }

  if (!password) {
    errors.password = "Mật khẩu không được để trống.";
  } else if (password.length < 6) {
    errors.password = "Mật khẩu phải từ 6 ký tự trở lên.";
  }

  if (confirmPassword !== undefined) {
    if (!confirmPassword) {
      errors.confirmPassword = "Vui lòng xác nhận lại mật khẩu.";
    } else if (password !== confirmPassword) {
      errors.confirmPassword = "Mật khẩu xác nhận không trùng khớp.";
    }
  }

  return errors;
}

export function validateLoginFields({ email, password }) {
  const errors = {};

  if (!email || !email.trim()) {
    errors.email = "Email không được để trống.";
  } else if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
    errors.email = "Email không đúng định dạng.";
  }

  if (!password) {
    errors.password = "Mật khẩu không được để trống.";
  }

  return errors;
}
