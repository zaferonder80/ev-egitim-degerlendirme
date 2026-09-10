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

/** Aktif kriterleri, grafik ve açıklama listesinde ortak kullanılan sunum verisine dönüştürür. */
export function createCriteriaChartData(criteria: DashboardCriterion[], criterionAverages: number[]): CriterionChartPoint[] {
  return criteria.map((criterion, index) => ({
    name: `K${criterion.orderNumber}`,
    value: criterionAverages[index] ?? 0,
    text: criterion.name,
    description: criterion.description?.trim() || null,
  }));
}
