"use client";

import CreatePollModal from "@/components/chat/CreatePollModal";
import PollMessageItem from "@/components/chat/PollMessageItem";

export { CreatePollModal, PollMessageItem };

/**
 * PollMessageCard: Wrapper tương thích ngược cho PollMessageItem
 */
export function PollMessageCard(props) {
  return <PollMessageItem {...props} />;
}

export default PollMessageItem;
