import { createFileRoute } from '@tanstack/react-router'
import { statusIntegracao } from '@/lib/onedrive-app.server'

export const Route = createFileRoute('/api/integrations/onedrive/status')({
  server: {
    handlers: {
      GET: async () => {
        const result = await statusIntegracao()
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }
  }
})
