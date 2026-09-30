import { notFound } from "next/navigation";
import { CaseThreadView } from "./components/caseThreadView";

interface CaseDetailPageProps {
  params: { caseId: string };
}

// /cases/1042 — the case number, not the database id.
const CaseDetailPage = ({ params }: CaseDetailPageProps) => {
  const caseNumber = Number(params.caseId);
  if (!Number.isInteger(caseNumber) || caseNumber <= 0) notFound();

  return <CaseThreadView caseNumber={caseNumber} />;
};

export default CaseDetailPage;
