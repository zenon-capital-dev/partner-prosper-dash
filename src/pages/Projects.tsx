import { FolderKanban } from "lucide-react";
import { PlaceholderPage } from "@/components/PlaceholderPage";
export default function Projects() {
  return (
    <PlaceholderPage
      title="Projetos"
      description="Acompanhe projetos previstos, em andamento e concluídos."
      icon={FolderKanban}
    />
  );
}
