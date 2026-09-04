import { startingPointRule, distanceToGoalRule, bmiBandRule, journeyDurationRule, newRecordRule } from "./tier0.js";
import { personalNoiseBandRule, trueTrendLineRule } from "./tier1.js";
import { trendSignificanceRule, scaleVsTrendRecordRule, waterRetentionReversalRule, weekdayEffectRule } from "./tier2.js";
import { journeyPhasesRule, milestoneComparisonRule } from "./tier3.js";
import { waistHeightRatioRule, recompositionRule } from "./tier4.js";
import { markerEffectRule } from "./tier5.js";

// Ordem não importa para o ranking (rank.js reordena por score), mas
// mantém tudo num só lugar para inspeção e para os testes de propriedade.
export const RULES = [
  startingPointRule,
  distanceToGoalRule,
  bmiBandRule,
  journeyDurationRule,
  newRecordRule,
  personalNoiseBandRule,
  trueTrendLineRule,
  trendSignificanceRule,
  scaleVsTrendRecordRule,
  waterRetentionReversalRule,
  weekdayEffectRule,
  journeyPhasesRule,
  milestoneComparisonRule,
  waistHeightRatioRule,
  recompositionRule,
  markerEffectRule,
];
