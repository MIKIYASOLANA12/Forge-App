"use client";

import React from "react";
import { TopicAssessmentModal } from "./TopicAssessmentModal";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  subjectKey: string;
  topicId: string;
  onQuizCompleted?: () => void;
}

export function TopicQuizModal({
  isOpen,
  onClose,
  subjectKey,
  topicId,
  onQuizCompleted,
}: Props) {
  return (
    <TopicAssessmentModal
      isOpen={isOpen}
      onClose={onClose}
      subjectKey={subjectKey}
      topicId={topicId}
      onAssessmentCompleted={() => {
        if (onQuizCompleted) onQuizCompleted();
      }}
    />
  );
}
