"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Chess } from "chess.js";
import dynamic from "next/dynamic";
import { Track } from "livekit-client";
import { useParticipants, useTracks } from "@livekit/components-react";
import {
  Trophy,
  Flag,
  Play,
  RotateCcw,
  Clock,
  Swords,
  Copy,
  Check,
  AlertCircle,
  Users,
  LogOut,
  Sparkles,
  ShieldAlert,
  Scale,
} from "lucide-react";
import { VideoTile } from "@/components/room/VideoTile";
import { cn } from "@/lib/utils";
import ChessBoard from "@/components/chess/ChessBoard";
import { ChessFlipCard } from "@/components/chess/ChessFlipCard";
import GameOverModal from "@/components/chess/GameOverModal";
import runHomeData from "@/public/animations/run-home.json";
import { useConfirm } from "@/context/ConfirmContext";

// Dynamic import for Lottie to guarantee 100% SSR compatibility without DOM element collision
const Lottie = dynamic(
  () =>
    import("lottie-react").then((mod) => {
      const Component = mod.Lottie || mod.default;
      return function LottieComponent({
        animationData,
        src,
        loop = true,
        autoplay = true,
        ...props
      }) {
        const raw = src || animationData;
        const animationSource = raw?.default || raw;
        const isValid =
          animationSource &&
          typeof animationSource === "object" &&
          (animationSource.v || animationSource.layers || animationSource.ip !== undefined);

        if (!isValid) return null;

        return (
          <Component
            src={animationSource}
            loop={loop}
            autoplay={autoplay}
            {...props}
          />
        );
      };
    }),
  { ssr: false }
);

