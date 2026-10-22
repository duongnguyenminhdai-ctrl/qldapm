"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  MousePointer,
  PenLine,
  Eraser,
  ImagePlus,
  Trash2,
  Download,
  X,
  Trash,
} from "lucide-react";
import { cn } from "@/lib/utils";

const COLORS = [
  { name: "Kem sáng", value: "#F5EDE3", ring: "ring-[#f5ede3]" },
  { name: "Vàng cát ThreeUI", value: "#C3A47B", ring: "ring-[#c3a47b]" },
  { name: "Hổ phách ấm", value: "#E8CCA4", ring: "ring-[#e8cca4]" },
  { name: "Đất nung", value: "#945A3E", ring: "ring-[#945a3e]" },
  { name: "Đỏ trầm", value: "#8B2626", ring: "ring-[#8b2626]" },
];

const STROKE_WIDTHS = [2, 4, 8, 14];

/**
 * Nén nhẹ ảnh trước khi đưa lên canvas & socket để tối ưu hóa băng thông
 */
function compressImage(file, maxDimension = 1200, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.naturalWidth;
        let height = img.naturalHeight;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/webp", quality);
        resolve({
          dataUrl,
          aspectRatio: width / height,
          naturalWidth: width,
          naturalHeight: height,
        });
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function Whiteboard({ open, onClose, roomCode, socket }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  const isDrawingRef = useRef(false);
  const lastPointRef = useRef(null);
  const drawingsRef = useRef([]);
  const imagesRef = useRef([]);

  // Chế độ công cụ: 'select' (chọn/kéo ảnh), 'pen' (bút vẽ), 'eraser' (tẩy)
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState(COLORS[0].value);
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [images, setImages] = useState([]);
  const [selectedImageId, setSelectedImageId] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Ref theo dõi thao tác kéo/resize ảnh
  const draggingActionRef = useRef(null); // { type: 'move' | 'resize', id, handle, startX, startY, origX, origY, origW, origH, aspectRatio }

  // Đồng bộ imagesRef với images state
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  // Hàm vẽ 1 đoạn thẳng nét vẽ chuẩn hóa lên canvas
  const renderSegment = useCallback((ctx, width, height, data) => {
    if (!data || !data.prevPoint || !data.currentPoint) return;

    const x1 = data.prevPoint.x * width;
    const y1 = data.prevPoint.y * height;
    const x2 = data.currentPoint.x * width;
    const y2 = data.currentPoint.y * height;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);

    if (data.isEraser) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
      ctx.lineWidth = (data.width || 3) * 3;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = data.color || "#FFFFFF";
      ctx.lineWidth = data.width || 3;
    }

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.restore();
  }, []);

  // Vẽ lại toàn bộ nét vẽ từ drawingsRef lên canvas
  const redrawAllStrokes = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const segment of drawingsRef.current) {
      renderSegment(ctx, width, height, segment);
    }
  }, [renderSegment]);

  // Cài đặt kích thước canvas theo DPR (devicePixelRatio) để nét vẽ cực kỳ sắc nét
  const setupCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;

    // Giới hạn DPR tối đa 1.25 theo khuyến nghị để tránh quá tải GPU/VRAM trên màn hình Retina/High-DPI
    const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.resetTransform?.();
      ctx.scale(dpr, dpr);
    }

    redrawAllStrokes();
  }, [redrawAllStrokes]);

  // Khởi tạo và resize listener
  useEffect(() => {
    if (!open) return;

    setupCanvasSize();
    const handleResize = () => {
      setupCanvasSize();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [open, setupCanvasSize]);

  // Thêm ảnh mới vào bảng và emit qua Socket
  const addImageToBoard = useCallback(
    async (file) => {
      if (!file || !file.type.startsWith("image/")) return;
      try {
        const { dataUrl, naturalWidth, naturalHeight } = await compressImage(file);
        const container = containerRef.current;
        const cWidth = container?.clientWidth || 800;
        const cHeight = container?.clientHeight || 600;

        // Tính kích thước chuẩn hóa ban đầu (chiếm khoảng 40% bề ngang)
        const initialNormW = Math.min(0.55, Math.max(0.25, 400 / cWidth));
        const aspect = naturalHeight / naturalWidth;
        const initialNormH = initialNormW * aspect * (cWidth / cHeight);

        // Đặt ở chính giữa canvas
        const initialX = Math.max(0.05, 0.5 - initialNormW / 2);
        const initialY = Math.max(0.05, 0.5 - initialNormH / 2);

        const newImageObj = {
          id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          x: initialX,
          y: initialY,
          width: initialNormW,
          height: initialNormH,
          dataUrl,
          roomCode,
        };

        setImages((prev) => [...prev, newImageObj]);
        setSelectedImageId(newImageObj.id);
        // Tự động chuyển sang chế độ chọn để kéo thả ngay
        setTool("select");

        if (socket && socket.connected) {
          socket.emit("board:add-image", newImageObj);
        }
      } catch (err) {
        console.error("[Whiteboard] Lỗi khi tải ảnh:", err);
      }
    },
    [roomCode, socket]
  );

  // 1. Lắng nghe sự kiện Paste từ Clipboard (Ctrl + V / Cmd + V)
  useEffect(() => {
    if (!open) return;

    const handlePaste = (e) => {
      const clipboardData = e.clipboardData;
      if (!clipboardData || !clipboardData.items) return;

      for (let i = 0; i < clipboardData.items.length; i++) {
        const item = clipboardData.items[i];
        if (item.type.indexOf("image") !== -1) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            addImageToBoard(file);
            break;
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [open, addImageToBoard]);

  // Phím tắt Delete / Backspace để xóa ảnh đang chọn
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e) => {
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedImageId &&
        tool === "select"
      ) {
        e.preventDefault();
        handleDeleteSelectedImage();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedImageId, tool]);

  // Kết nối và đồng bộ Socket.io (nét vẽ & ảnh)
  useEffect(() => {
    if (!socket || !open) return;

    // Lấy trạng thái đầy đủ khi mở bảng vẽ
    socket.emit("whiteboard:get-state", { roomCode }, (res) => {
      if (res) {
        if (Array.isArray(res.drawings)) {
          drawingsRef.current = res.drawings;
          redrawAllStrokes();
        }
        if (Array.isArray(res.images)) {
          setImages(res.images);
        }
      }
    });

    // Lắng nghe nét vẽ thời gian thực
    const onDrawLine = (data) => {
      drawingsRef.current.push(data);
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (canvas && container) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          renderSegment(ctx, container.clientWidth, container.clientHeight, data);
        }
      }
    };

    // Lắng nghe ảnh mới thêm
    const onAddImage = (imageData) => {
      setImages((prev) => {
        if (prev.some((img) => img.id === imageData.id)) return prev;
        return [...prev, imageData];
      });
    };

    // Lắng nghe di chuyển/co giãn ảnh
    const onUpdateImage = (updateData) => {
      setImages((prev) =>
        prev.map((img) => {
          if (img.id === updateData.id) {
            return {
              ...img,
              x: updateData.x ?? img.x,
              y: updateData.y ?? img.y,
              width: updateData.width ?? img.width,
              height: updateData.height ?? img.height,
            };
          }
          return img;
        })
      );
    };

    // Lắng nghe xóa ảnh
    const onDeleteImage = ({ id }) => {
      setImages((prev) => prev.filter((img) => img.id !== id));
      setSelectedImageId((curr) => (curr === id ? null : curr));
    };

    // Lắng nghe xóa toàn bộ bảng
    const onClearBoard = () => {
      drawingsRef.current = [];
      setImages([]);
      setSelectedImageId(null);
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
    };

    // Lắng nghe đồng bộ
    const onSyncDrawings = (payload) => {
      if (Array.isArray(payload)) {
        drawingsRef.current = payload;
        redrawAllStrokes();
      } else if (payload && typeof payload === "object") {
        if (Array.isArray(payload.drawings)) {
          drawingsRef.current = payload.drawings;
          redrawAllStrokes();
        }
        if (Array.isArray(payload.images)) {
          setImages(payload.images);
        }
      }
    };

    const onSyncImages = (serverImages) => {
      if (Array.isArray(serverImages)) {
        setImages(serverImages);
      }
    };

    socket.on("draw-line", onDrawLine);
    socket.on("board:add-image", onAddImage);
    socket.on("board:update-image", onUpdateImage);
    socket.on("board:delete-image", onDeleteImage);
    socket.on("clear-board", onClearBoard);
    socket.on("whiteboard:sync", onSyncDrawings);
    socket.on("board:sync-images", onSyncImages);

    return () => {
      socket.off("draw-line", onDrawLine);
      socket.off("board:add-image", onAddImage);
      socket.off("board:update-image", onUpdateImage);
      socket.off("board:delete-image", onDeleteImage);
      socket.off("clear-board", onClearBoard);
      socket.off("whiteboard:sync", onSyncDrawings);
      socket.off("board:sync-images", onSyncImages);
    };
  }, [socket, open, roomCode, renderSegment, redrawAllStrokes]);

  // Helper chuyển đổi tọa độ chuột sang tỉ lệ chuẩn hóa [0, 1]
  const getCoordinates = (e) => {
    const container = containerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();

    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;

    return {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
    };
  };

  // ----------------------------------------------------
  // Xử lý vẽ nét (Draw Mode)
  // ----------------------------------------------------
  const startDrawing = (e) => {
    if (tool === "select") return;

    const point = getCoordinates(e);
    if (!point) return;

    isDrawingRef.current = true;
    lastPointRef.current = point;
  };

  const draw = (e) => {
    if (tool === "select") return;
    if (!isDrawingRef.current || !lastPointRef.current) return;
    const currentPoint = getCoordinates(e);
    if (!currentPoint) return;

    const dx = currentPoint.x - lastPointRef.current.x;
    const dy = currentPoint.y - lastPointRef.current.y;
    if (Math.abs(dx) < 0.0005 && Math.abs(dy) < 0.0005) {
      return;
    }

    const segment = {
      prevPoint: lastPointRef.current,
      currentPoint,
      color,
      width: strokeWidth,
      isEraser: tool === "eraser",
      roomCode,
    };

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (canvas && container) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        renderSegment(ctx, container.clientWidth, container.clientHeight, segment);
      }
    }

    drawingsRef.current.push(segment);

    if (socket && socket.connected) {
      socket.emit("draw-line", segment);
    }

    lastPointRef.current = currentPoint;
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
    lastPointRef.current = null;
  };

  // ----------------------------------------------------
  // Xử lý thao tác kéo & co giãn ảnh (Transform Mode)
  // ----------------------------------------------------
  const handleImagePointerDown = (e, img) => {
    if (tool !== "select") return;
    if (e.button !== 0) return; // Chỉ xử lý chuột trái
    e.stopPropagation();

    setSelectedImageId(img.id);

    draggingActionRef.current = {
      type: "move",
      id: img.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: img.x,
      origY: img.y,
      hasMoved: false,
    };
  };

  const handleResizeHandleDown = (e, img, handleName) => {
    if (tool !== "select") return;
    if (e.button !== 0) return;
    e.stopPropagation();

    const container = containerRef.current;
    const cWidth = container?.clientWidth || 800;
    const cHeight = container?.clientHeight || 600;

    draggingActionRef.current = {
      type: "resize",
      id: img.id,
      handle: handleName,
      startX: e.clientX,
      startY: e.clientY,
      origX: img.x,
      origY: img.y,
      origW: img.width,
      origH: img.height,
      cWidth,
      cHeight,
    };
  };

  // Global mouse move & mouse up cho transform ảnh
  useEffect(() => {
    const handleGlobalPointerMove = (e) => {
      const action = draggingActionRef.current;
      if (!action) return;

      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();

      if (action.type === "move") {
        const deltaPixels = Math.hypot(e.clientX - action.startX, e.clientY - action.startY);
        if (deltaPixels > 3) {
          action.hasMoved = true;
        }
        if (!action.hasMoved) return;

        const deltaX = (e.clientX - action.startX) / rect.width;
        const deltaY = (e.clientY - action.startY) / rect.height;

        const newX = Math.max(0, Math.min(0.95, action.origX + deltaX));
        const newY = Math.max(0, Math.min(0.95, action.origY + deltaY));

        setImages((prev) =>
          prev.map((img) => (img.id === action.id ? { ...img, x: newX, y: newY } : img))
        );

        if (socket && socket.connected) {
          socket.emit("board:update-image", {
            id: action.id,
            x: newX,
            y: newY,
            roomCode,
          });
        }
      } else if (action.type === "resize") {
        const deltaX = (e.clientX - action.startX) / rect.width;
        let newW = action.origW;
        let newH = action.origH;
        let newX = action.origX;
        let newY = action.origY;

        const aspect = action.origH / action.origW;

        if (action.handle === "se") {
          newW = Math.max(0.08, Math.min(0.9, action.origW + deltaX));
          newH = newW * aspect;
        } else if (action.handle === "sw") {
          newW = Math.max(0.08, Math.min(0.9, action.origW - deltaX));
          newH = newW * aspect;
          newX = action.origX + (action.origW - newW);
        } else if (action.handle === "ne") {
          newW = Math.max(0.08, Math.min(0.9, action.origW + deltaX));
          newH = newW * aspect;
          newY = action.origY + (action.origH - newH);
        } else if (action.handle === "nw") {
          newW = Math.max(0.08, Math.min(0.9, action.origW - deltaX));
          newH = newW * aspect;
          newX = action.origX + (action.origW - newW);
          newY = action.origY + (action.origH - newH);
        }

        setImages((prev) =>
          prev.map((img) =>
            img.id === action.id
              ? { ...img, x: newX, y: newY, width: newW, height: newH }
              : img
          )
        );

        if (socket && socket.connected) {
          socket.emit("board:update-image", {
            id: action.id,
            x: newX,
            y: newY,
            width: newW,
            height: newH,
            roomCode,
          });
        }
      }
    };

    const handleGlobalPointerUp = () => {
      draggingActionRef.current = null;
    };

    window.addEventListener("pointermove", handleGlobalPointerMove);
    window.addEventListener("pointerup", handleGlobalPointerUp);

    return () => {
      window.removeEventListener("pointermove", handleGlobalPointerMove);
      window.removeEventListener("pointerup", handleGlobalPointerUp);
    };
  }, [roomCode, socket]);

  // Xóa ảnh đang chọn
  const handleDeleteSelectedImage = () => {
    if (!selectedImageId) return;
    const targetId = selectedImageId;
    setImages((prev) => prev.filter((img) => img.id !== targetId));
    setSelectedImageId(null);

    if (socket && socket.connected) {
      socket.emit("board:delete-image", { id: targetId, roomCode });
    }
  };

  // Xóa sạch toàn bộ bảng
  const handleClearBoard = () => {
    drawingsRef.current = [];
    setImages([]);
    setSelectedImageId(null);

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    if (socket && socket.connected) {
      socket.emit("clear-board", { roomCode });
    }
    setShowClearConfirm(false);
  };

  // Xuất ảnh JPG chất lượng cao chụp toàn bộ bảng vẽ (bao gồm nền tối, ảnh và các nét vẽ)
  const handleDownload = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;

    // Scale 2x để đảm bảo ảnh JPG xuất ra có độ phân giải cao và sắc nét tối đa
    const scale = Math.max(2, window.devicePixelRatio || 2);

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = Math.round(width * scale);
    exportCanvas.height = Math.round(height * scale);
    const exportCtx = exportCanvas.getContext("2d");
    if (!exportCtx) return;

    exportCtx.scale(scale, scale);

    // 1. Vẽ nền tối toàn bộ bảng vẽ
    exportCtx.fillStyle = "#141210";
    exportCtx.fillRect(0, 0, width, height);

    // 2. Vẽ tất cả các ảnh ở lớp dưới
    let loadedCount = 0;
    const currentImages = imagesRef.current;

    const onAllDrawn = () => {
      // 3. Vẽ tất cả nét viết/vẽ lên trên ảnh
      for (const segment of drawingsRef.current) {
        renderSegment(exportCtx, width, height, segment);
      }

      // 4. Xuất file ảnh định dạng JPG với chất lượng cao (0.95) qua Blob chuẩn
      exportCanvas.toBlob(
        (blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const filename = `whiteboard-${roomCode || "note"}-${Date.now()}.jpg`;
          const link = document.createElement("a");
          link.style.display = "none";
          link.href = url;
          link.download = filename;
          link.setAttribute("download", filename);
          document.body.appendChild(link);
          link.click();

          // Giữ URL tồn tại 60s để Chrome và các trình duyệt kịp tải xong và ghi đúng tên file .jpg
          setTimeout(() => {
            try {
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
            } catch (_) {}
          }, 60000);
        },
        "image/jpeg",
        0.95
      );
    };

    if (currentImages.length === 0) {
      onAllDrawn();
      return;
    }

    currentImages.forEach((imgObj) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        exportCtx.drawImage(
          img,
          imgObj.x * width,
          imgObj.y * height,
          imgObj.width * width,
          imgObj.height * height
        );
        loadedCount++;
        if (loadedCount === currentImages.length) {
          onAllDrawn();
        }
      };
      img.onerror = () => {
        loadedCount++;
        if (loadedCount === currentImages.length) {
          onAllDrawn();
        }
      };
      img.src = imgObj.dataUrl;
    });
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Bảng vẽ chung"
    >
      <div className="relative flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-stone-200 bg-[#FAF8F5] dark:border-[#3a3128] dark:bg-[#1c1815] shadow-2xl">
        {/* Header bảng vẽ */}
        <div className="flex h-13 items-center justify-between border-b border-stone-200 bg-[#F7F4EB] dark:border-[#2d2620] dark:bg-[#181513] px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2 w-2 rounded-full bg-[#b3894e] dark:bg-[#c3a47b]" />
            <h2 className="font-serif text-base font-semibold tracking-tight text-[#2D241E] dark:text-[#f5ede3]">
              Bảng vẽ chung
            </h2>
            <span className="hidden rounded-full border border-stone-300 bg-[#ECE5DA] px-2.5 py-0.5 font-mono text-[11px] text-[#966f38] dark:border-[#3a3128] dark:bg-[#201b18] dark:text-[#c3a47b] sm:inline-block">
              Phòng: {roomCode}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleDownload}
              title="Tải ảnh bảng vẽ (JPG)"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#615247] transition-colors hover:bg-[#ECE5DA] hover:text-[#2D241E] dark:text-[#d8c8b4] dark:hover:bg-[#26201c] dark:hover:text-[#f5ede3]"
            >
              <Download className="h-4 w-4" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Đóng bảng vẽ"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#615247] transition-colors hover:bg-[#ECE5DA] hover:text-[#2D241E] dark:text-[#d8c8b4] dark:hover:bg-[#26201c] dark:hover:text-[#f5ede3]"
            >
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        {/* Khu vực Canvas, Lớp Ảnh và Floating Toolbar */}
        <div
          ref={containerRef}
          onClick={(e) => {
            // Chỉ bỏ chọn khi click trực tiếp vào vùng nền trống của canvas hoặc container
            if (e.target === containerRef.current || e.target === canvasRef.current) {
              if (tool === "select") setSelectedImageId(null);
            }
          }}
          className={cn(
            "relative flex-1 select-none overflow-hidden bg-[#FAF8F5] dark:bg-[#141210]",
            tool === "select" ? "cursor-default" : "cursor-crosshair"
          )}
        >
          {/* Subtle Floating Toolbar */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="pointer-events-auto absolute left-1/2 top-4 z-30 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-stone-200 bg-[#FAF8F5]/95 dark:border-[#3a3128] dark:bg-[#1e1916]/95 p-1.5 shadow-xl backdrop-blur-md"
          >
            {/* Chế độ 1: Chọn / Kéo thả ảnh (Select & Transform) */}
            <button
              type="button"
              onClick={() => {
                setTool("select");
              }}
              aria-label="Chọn và di chuyển ảnh"
              title="Chọn & Co giãn ảnh (V)"
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-xl transition-all",
                tool === "select"
                  ? "bg-[#b3894e] text-white dark:bg-[#c3a47b] dark:text-[#161311] shadow-sm font-semibold"
                  : "text-[#8C7E72] hover:bg-[#ECE5DA] hover:text-[#2D241E] dark:text-[#a89b8d] dark:hover:bg-[#26201c] dark:hover:text-[#f5ede3]"
              )}
            >
              <MousePointer className="h-4 w-4" strokeWidth={1.75} />
            </button>

            {/* Chế độ 2: Bút vẽ (Draw Mode) */}
            <button
              type="button"
              onClick={() => {
                setTool("pen");
                setSelectedImageId(null);
              }}
              aria-label="Bút vẽ"
              title="Bút vẽ (P)"
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-xl transition-all",
                tool === "pen"
                  ? "bg-[#b3894e] text-white dark:bg-[#c3a47b] dark:text-[#161311] shadow-sm font-semibold"
                  : "text-[#8C7E72] hover:bg-[#ECE5DA] hover:text-[#2D241E] dark:text-[#a89b8d] dark:hover:bg-[#26201c] dark:hover:text-[#f5ede3]"
              )}
            >
              <PenLine className="h-4 w-4" strokeWidth={1.75} />
            </button>

            {/* Chế độ 3: Cục tẩy (Eraser) */}
            <button
              type="button"
              onClick={() => {
                setTool("eraser");
                setSelectedImageId(null);
              }}
              aria-label="Cục tẩy"
              title="Cục tẩy (E)"
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-xl transition-all",
                tool === "eraser"
                  ? "bg-[#b3894e] text-white dark:bg-[#c3a47b] dark:text-[#161311] shadow-sm font-semibold"
                  : "text-[#8C7E72] hover:bg-[#ECE5DA] hover:text-[#2D241E] dark:text-[#a89b8d] dark:hover:bg-[#26201c] dark:hover:text-[#f5ede3]"
              )}
            >
              <Eraser className="h-4 w-4" strokeWidth={1.75} />
            </button>

            <span className="mx-1 h-4 w-px bg-stone-300 dark:bg-[#3a3128]" aria-hidden />

            {/* Chèn ảnh: Upload từ máy tính */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png, image/jpeg, image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) addImageToBoard(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Tải ảnh lên"
              title="Tải ảnh từ máy tính (hoặc Ctrl+V để dán)"
              className="flex h-8 w-8 items-center justify-center rounded-xl text-[#8C7E72] transition-all hover:bg-[#ECE5DA] hover:text-[#2D241E] dark:text-[#a89b8d] dark:hover:bg-[#26201c] dark:hover:text-[#f5ede3]"
            >
              <ImagePlus className="h-4 w-4" strokeWidth={1.75} />
            </button>

            <span className="mx-1 h-4 w-px bg-stone-300 dark:bg-[#3a3128]" aria-hidden />

            {/* Bảng màu tinh tế 5 màu */}
            <div className="flex items-center gap-1.5 px-1">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => {
                    setColor(c.value);
                    if (tool === "eraser" || tool === "select") setTool("pen");
                  }}
                  title={c.name}
                  style={{ backgroundColor: c.value }}
                  className={cn(
                    "h-4 w-4 rounded-full transition-transform hover:scale-110 shadow-xs",
                    color === c.value && tool === "pen"
                      ? "ring-2 ring-[#c3a47b] ring-offset-2 ring-offset-[#FAF8F5] dark:ring-offset-[#1e1916]"
                      : "opacity-80"
                  )}
                />
              ))}
            </div>

            <span className="mx-1 h-4 w-px bg-stone-300 dark:bg-[#3a3128]" aria-hidden />

            {/* Kích thước nét vẽ */}
            <div className="flex items-center gap-1 px-1">
              {STROKE_WIDTHS.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setStrokeWidth(w)}
                  title={`Cỡ nét ${w}px`}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-lg text-xs transition-colors",
                    strokeWidth === w
                      ? "border border-[#b3894e]/50 bg-[#ECE5DA] text-[#966f38] dark:border-[#c3a47b]/40 dark:bg-[#29231f] dark:text-[#c3a47b]"
                      : "text-[#8C7E72] hover:bg-[#ECE5DA] hover:text-[#2D241E] dark:text-[#a89b8d] dark:hover:bg-[#201b18] dark:hover:text-[#f5ede3]"
                  )}
                >
                  <span
                    className="rounded-full bg-current"
                    style={{ width: Math.max(3, w), height: Math.max(3, w) }}
                  />
                </button>
              ))}
            </div>

            <span className="mx-1 h-4 w-px bg-stone-300 dark:bg-[#3a3128]" aria-hidden />

            {/* Nút xóa bảng */}
            {showClearConfirm ? (
              <div className="flex items-center gap-1 px-1">
                <button
                  type="button"
                  onClick={handleClearBoard}
                  className="rounded-lg border border-[#8b2626]/50 bg-[#8b2626]/25 px-2 py-1 text-xs font-medium text-[#f5ede3] hover:bg-[#8b2626]/40"
                >
                  Xóa hết?
                </button>
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  className="rounded-lg px-2 py-1 text-xs text-[#8C7E72] hover:bg-[#ECE5DA] hover:text-[#2D241E] dark:text-[#a89b8d] dark:hover:bg-[#201b18] dark:hover:text-[#f5ede3]"
                >
                  Hủy
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                title="Xóa toàn bộ bảng"
                aria-label="Xóa toàn bộ bảng"
                className="flex h-8 w-8 items-center justify-center rounded-xl text-[#8C7E72] transition-colors hover:bg-[#ECE5DA] hover:text-[#8b2626] dark:text-[#a89b8d] dark:hover:bg-[#26201c] dark:hover:text-[#8b2626]"
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.75} />
              </button>
            )}
          </div>

          {/* Lớp Hình ảnh nằm bên dưới nét vẽ (Annotation Layer) */}
          <div
            className={cn(
              "absolute inset-0 z-10",
              tool === "select" ? "pointer-events-auto" : "pointer-events-none"
            )}
          >
            {images.map((img) => {
              const isSelected = selectedImageId === img.id && tool === "select";

              return (
                <div
                  key={img.id}
                  onClick={(e) => {
                    if (tool === "select") {
                      e.stopPropagation();
                      setSelectedImageId(img.id);
                    }
                  }}
                  onPointerDown={(e) => handleImagePointerDown(e, img)}
                  style={{
                    left: `${img.x * 100}%`,
                    top: `${img.y * 100}%`,
                    width: `${img.width * 100}%`,
                    height: `${img.height * 100}%`,
                  }}
                  className={cn(
                    "absolute select-none",
                    tool === "select" ? "cursor-move" : "cursor-crosshair",
                    isSelected && "ring-1 ring-[#c3a47b]"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.dataUrl}
                    alt="Bảng vẽ"
                    draggable={false}
                    className="h-full w-full object-contain pointer-events-none rounded"
                  />

                  {/* Bounding box và 4 góc điều khiển resize khi được chọn */}
                  {isSelected && (
                    <>
                      {/* Bounding box viền đứt thanh mảnh */}
                      <div className="pointer-events-none absolute inset-0 border border-dashed border-[#c3a47b]/80 rounded" />

                      {/* 4 Handles ở 4 góc */}
                      {/* Top-Left */}
                      <div
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => handleResizeHandleDown(e, img, "nw")}
                        className="absolute -left-1.5 -top-1.5 h-3 w-3 cursor-nwse-resize rounded-full border border-[#141210] bg-[#c3a47b] shadow"
                      />
                      {/* Top-Right */}
                      <div
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => handleResizeHandleDown(e, img, "ne")}
                        className="absolute -right-1.5 -top-1.5 h-3 w-3 cursor-nesw-resize rounded-full border border-[#141210] bg-[#c3a47b] shadow"
                      />
                      {/* Bottom-Left */}
                      <div
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => handleResizeHandleDown(e, img, "sw")}
                        className="absolute -bottom-1.5 -left-1.5 h-3 w-3 cursor-nesw-resize rounded-full border border-[#141210] bg-[#c3a47b] shadow"
                      />
                      {/* Bottom-Right */}
                      <div
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => handleResizeHandleDown(e, img, "se")}
                        className="absolute -bottom-1.5 -right-1.5 h-3 w-3 cursor-nwse-resize rounded-full border border-[#141210] bg-[#c3a47b] shadow"
                      />

                      {/* Nút xóa ảnh nổi bên trên */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSelectedImage();
                        }}
                        title="Xóa ảnh này (Delete)"
                        className="absolute -top-7 right-0 flex h-6 w-6 items-center justify-center rounded-md bg-[#1e1916] border border-[#3a3128] text-[#a89b8d] hover:text-rose-400 hover:bg-[#26201c] shadow"
                      >
                        <Trash className="h-3 w-3" strokeWidth={1.75} />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Canvas chính - Nằm trên lớp ảnh để viết/vẽ đè lên mặt ảnh */}
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className={cn(
              "absolute inset-0 z-20 block h-full w-full touch-none",
              tool === "select" ? "pointer-events-none" : "pointer-events-auto"
            )}
          />
        </div>
      </div>
    </div>
  );
}
