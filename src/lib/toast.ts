// Fachada padrão de notificações do sistema.
// Todas as telas devem usar `notify` em vez de importar `toast` diretamente,
// garantindo mensagem centralizada e rápida em toda a aplicação.
export { notify } from "@/components/system-notice";
