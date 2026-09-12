export type DashboardCriterion = {
  orderNumber: number;
  name: string;
  description: string | null;
};

export type CriterionChartPoint = {
  name: string;
  value: number;
  text: string;
  description: string | null;
};

export type DashboardTrainingLike = {
  id: number;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  trainingType?: string | null;
};

export function filterTrainingsByType<T extends DashboardTrainingLike>(trainings: T[], trainingType: string | null | undefined): T[] {
  if (!trainingType) return trainings;
  return trainings.filter(training => training.trainingType === trainingType);
}

export function filterActiveTrainingIds<T extends DashboardTrainingLike>(trainings: T[]): Set<number> {
  return new Set(
    trainings
      .filter(training => training.status !== "ARCHIVED")
      .map(training => training.id)
  );
}

export function filterDashboardRecordsForActiveTrainings<T extends { trainingId: number }>(
  records: T[],
  activeTrainingIds: Set<number>
): T[] {
  return records.filter(record => activeTrainingIds.has(record.trainingId));
}

/** Aktif kriterleri, grafik ve açıklama listesinde ortak kullanılan sunum verisine dönüştürür. */
export function createCriteriaChartData(criteria: DashboardCriterion[], criterionAverages: number[]): CriterionChartPoint[] {
  return criteria.map((criterion, index) => ({
    name: `K${criterion.orderNumber}`,
    value: criterionAverages[index] ?? 0,
    text: criterion.name,
    description: criterion.description?.trim() || null,
  }));
}
