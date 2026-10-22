"use client";

import React, { useState } from "react";
import { Chess } from "chess.js";
import dynamic from "next/dynamic";

// Dynamic import for Chessboard to guarantee 100% SSR compatibility
const Chessboard = dynamic(
  () =>
    import("react-chessboard").then((mod) => ({
      default: mod.Chessboard || mod.default,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-96 text-amber-500 font-medium">
        Đang tải bàn cờ...
      </div>
    ),
  }
);

export function ChessBoard({
  game,
  setGame,
  room,
  roomCode,
  currentUser,
  socket,
  isHost: isHostProp,
  gameStatus = "playing",
  onAddToast,
  isWhitePlayer: isWhitePlayerProp,
  assignedColor,
  whitePlayerId,
  onGameOver,
  ...props
}) {
  // 1. Xác định vai cờ chính xác dựa theo kết quả bốc thăm ngẫu nhiên (50/50 roll)
  const currentUserId = String(currentUser?._id || currentUser?.id || "");
  const hostUserId = String(
    room?.host?._id ||
    room?.host ||
    room?.hostId?._id ||
    room?.hostId ||
    ""
  );

  const isHost =
    isHostProp !== undefined
      ? Boolean(isHostProp)
      : Boolean(currentUserId && hostUserId && currentUserId === hostUserId);

  const isWhite =
    typeof isWhitePlayerProp === "boolean"
      ? isWhitePlayerProp
      : whitePlayerId
      ? currentUserId === String(whitePlayerId)
      : assignedColor
      ? assignedColor === "w"
      : isHost;

  const playerColor = isWhite ? "w" : "b";
  const boardOrientation = isWhite ? "white" : "black";
  const isPlaying = (typeof gameStatus !== "undefined" ? gameStatus : "playing") === "playing";
  const isMyTurn = isPlaying && game.turn() === playerColor;

  // State quản lý ô được chọn và các ô gợi ý nước đi
  const [selectedSquare, setSelectedSquare] = useState("");
  const [optionSquares, setOptionSquares] = useState({});

  // Hàm thực thi nước đi và kiểm tra kết thúc ván cờ (Chiếu bí Checkmate, Hòa cờ Draw/Stalemate)
  const executeMove = (sourceSquare, targetSquare) => {
    try {
      const move = game.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      });

      if (!move) return false;

      const nextFen = game.fen();
      const nextGame = new Chess(nextFen);
      setGame(nextGame);
      setSelectedSquare("");
      setOptionSquares({});

      // Kiểm tra trạng thái ván cờ bằng các hàm chuẩn của chess.js
      const isCheckmate = nextGame.isCheckmate();
      const isDraw = nextGame.isDraw();
      const isGameOver = nextGame.isGameOver();
      let gameOverResult = null;

      if (isGameOver) {
        if (isCheckmate) {
          // Bên đến lượt đi bị chiếu bí -> Bên vừa đi cờ giành CHIẾN THẮNG
          const loserColor = nextGame.turn(); // 'w' hoặc 'b'
          const winnerColor = loserColor === "w" ? "b" : "w";
          gameOverResult = {
            type: "checkmate",
            winnerColor,
            winner: winnerColor === "w" ? "white" : "black",
            reason: "checkmate",
            message:
              winnerColor === "w"
                ? "Quân Trắng thắng bằng Chiếu Bí!"
                : "Quân Đen thắng bằng Chiếu Bí!",
          };
        } else if (isDraw) {
          gameOverResult = {
            type: "draw",
            winnerColor: null,
            winner: "draw",
            reason: "draw",
            message:
              "Ván đấu kết thúc với kết quả Hòa (Hết nước đi / Bất phân thắng bại)!",
          };
        }
      }

      if (socket) {
        const movePayload = {
          roomCode,
          move: {
            from: sourceSquare,
            to: targetSquare,
            promotion: "q",
            san: move.san || "",
          },
          fen: nextFen,
        };

        if (gameOverResult) {
          movePayload.isGameOver = true;
          movePayload.result = gameOverResult;
          movePayload.winner = gameOverResult.winner;
          movePayload.reason = gameOverResult.reason;
          movePayload.message = gameOverResult.message;
        }

        socket.emit("chess_move", movePayload);

        if (gameOverResult) {
          socket.emit("chess_game_over", {
            roomCode,
            result: gameOverResult,
            winner: gameOverResult.winner,
            reason: gameOverResult.reason,
            message: gameOverResult.message,
          });
          onGameOver?.(gameOverResult);
        }
      }
      return true;
    } catch (_) {
      return false;
    }
  };

  // 2. Kéo thả quân cờ (tương thích cả react-chessboard v5 object argument lẫn v4 separate arguments)
  const onPieceDrop = (arg1, arg2) => {
    const sourceSquare =
      typeof arg1 === "object" && arg1 !== null ? arg1.sourceSquare : arg1;
    const targetSquare =
      typeof arg1 === "object" && arg1 !== null ? arg1.targetSquare : arg2;

    if (!isPlaying || !isMyTurn || !sourceSquare || !targetSquare) return false;

    return executeMove(sourceSquare, targetSquare);
  };

  // 3. Click hiển thị nước đi có thể đi (onSquareClick - tương thích v5 { piece, square } và v4 square)
  const onSquareClick = (arg) => {
    const square =
      typeof arg === "object" && arg !== null && arg.square ? arg.square : arg;

    if (!square || typeof square !== "string") return;

    if (!isPlaying) {
      if (onAddToast) {
        onAddToast({
          key: "chess_not_started",
          type: "focus",
          title: "Ván đấu chưa bắt đầu",
          body: "Cả 2 người chơi cần bấm Bắt đầu để vào ván cờ.",
        });
      }
      return;
    }

    if (!isMyTurn) {
      if (onAddToast) {
        onAddToast({
          key: "chess_not_your_turn",
          type: "focus",
          title: "Chưa tới lượt bạn",
          body: "Vui lòng đợi đối thủ thực hiện nước đi.",
        });
      }
      return;
    }

    const piece = game.get(square);
    const isMyPiece =
      piece &&
      (piece.color === playerColor ||
        (typeof piece === "string" && piece.startsWith(playerColor)));

    // Nếu chưa chọn quân và click vào ô có quân của mình:
    if (!selectedSquare) {
      if (isMyPiece) {
        setSelectedSquare(square);
        const moves = game.moves({ square, verbose: true });
        if (moves.length === 0) {
          setOptionSquares({});
          return;
        }

        const newStyles = {
          [square]: {
            background: "rgba(245, 158, 11, 0.4)",
          },
        };
        moves.forEach((m) => {
          const isCapture = Boolean(game.get(m.to));
          newStyles[m.to] = {
            background: isCapture
              ? "radial-gradient(circle, rgba(239, 68, 68, 0.75) 80%, transparent 80%)"
              : "radial-gradient(circle, rgba(245, 158, 11, 0.8) 25%, transparent 25%)",
            borderRadius: "50%",
            cursor: "pointer",
          };
        });
        setOptionSquares(newStyles);
      }
      return;
    }

    // Click lại vào chính ô đang chọn -> Hủy chọn
    if (selectedSquare === square) {
      setSelectedSquare("");
      setOptionSquares({});
      return;
    }

    // Nếu đã chọn quân trước đó: kiểm tra xem square có nằm trong nước đi hợp lệ
    const movesFromSelected = game.moves({
      square: selectedSquare,
      verbose: true,
    });
    const isTargetValid = movesFromSelected.some((m) => m.to === square);

    if (isTargetValid) {
      const moved = executeMove(selectedSquare, square);
      if (moved) return;
    }

    // Nếu click vào một quân cờ khác của mình -> Chuyển sang chọn quân đó
    if (isMyPiece) {
      setSelectedSquare(square);
      const moves = game.moves({ square, verbose: true });
      const newStyles = {
        [square]: {
          background: "rgba(245, 158, 11, 0.4)",
        },
      };
      moves.forEach((m) => {
        const isCapture = Boolean(game.get(m.to));
        newStyles[m.to] = {
          background: isCapture
            ? "radial-gradient(circle, rgba(239, 68, 68, 0.75) 80%, transparent 80%)"
            : "radial-gradient(circle, rgba(245, 158, 11, 0.8) 25%, transparent 25%)",
          borderRadius: "50%",
          cursor: "pointer",
        };
      });
      setOptionSquares(newStyles);
      return;
    }

    // Nếu click ra ngoài ô không hợp lệ -> Reset
    setSelectedSquare("");
    setOptionSquares({});
  };

  // Kéo quân cờ: hiển thị gợi ý
  const onPieceDragBegin = (arg1, arg2) => {
    if (!isMyTurn) return;
    const sourceSquare =
      typeof arg1 === "object" && arg1 !== null && arg1.square
        ? arg1.square
        : arg2 || arg1;
    if (!sourceSquare || typeof sourceSquare !== "string") return;

    setSelectedSquare(sourceSquare);
    const moves = game.moves({ square: sourceSquare, verbose: true });
    const newStyles = {
      [sourceSquare]: {
        background: "rgba(245, 158, 11, 0.4)",
      },
    };
    moves.forEach((m) => {
      const isCapture = Boolean(game.get(m.to));
      newStyles[m.to] = {
        background: isCapture
          ? "radial-gradient(circle, rgba(239, 68, 68, 0.75) 80%, transparent 80%)"
          : "radial-gradient(circle, rgba(245, 158, 11, 0.8) 25%, transparent 25%)",
        borderRadius: "50%",
        cursor: "pointer",
      };
    });
    setOptionSquares(newStyles);
  };

  const onPieceDragEnd = () => {
    setOptionSquares({});
    setSelectedSquare("");
  };

  // Cấu hình options cho react-chessboard v5
  const chessboardOptions = {
    position: game.fen(),
    boardOrientation,
    allowDragging: isMyTurn,
    canDragPiece: ({ square }) => {
      if (!isMyTurn) return false;
      const piece = game.get(square);
      return Boolean(piece && piece.color === playerColor);
    },
    onPieceDrop,
    onSquareClick,
    onPieceDrag: onPieceDragBegin,
    onPieceDragCancel: onPieceDragEnd,
    squareStyles: optionSquares,
    darkSquareStyle: { backgroundColor: "#8a5a36" },
    lightSquareStyle: { backgroundColor: "#e2d6b5" },
    boardStyle: {
      borderRadius: "12px",
      boxShadow: "inset 0 0 10px rgba(0, 0, 0, 0.5)",
    },
  };

  return (
    <div className="relative z-10 pointer-events-auto">
      <Chessboard
        options={chessboardOptions}
        position={game.fen()}
        boardOrientation={boardOrientation}
        arePiecesDraggable={isMyTurn}
        onPieceDrop={onPieceDrop}
        onSquareClick={onSquareClick}
        onPieceDragBegin={onPieceDragBegin}
        onPieceDragEnd={onPieceDragEnd}
        customSquareStyles={optionSquares}
        customDarkSquareStyle={{ backgroundColor: "#8a5a36" }}
        customLightSquareStyle={{ backgroundColor: "#e2d6b5" }}
        customBoardStyle={{
          borderRadius: "12px",
          boxShadow: "inset 0 0 10px rgba(0, 0, 0, 0.5)",
        }}
      />
    </div>
  );
}

export default ChessBoard;
