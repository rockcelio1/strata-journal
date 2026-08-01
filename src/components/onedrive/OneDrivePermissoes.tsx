import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { onedriveListarPermissoes } from "@/lib/onedrive-admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Loader2 } from "lucide-react";

export function OneDrivePermissoes() {
  const permFn = useServerFn(onedriveListarPermissoes);
  const { data, isLoading } = useQuery({
    queryKey: ["onedrive", "permissoes"],
    queryFn: () => permFn(),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" /> Permissões de Usuário (OneDrive)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
        ) : (
          <div className="text-xs text-muted-foreground text-center py-2">
            {(data as any[])?.length ? `${(data as any[]).length} permissões configuradas.` : "Nenhuma permissão especial configurada."}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
