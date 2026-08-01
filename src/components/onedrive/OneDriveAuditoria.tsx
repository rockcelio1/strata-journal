import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { onedriveHistorico } from "@/lib/onedrive-admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { History, Loader2 } from "lucide-react";

export function OneDriveAuditoria() {
  const auditFn = useServerFn(onedriveHistorico);
  const { data, isLoading } = useQuery({
    queryKey: ["onedrive", "auditoria"],
    queryFn: () => auditFn(),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <History className="h-4 w-4" /> Auditoria de Configuração
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data as any[])?.map((log: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="text-[10px]">
                    {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-[10px] font-medium">{log.acao}</TableCell>
                  <TableCell className="text-[10px] text-muted-foreground max-w-[200px] truncate">
                    {JSON.stringify(log.detalhes)}
                  </TableCell>
                </TableRow>
              ))}
              {!(data as any[])?.length && (
                <TableRow><TableCell colSpan={3} className="text-center text-xs text-muted-foreground">Nenhum registro.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
