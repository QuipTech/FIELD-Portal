import { LightRoutingThresholds } from './bedrockConfig';
import { ModelTier, TechnicalQuestion } from './types/technicalResponse';

export const countContextChars = (question: TechnicalQuestion): number =>
  (question.chunks ?? []).reduce(
    (total, chunk) => total + chunk.text.length,
    0,
  );

// Short lookup-style questions over a small amount of retrieved context
// go to the light model; anything with a photo, a long thread or a lot
// of material to reason over stays on the primary model.
export const selectModelTier = (
  question: TechnicalQuestion,
  thresholds: LightRoutingThresholds,
): ModelTier => {
  const isSimple =
    thresholds.isEnabled &&
    !question.image &&
    question.question.length <= thresholds.maxQuestionChars &&
    countContextChars(question) <= thresholds.maxContextChars &&
    question.history.length <= thresholds.maxHistoryMessages;
  return isSimple ? 'light' : 'primary';
};
