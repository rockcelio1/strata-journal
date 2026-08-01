import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/integrations/onedrive/health')({
  server: {
    handlers: {
      GET: async () => {
        return new Response(JSON.stringify({ 
          status: "ok", 
          service: "onedrive-gateway", 
          timestamp: new Date().toISOString() 
        }), {
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }
  }
})
