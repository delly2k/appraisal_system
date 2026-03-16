import { getHRReviewList, getHRReviewFilterOptions } from "@/lib/hr-review-data";
import { HRReviewPanel } from "@/components/hr-review-panel";

interface PageProps {
  searchParams: Promise<{ cycle?: string; division?: string; department?: string }>;
}

export default async function HRReviewPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = {
    cycleId: params.cycle ?? null,
    divisionId: params.division ?? null,
    departmentId: params.department ?? null,
  };

  const [rows, filterOptions] = await Promise.all([
    getHRReviewList(filters),
    getHRReviewFilterOptions(),
  ]);

  return <HRReviewPanel rows={rows} filterOptions={filterOptions} />;
}
