export type EvaluationScoreSummary = {
  totalScore: number;
  averageScore: number;
  successPercentage: number;
  successStatus: "SUCCESSFUL" | "UNSUCCESSFUL";
};

export function calculateEvaluationScores(scores: number[], passingScore = 70, maxScore = 5): EvaluationScoreSummary {
  if (scores.length !== 8 || scores.some(score => !Number.isInteger(score) || score < 1 || score > maxScore)) {
    throw new Error(`Değerlendirme sekiz adet, 1 ile ${maxScore} arasında tam sayı puan içermelidir.`);
  }
  const totalScore = scores.reduce((sum, score) => sum + score, 0);
  const averageScore = totalScore / 8;
  const successPercentage = (totalScore / (8 * maxScore)) * 100;
  return {
    totalScore,
    averageScore,
    successPercentage,
    successStatus: successPercentage >= passingScore ? "SUCCESSFUL" : "UNSUCCESSFUL",
  };
}

export function calculateWeightedEvaluationScores(criteria: Array<{ score: number; weight: number }>, passingScore = 70, maxScore = 5): EvaluationScoreSummary {
  if (criteria.length === 0) {
    throw new Error("En az bir kriter puanlanmalıdır.");
  }
  if (maxScore <= 0) {
    throw new Error("Rubrik maksimum puanı pozitif olmalıdır.");
  }

  const totalWeight = criteria.reduce((sum, criterion) => sum + criterion.weight, 0);
  const weightedTotal = criteria.reduce((sum, criterion) => sum + ((criterion.score / maxScore) * criterion.weight), 0);
  const successPercentage = (weightedTotal / totalWeight) * 100;

  return {
    totalScore: Math.round(weightedTotal),
    averageScore: weightedTotal / criteria.length,
    successPercentage,
    successStatus: successPercentage >= passingScore ? "SUCCESSFUL" : "UNSUCCESSFUL",
  };
}

export function aggregateCompletedEvaluations(completedScores: number[][]) {
  if (completedScores.length === 0) {
    return { completedCount: 0, averageTotalScore: null, successPercentage: null, successStatus: null as null | "SUCCESSFUL" | "UNSUCCESSFUL", criterionAverages: [] as number[] };
  }
  const summaries = completedScores.map(calculateEvaluationScores);
  const criterionAverages = Array.from({ length: 8 }, (_, index) =>
    completedScores.reduce((sum, scores) => sum + scores[index], 0) / completedScores.length,
  );
  const averageTotalScore = summaries.reduce((sum, summary) => sum + summary.totalScore, 0) / summaries.length;
  const successPercentage = (averageTotalScore / 40) * 100;
  return {
    completedCount: summaries.length,
    averageTotalScore,
    successPercentage,
    successStatus: successPercentage >= 70 ? "SUCCESSFUL" as const : "UNSUCCESSFUL" as const,
    criterionAverages,
  };
}
