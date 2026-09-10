export type EvaluationScoreSummary = {
  totalScore: number;
  averageScore: number;
  successPercentage: number;
  successStatus: "SUCCESSFUL" | "UNSUCCESSFUL";
};

export function calculateEvaluationScores(scores: number[]): EvaluationScoreSummary {
  if (scores.length !== 8 || scores.some(score => !Number.isInteger(score) || score < 1 || score > 5)) {
    throw new Error("Değerlendirme sekiz adet, 1 ile 5 arasında tam sayı puan içermelidir.");
  }
  const totalScore = scores.reduce((sum, score) => sum + score, 0);
  const averageScore = totalScore / 8;
  const successPercentage = (totalScore / 40) * 100;
  return {
    totalScore,
    averageScore,
    successPercentage,
    successStatus: successPercentage >= 70 ? "SUCCESSFUL" : "UNSUCCESSFUL",
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