function formatTime(seconds) {
  if (typeof seconds !== "number" || isNaN(seconds) || seconds < 0) return "10:00";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function ChessStage({
  room,
  members = [],
  currentUser,
  socket,
  speakingId = null,
  onAddToast,
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const roomCode = room?.roomCode || "";
  const currentUserId = String(currentUser?._id || currentUser?.id || "");
  const roomHostId = String(
    room?.host?._id ||
    room?.host ||
    room?.hostId?._id ||
    room?.hostId ||
    ""
  );
  const isHost = Boolean(currentUserId && roomHostId && currentUserId === roomHostId);

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // LiveKit tracks & participants for PIP video tiles
  const participants = useParticipants();
  const trackReferences = useTracks([Track.Source.Camera], { onlySubscribed: false });

  // Chess game instance (quản lý bằng FEN và game instance)
  const [game, setGame] = useState(() => new Chess());
  const [gameFen, setGameFen] = useState(() => game.fen());
  const [gameStatus, setGameStatus] = useState("waiting"); // 'waiting' | 'playing' | 'finished'
  const [whitePlayerId, setWhitePlayerId] = useState(null);
  const [blackPlayerId, setBlackPlayerId] = useState(null);
  const [whitePlayerName, setWhitePlayerName] = useState("");
  const [blackPlayerName, setBlackPlayerName] = useState("");
  const [winner, setWinner] = useState(null);
  const [reason, setReason] = useState(null);
  const [remainingTime, setRemainingTime] = useState(600);
  const [closingCountdown, setClosingCountdown] = useState(null);
  const [readyPlayers, setReadyPlayers] = useState([]);
  const [isRolling, setIsRolling] = useState(false);
  const [rollData, setRollData] = useState(null);
  const [gameOverResult, setGameOverResult] = useState(null);
  const [isGameOverModalOpen, setIsGameOverModalOpen] = useState(false);

  // Timer interval ref cho đồng hồ đếm ngược 10:00 ở Client
  const timerRef = useRef(null);
  const onAddToastRef = useRef(onAddToast);
  useEffect(() => {
    onAddToastRef.current = onAddToast;
  }, [onAddToast]);

  const lastStartedToastRef = useRef(0);
  const lastGameOverToastRef = useRef(0);

  // Lottie animation data
  const [lottieData, setLottieData] = useState(null);
  const [hasCopiedCode, setHasCopiedCode] = useState(false);

  // Load Lottie animation from public/animations/12345.json
  useEffect(() => {
    fetch("/animations/12345.json")
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data === "object" && (data.v || data.layers || data.ip !== undefined)) {
          setLottieData(data);
        }
      })
      .catch((err) => console.warn("Lottie fetch fallback:", err));
  }, []);

  const handleGameOver = useCallback((result) => {
    // result: { type: 'checkmate' | 'draw' | 'resignation', winnerColor, message }
    console.log("Ván đấu kết thúc:", result);
    setGameStatus("finished");

    const finalWinner =
      result?.winner ||
      (result?.winnerColor
        ? result.winnerColor === "w"
          ? "white"
          : "black"
        : result?.type === "draw"
        ? "draw"
        : null);
    const finalReason = result?.reason || result?.type || "checkmate";
    if (finalWinner) setWinner(finalWinner);
    if (finalReason) setReason(finalReason);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Hiển thị toast hoặc modal kết quả
    if (onAddToast && result?.message) {
      onAddToast({
        title: "Kết thúc ván đấu",
        body: result.message,
      });
    }

    // Kích hoạt hiển thị modal kết quả ván cờ (nếu có modal GameOver)
    setGameOverResult(result);
    setIsGameOverModalOpen(true);
  }, [onAddToast]);

  const applyState = useCallback((state) => {
    if (!state) return;
    if (state.fen) {
      try {
        const newGame = new Chess(state.fen);
        setGame(newGame);
        setGameFen(state.fen);
      } catch (_) {}
    }
    if (state.gameStatus) setGameStatus(state.gameStatus);
    if (state.whitePlayerId) setWhitePlayerId(state.whitePlayerId);
    if (state.blackPlayerId) setBlackPlayerId(state.blackPlayerId);
    if (state.whitePlayerName) setWhitePlayerName(state.whitePlayerName);
    if (state.blackPlayerName) setBlackPlayerName(state.blackPlayerName);
    if (state.winner !== undefined) setWinner(state.winner);
    if (state.reason !== undefined) setReason(state.reason);
    if (Array.isArray(state.readyPlayers)) setReadyPlayers(state.readyPlayers);
    if (typeof state.remainingSeconds === "number") setRemainingTime(state.remainingSeconds);
    if (typeof state.closingSeconds === "number" && state.gameStatus === "finished") {
      setClosingCountdown(state.closingSeconds);
    }
  }, []);

  // Đồng hồ đếm ngược (10:00): kích hoạt setInterval đếm ngược mỗi giây ở client khi gameStatus === 'playing'
  useEffect(() => {
    if (gameStatus !== "playing") {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    timerRef.current = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          setGameStatus("finished");
          setWinner("draw");
          setReason("timeout");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [gameStatus]);

  // Request initial chess state on mount and listen to events
  useEffect(() => {
    if (!socket || !roomCode) return;

    socket.emit("chess:get_state", { roomCode }, (res) => {
      if (res?.success && res?.chessState) {
        applyState(res.chessState);
      }
    });
    socket.emit("chess_state", { roomCode });

    const handleStateUpdate = (state) => {
      if (state) applyState(state);
    };

    const handleRollStart = (data) => {
      if (!data) return;
      setRollData(data);
      setIsRolling(true);
      if (data.whiteUserId) setWhitePlayerId(data.whiteUserId);
      if (data.blackUserId) setBlackPlayerId(data.blackUserId);
      if (data.whitePlayerName) setWhitePlayerName(data.whitePlayerName);
      if (data.blackPlayerName) setBlackPlayerName(data.blackPlayerName);
    };

    const handleGameStarted = (state) => {
      if (state) applyState(state);
      setIsRolling(false);
      setGameStatus("playing");
      setGameOverResult(null);
      setIsGameOverModalOpen(false);
      setReadyPlayers([]);
      setClosingCountdown(null);
      if (typeof state?.remainingSeconds === "number") {
        setRemainingTime(state.remainingSeconds);
      }
      const now = Date.now();
      if (now - lastStartedToastRef.current > 3000) {
        lastStartedToastRef.current = now;
        if (onAddToastRef.current) {
          onAddToastRef.current({
            key: "chess_game_started",
            type: "focus",
            title: "Ván đấu bắt đầu!",
            body: "Đồng hồ 10:00 đã kích hoạt. Chúc bạn thi đấu tập trung!",
          });
        }
      }
    };

    const handleReadyUpdate = (data) => {
      const readyList = Array.isArray(data?.readyPlayers)
        ? data.readyPlayers
        : Array.isArray(data?.readyUserIds)
        ? data.readyUserIds
        : [];
      setReadyPlayers(readyList);
      if (data?.chessState) {
        applyState(data.chessState);
      }
    };

    const handleTimerTick = ({ remainingSeconds }) => {
      if (typeof remainingSeconds === "number") {
        setRemainingTime(remainingSeconds);
      }
    };

    const handleChessMove = ({
      move,
      fen: nextFen,
      isGameOver,
      result,
      winner: moveWinner,
      reason: moveReason,
      message: moveMessage,
    }) => {
      if (nextFen) {
        try {
          const newGame = new Chess(nextFen);
          setGame(newGame);
          setGameFen(nextFen);

          // Kiểm tra ván cờ kết thúc (Chiếu bí hoặc Hòa)
          if (isGameOver || newGame.isGameOver()) {
            const isCheckmate = newGame.isCheckmate();
            const isDraw = newGame.isDraw();
            let endResult = result || {};
            if (isCheckmate) {
              const loserColor = newGame.turn();
              const winnerColor = loserColor === "w" ? "b" : "w";
              endResult = {
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
              endResult = {
                type: "draw",
                winnerColor: null,
                winner: "draw",
                reason: "draw",
                message:
                  "Ván đấu kết thúc với kết quả Hòa (Hết nước đi / Bất phân thắng bại)!",
              };
            }
            handleSocketGameOver({
              winner: endResult.winner || moveWinner,
              reason: endResult.reason || moveReason,
              message: endResult.message || moveMessage,
              result: endResult,
            });
          }
        } catch (_) {}
      }
    };

    const handleSocketGameOver = ({ winner: w, reason: r, message, result, chessState }) => {
      setGameStatus("finished");
      const finalWinner =
        w ||
        result?.winner ||
        (result?.winnerColor ? (result.winnerColor === "w" ? "white" : "black") : "draw");
      const finalReason = r || result?.reason || result?.type || "checkmate";
      setWinner(finalWinner);
      setReason(finalReason);
      setGameOverResult(result || { winner: finalWinner, reason: finalReason, message });
      setIsGameOverModalOpen(true);
      setReadyPlayers([]);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (chessState?.fen) {
        try {
          setGame(new Chess(chessState.fen));
          setGameFen(chessState.fen);
        } catch (_) {}
      }
      const now = Date.now();
      if (now - lastGameOverToastRef.current > 3000) {
        lastGameOverToastRef.current = now;
        if (onAddToastRef.current) {
          onAddToastRef.current({
            key: "chess_game_over",
            type: "focus",
            title: "Ván cờ kết thúc",
            body: message || result?.message || "Ván đấu đã khép lại. Phòng sẽ đóng sau 60 giây.",
          });
        }
      }
    };

    const handleClosingCountdown = ({ closingSeconds }) => {
      setClosingCountdown(closingSeconds);
    };

    socket.on("chess_state", handleStateUpdate);
    socket.on("chess:state_update", handleStateUpdate);
    socket.on("chess_roll_start", handleRollStart);
    socket.on("chess:roll_start", handleRollStart);
    socket.on("chess_started", handleGameStarted);
    socket.on("chess:game_started", handleGameStarted);
    socket.on("chess_ready_update", handleReadyUpdate);
    socket.on("chess:ready_update", handleReadyUpdate);
    socket.on("chess_timer_tick", handleTimerTick);
    socket.on("chess:timer_tick", handleTimerTick);
    socket.on("chess_move", handleChessMove);
    socket.on("chess:move", handleChessMove);
    socket.on("chess_game_over", handleSocketGameOver);
    socket.on("chess:game_over", handleSocketGameOver);
    socket.on("chess_closing_countdown", handleClosingCountdown);
    socket.on("chess:closing_countdown", handleClosingCountdown);

    return () => {
      socket.off("chess_state", handleStateUpdate);
      socket.off("chess:state_update", handleStateUpdate);
      socket.off("chess_roll_start", handleRollStart);
      socket.off("chess:roll_start", handleRollStart);
      socket.off("chess_started", handleGameStarted);
      socket.off("chess:game_started", handleGameStarted);
      socket.off("chess_ready_update", handleReadyUpdate);
      socket.off("chess:ready_update", handleReadyUpdate);
      socket.off("chess_timer_tick", handleTimerTick);
      socket.off("chess:timer_tick", handleTimerTick);
      socket.off("chess_move", handleChessMove);
      socket.off("chess:move", handleChessMove);
      socket.off("chess_game_over", handleSocketGameOver);
      socket.off("chess:game_over", handleSocketGameOver);
      socket.off("chess_closing_countdown", handleClosingCountdown);
      socket.off("chess:closing_countdown", handleClosingCountdown);
    };
  }, [socket, roomCode, applyState]);

  // Enrich members with LiveKit camera track and microphone status
  const enrichMember = useCallback(
    (member) => {
      if (!member) return null;
      const lkParticipant = participants.find(
        (p) =>
          String(p.identity) === String(member.id) ||
          (p.name && member.name && p.name.trim() === member.name.trim())
      );
      const camTrack = trackReferences.find(
        (t) =>
          String(t.participant.identity) === String(member.id) ||
          (lkParticipant && t.participant.identity === lkParticipant.identity)
      );

      const isSpeaking = Boolean(
        lkParticipant?.isSpeaking || member.isSpeaking || speakingId === member.id
      );

      return {
        ...member,
        trackRef: camTrack,
        cameraOn: lkParticipant ? lkParticipant.isCameraEnabled : member.cameraOn,
        micOn: lkParticipant ? lkParticipant.isMicrophoneEnabled : member.micOn,
        isSpeaking,
      };
    },
    [participants, trackReferences, speakingId]
  );

  // Self member & Opponent member identification
  const selfMember = useMemo(() => {
    const found = members.find((m) => m.isYou || String(m.id) === currentUserId) || members[0];
    return enrichMember(found);
  }, [members, currentUserId, enrichMember]);

  const opponentMember = useMemo(() => {
    const found = members.find((m) => !m.isYou && String(m.id) !== currentUserId);
    return enrichMember(found);
  }, [members, currentUserId, enrichMember]);

  const participantsCount = members.length;

  // Board orientation & player identification
  const isWhitePlayer = whitePlayerId
    ? String(whitePlayerId) === currentUserId
    : isHost;
  const isBlackPlayer = blackPlayerId
    ? String(blackPlayerId) === currentUserId
    : !isHost && members.length > 1;

  const boardOrientation = isWhitePlayer ? "white" : "black";

  // Check turn
  const currentTurn = game.turn(); // 'w' | 'b'
  const myColor = isWhitePlayer ? "w" : "b";
  const isMyTurn = (currentTurn === "w" && isWhitePlayer) || (currentTurn === "b" && !isWhitePlayer);

  // Ready status check
  const isMeReady = readyPlayers.some((id) => String(id) === currentUserId);
  const isOpponentReady = readyPlayers.some((id) => String(id) !== currentUserId);

  // Handle player ready / rematch click
  const handlePlayerReady = () => {
    if (!socket || !roomCode || isMeReady) return;
    socket.emit("chess_player_ready", { roomCode, userId: currentUserId });
    socket.emit("chess:player_ready", { roomCode, userId: currentUserId });
  };

  // Handle resign click
  const handleResign = async () => {
    if (!socket || !roomCode) return;
    const isConfirmed = await confirm({
      title: "Đầu hàng ván cờ",
      message: "Bạn có chắc chắn muốn đầu hàng ván đấu này không?",
      confirmText: "Đầu hàng",
      cancelText: "Tiếp tục chơi",
      variant: "danger",
    });
    if (isConfirmed) {
      socket.emit("chess:resign", { roomCode });
      socket.emit("chess_resign", { roomCode });
    }
  };

  // Handle copy room code
  const handleCopyCode = () => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode);
    setHasCopiedCode(true);
    setTimeout(() => setHasCopiedCode(false), 2000);
    if (onAddToast) {
      onAddToast({
        type: "link",
        title: "Đã sao chép mã phòng",
        body: `Mã phòng [${roomCode}] đã được sao chép vào bộ nhớ đệm.`,
      });
    }
  };

  // Rời phòng ngay lập tức về sảnh danh sách phòng
  const handleLeaveRoom = () => {
    if (socket && roomCode) {
      socket.emit("room:leave", { roomCode });
      socket.emit("leave_room", { roomCode });
    }
    router.push("/dashboard?book=rooms");
  };

  if (!isMounted) {
    return (
      <div className="flex h-full w-full items-center justify-center p-4">
        <div className="flex items-center justify-center h-96 text-amber-500 font-medium">
          Đang tải bàn cờ...
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full min-h-0 flex-col items-center justify-center overflow-y-auto overflow-x-hidden p-2 py-4">
      {/* 1. THẺ VIDEO ĐỐI THỦ: Cố định góc trên bên trái */}
      <div className="fixed top-20 left-6 z-30 h-[130px] w-[220px] overflow-hidden rounded-2xl border-2 border-amber-500/40 bg-zinc-900/80 shadow-2xl backdrop-blur-md transition-all hover:border-amber-400">
        {opponentMember ? (
          <VideoTile
            member={opponentMember}
            isSpeaking={opponentMember.isSpeaking}
            className="h-full w-full rounded-2xl border-0"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center p-3 text-center">
            <Users className="mb-1.5 h-6 w-6 animate-pulse text-amber-400/60" />
            <p className="text-xs font-medium text-amber-200/90">Đang chờ đối thủ...</p>
            <span className="text-[10px] text-zinc-400">Ghế Đen chưa có người</span>
          </div>
        )}
      </div>

      {/* 2. THẺ VIDEO BẢN THÂN: Cố định góc dưới bên phải */}
      <div className="fixed bottom-24 right-6 z-30 h-[130px] w-[220px] overflow-hidden rounded-2xl border-2 border-amber-500/40 bg-zinc-900/80 shadow-2xl backdrop-blur-md transition-all hover:border-amber-400">
        {selfMember ? (
          <VideoTile
            member={selfMember}
            isSpeaking={selfMember.isSpeaking}
            className="h-full w-full rounded-2xl border-0"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
            Bạn
          </div>
        )}
      </div>

      {/* 3. KHU VỰC TRUNG TÂM */}
      {participantsCount < 2 ? (
        /* TRẠNG THÁI CHỜ ĐỐI THỦ (1 người) */
        <div className="flex flex-col items-center justify-center text-center animate-in fade-in duration-500">
          <div className="relative mb-6 flex h-48 w-48 sm:h-56 sm:w-56 items-center justify-center">
            {isMounted && (runHomeData || lottieData) ? (
              <Lottie 
                animationData={runHomeData || lottieData} 
                loop={true} 
                className="h-44 w-44" 
              />
            ) : (
              <div className="relative flex h-36 w-36 items-center justify-center rounded-full border-4 border-amber-500/30">
                <Swords className="h-16 w-16 animate-pulse text-amber-400" />
              </div>
            )}
          </div>

          <h3 className="font-serif text-2xl sm:text-3xl font-medium tracking-wide text-amber-100 drop-shadow">
            Đang chờ đối thủ vào phòng...
          </h3>
          <p className="mt-2 max-w-sm text-sm text-amber-200/70">
            Phòng thi đấu cờ vua 1v1 tự động giới hạn tối đa 2 người. Chia sẻ mã phòng cho bạn bè để bắt đầu ván cờ.
          </p>

          <button
            onClick={handleCopyCode}
            className="mt-6 flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-950/40 px-5 py-2.5 text-xs font-semibold tracking-wider uppercase text-amber-200 shadow-lg backdrop-blur hover:bg-amber-900/60 hover:text-white transition-all cursor-pointer active:scale-95"
          >
            {hasCopiedCode ? (
              <Check className="h-4 w-4 text-emerald-400" />
            ) : (
              <Copy className="h-4 w-4 text-amber-300" />
            )}
            <span>Mã phòng: <strong className="font-mono text-amber-300">{roomCode}</strong></span>
          </button>
        </div>
      ) : (
        /* TRẠNG THÁI THI ĐẤU CỜ VUA (2 người) */
        <div className="relative flex flex-col items-center justify-center">
          {/* Thanh công cụ & Đồng hồ ván đấu (Dark Academia Header Card) */}
          <div className="w-full max-w-[500px] mb-3 px-4 py-2.5 rounded-xl bg-[#1c1815]/90 border border-amber-500/20 backdrop-blur-sm shadow-lg flex items-center justify-between gap-3">
            {/* Cụm bên trái: Đồng hồ & Trạng thái ván đấu */}
            <div className="flex items-center gap-3 min-w-0">
              {/* Đồng hồ 10:00 */}
              <div className="flex items-center gap-1.5 text-[#F59E0B]">
                <Clock
                  className={cn("h-4 w-4 shrink-0", gameStatus === "playing" && "animate-spin")}
                  style={{ animationDuration: "3s" }}
                />
                <span className="font-mono text-base sm:text-lg font-bold tracking-wider">
                  {formatTime(remainingTime)}
                </span>
              </div>

              {/* Dấu phân cách */}
              <div className="h-4 w-px bg-amber-500/20 shrink-0" />

              {/* Trạng thái ván cờ */}
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className={cn(
                    "inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-black/40",
                    currentTurn === "w"
                      ? "bg-amber-100 shadow-[0_0_8px_#fef3c7]"
                      : "bg-zinc-800 shadow-[0_0_8px_#3f3f46]"
                  )}
                />
                <span className="truncate text-xs font-medium text-amber-200/90">
                  {isRolling
                    ? "Đang bốc thăm màu cờ..."
                    : gameStatus === "playing"
                    ? isMyTurn
                      ? "Lượt của bạn"
                      : "Lượt đối thủ"
                    : gameStatus === "finished"
                    ? `Ván đấu kết thúc - ${
                        reason === "checkmate"
                          ? "Chiếu bí"
                          : reason === "draw" || reason === "stalemate"
                          ? "Hòa cờ"
                          : reason === "timeout"
                          ? "Hết giờ"
                          : reason === "resignation"
                          ? "Đầu hàng"
                          : "Kết thúc"
                      }`
                    : "Chưa bắt đầu"}
                </span>
              </div>
            </div>

            {/* Cụm bên phải: Badge đối thủ sẵn sàng & Nút hành động */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Badge "Đối thủ đã sẵn sàng!" */}
              {gameStatus !== "playing" && isOpponentReady && (
                <span className="bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm animate-pulse whitespace-nowrap">
                  <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <span className="hidden sm:inline">Đối thủ đã sẵn sàng!</span>
                  <span className="sm:hidden">Sẵn sàng</span>
                </span>
              )}

              {/* Nút hành động */}
              {gameStatus === "playing" ? (
                <button
                  type="button"
                  onClick={handleResign}
                  className="flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-950/50 px-3.5 py-1.5 text-xs font-medium text-red-200 shadow-md hover:bg-red-900/60 hover:text-white transition-all active:scale-95 cursor-pointer whitespace-nowrap"
                >
                  <Flag className="h-3.5 w-3.5 shrink-0" />
                  <span>Đầu hàng</span>
                </button>
              ) : isMeReady ? (
                <button
                  type="button"
                  disabled
                  className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-950/40 px-3.5 py-1.5 text-xs font-medium text-amber-300/90 opacity-90 cursor-not-allowed shadow-md whitespace-nowrap"
                >
                  <Clock className="h-3.5 w-3.5 shrink-0 animate-spin text-amber-400" />
                  <span>
                    {gameStatus === "finished" ? "Chờ đối thủ..." : "Đã sẵn sàng - Chờ đối thủ..."}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePlayerReady}
                  className="bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs px-3.5 py-1.5 rounded-lg shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  {gameStatus === "finished" ? (
                    <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <Play className="h-3.5 w-3.5 shrink-0 fill-current" />
                  )}
                  <span>{gameStatus === "finished" ? "Ván mới" : "Bắt đầu"}</span>
                </button>
              )}
            </div>
          </div>

          {/* Bàn cờ vua 2D phong cách Dark Academia */}
          <div className="relative z-10 pointer-events-auto flex items-center justify-center p-2 rounded-2xl border-4 border-[#3d2f23] bg-[#1a1410] shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden">
            <div className="relative z-10 pointer-events-auto w-[340px] sm:w-[440px] md:w-[480px]">
              <ChessBoard
                game={game}
                setGame={(newG) => {
                  setGame(newG);
                  setGameFen(newG.fen());
                }}
                room={room}
                roomCode={roomCode}
                currentUser={currentUser}
                socket={socket}
                isHost={isHost}
                isWhitePlayer={isWhitePlayer}
                whitePlayerId={whitePlayerId}
                gameStatus={gameStatus}
                onAddToast={onAddToast}
                onGameOver={handleGameOver}
              />
            </div>

            {/* Thẻ 3D Flip Card Bốc thăm màu cờ ngẫu nhiên trước trận đấu */}
            {isRolling && (
              <ChessFlipCard
                isWhite={isWhitePlayer}
                onComplete={() => setIsRolling(false)}
              />
            )}

            {/* Modal thông báo kết quả trang trọng (Dark Academia style via React Portal) */}
            <GameOverModal
              isOpen={gameStatus === "finished" || isGameOverModalOpen}
              gameOverResult={gameOverResult}
              winner={winner}
              reason={reason}
              isWhitePlayer={isWhitePlayer}
              closingCountdown={closingCountdown}
              isMeReady={isMeReady}
              isOpponentReady={isOpponentReady}
              onPlayerReady={handlePlayerReady}
              onLeaveRoom={handleLeaveRoom}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default ChessStage;
