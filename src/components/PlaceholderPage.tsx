import { PageHeader } from "@/components/PageHeader";
import { LucideIcon } from "lucide-react";

interface Props {
  title: string;
  description: string;
  icon: LucideIcon;
}

export function PlaceholderPage({ title, description, icon: Icon }: Props) {
  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto animate-fade-in">
      <PageHeader title={title} description={description} />
      <div className="vx-card p-16 flex flex-col items-center justify-center text-center">
        <div className="size-16 rounded-2xl bg-primary-muted text-primary flex items-center justify-center mb-4">
          <Icon className="size-7" />
        </div>
        <h3 className="font-display text-lg font-bold mb-2">Módulo em construção</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Esta seção está sendo finalizada. Em breve você terá acesso completo a {title.toLowerCase()}.
        </p>
      </div>
    </div>
  );
}
