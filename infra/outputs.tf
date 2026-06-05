output "acr_login_server" {
  description = "ACR login server, e.g. kluchacrxxxxxx.azurecr.io"
  value       = azurerm_container_registry.main.login_server
}

output "backend_fqdn" {
  description = "Container App ingress FQDN."
  value       = azurerm_container_app.backend.ingress[0].fqdn
}

output "backend_url" {
  description = "Public HTTPS URL of the backend."
  value       = "https://${azurerm_container_app.backend.ingress[0].fqdn}"
}

output "swa_default_hostname" {
  description = "Default hostname of the Static Web App (console)."
  value       = azurerm_static_web_app.console.default_host_name
}

output "swa_api_token" {
  description = "Deployment token for the Static Web App (used by the SWA CLI deploy)."
  value       = azurerm_static_web_app.console.api_key
  sensitive   = true
}

output "postgres_fqdn" {
  description = "PostgreSQL Flexible Server FQDN."
  value       = azurerm_postgresql_flexible_server.main.fqdn
}

output "storage_account_name" {
  description = "Blob storage account name."
  value       = azurerm_storage_account.main.name
}

output "pg_admin_password" {
  description = "Generated (or provided) PostgreSQL admin password."
  value       = local.pg_admin_password
  sensitive   = true
}

output "session_secret" {
  description = "Generated SESSION_SECRET for the backend."
  value       = random_password.session_secret.result
  sensitive   = true
}
