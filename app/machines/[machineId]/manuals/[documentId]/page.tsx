"use client";

import { notFound, useSearchParams } from "next/navigation";
import { ArticleView } from "@/components/knowledge/article/articleView";
import { machineManualsNavigation } from "@/lib/knowledge/knowledgeLinks";
import { useMachineDetail } from "../../machineDetailContext";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// /machines/:id/manuals/:documentId — a manual read inside the machine page,
// the same article the Knowledge screen shows.
const MachineManualArticlePage = ({ params }: { params: { documentId: string } }) => {
  const { machineId } = useMachineDetail();
  const initialSectionId = useSearchParams().get("section");
  if (!UUID.test(params.documentId)) notFound();

  return (
    <ArticleView
      documentId={params.documentId}
      navigation={machineManualsNavigation(machineId)}
      initialSectionId={initialSectionId}
      isEmbedded
    />
  );
};

export default MachineManualArticlePage;
