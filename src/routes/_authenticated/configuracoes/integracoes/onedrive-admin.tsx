import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { getOneDriveAdminConfig, saveOneDriveAdminConfig, testOneDriveAdminConnection, onedriveHistorico } from '@/lib/onedrive-admin.functions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Loader2, CheckCircle2, XCircle, RefreshCw, ShieldCheck, History, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export const Route = createFileRoute('/_authenticated/configuracoes/integracoes/onedrive-admin')({
  component: OneDriveAdminPage,
})

function OneDriveAdminPage() {
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [config, setConfig] = useState<any>(null)
  const [audit, setAudit] = useState<any[]>([])
  
  const getFn = useServerFn(getOneDriveAdminConfig)
  const saveFn = useServerFn(saveOneDriveAdminConfig)
  const testFn = useServerFn(testOneDriveAdminConnection)
  const auditFn = useServerFn(onedriveHistorico)

  const [formData, setFormData] = useState({
    tenantId: '',
    clientId: '',
    clientSecret: '',
    targetUserId: '',
    targetUserEmail: '',
    driveId: '',
    webUrl: ''
  })

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const [data, logs] = await Promise.all([getFn(), auditFn()])
      if (data) {
        setConfig(data)
        setFormData({
          tenantId: data.tenantId,
          clientId: data.clientId,
          clientSecret: '', // Nunca recebemos o segredo
          targetUserId: data.targetUserId,
          targetUserEmail: data.targetUserEmail,
          driveId: data.driveId,
          webUrl: data.webUrl
        })
      }
      setAudit(logs || [])
    } catch (e) {
      toast.error('Erro ao carregar configurações')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.clientSecret && !config?.clientSecretConfigured) {
      toast.error('Client Secret é obrigatório')
      return
    }

    setLoading(true)
    try {
      await saveFn({ data: formData as any })
      toast.success('Configurações salvas com sucesso')
      load()
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar')
    } finally {
      setLoading(false)
    }
  }

  async function handleTest() {
    setTesting(true)
    try {
      const res = await testFn()
      if (res.ok) {
        toast.success(`Teste concluído: operacional (${res.latency}ms)`)
      } else {
        toast.error(`Teste falhou: ${res.error}`)
      }
      load()
    } catch (e: any) {
      toast.error(e.message || 'Erro durante o teste')
    } finally {
      setTesting(false)
    }
  }

  if (loading && !config) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="container max-w-5xl py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integração Microsoft OneDrive</h1>
          <p className="text-muted-foreground">Configurações globais de armazenamento em nuvem via Azure AD (Client Credentials).</p>
        </div>
        <div className="flex items-center gap-2">
          {config?.status === 'operacional' ? (
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 px-3 py-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Operacional
            </Badge>
          ) : config?.status === 'erro' ? (
            <Badge variant="destructive" className="gap-1 px-3 py-1">
              <XCircle className="h-3.5 w-3.5" /> Erro na Conexão
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1 px-3 py-1">
              <RefreshCw className="h-3.5 w-3.5" /> Aguardando Configuração
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <form onSubmit={handleSave}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" /> Credenciais do Azure AD
                </CardTitle>
                <CardDescription>
                  Estes dados são obtidos no portal do Azure > Entra ID > App Registrations.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tenantId">Tenant ID</Label>
                    <Input 
                      id="tenantId" 
                      value={formData.tenantId} 
                      onChange={e => setFormData(d => ({...d, tenantId: e.target.value}))} 
                      placeholder="GUID do seu Tenant"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clientId">Client ID</Label>
                    <Input 
                      id="clientId" 
                      value={formData.clientId} 
                      onChange={e => setFormData(d => ({...d, clientId: e.target.value}))} 
                      placeholder="GUID do Aplicativo"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientSecret">Client Secret</Label>
                  <Input 
                    id="clientSecret" 
                    type="password"
                    value={formData.clientSecret} 
                    onChange={e => setFormData(d => ({...d, clientSecret: e.target.value}))} 
                    placeholder={config?.clientSecretConfigured ? "Configurado (digite para alterar)" : "Segredo do cliente"}
                    required={!config?.clientSecretConfigured}
                  />
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Segurança: Armazenado com AES-256-GCM no servidor.</p>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Alvo de Armazenamento</CardTitle>
                <CardDescription>
                  Defina o usuário e o drive onde os arquivos do RDO serão armazenados.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="targetUserEmail">E-mail da Conta Técnica</Label>
                    <Input 
                      id="targetUserEmail" 
                      type="email"
                      value={formData.targetUserEmail} 
                      onChange={e => setFormData(d => ({...d, targetUserEmail: e.target.value}))} 
                      placeholder="sistemas@empresa.com.br"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="targetUserId">Object ID do Usuário</Label>
                    <Input 
                      id="targetUserId" 
                      value={formData.targetUserId} 
                      onChange={e => setFormData(d => ({...d, targetUserId: e.target.value}))} 
                      placeholder="GUID do usuário no Azure"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="driveId">ID do Drive</Label>
                    <Input 
                      id="driveId" 
                      value={formData.driveId} 
                      onChange={e => setFormData(d => ({...d, driveId: e.target.value}))} 
                      placeholder="b!..."
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="webUrl">URL do OneDrive</Label>
                    <Input 
                      id="webUrl" 
                      type="url"
                      value={formData.webUrl} 
                      onChange={e => setFormData(d => ({...d, webUrl: e.target.value}))} 
                      placeholder="https://..."
                      required
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end gap-3 bg-muted/30 py-4">
                <Button variant="outline" type="button" onClick={() => load()}>Cancelar</Button>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar Configurações
                </Button>
              </CardFooter>
            </Card>
          </form>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                variant="secondary" 
                className="w-full justify-start" 
                disabled={testing || !config}
                onClick={handleTest}
              >
                {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Testar Conexão
              </Button>
              {config?.webUrl && (
                <Button variant="outline" className="w-full justify-start" asChild>
                  <a href={config.webUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" /> Ver Pasta Raiz
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <History className="h-4 w-4" /> Histórico
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableBody>
                  {audit.slice(0, 5).map((log, i) => (
                    <TableRow key={i}>
                      <TableCell className="py-2 text-[10px]">
                        <div className="font-medium">{log.acao}</div>
                        <div className="text-muted-foreground">
                          {format(new Date(log.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
