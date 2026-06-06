resource "azurerm_postgresql_flexible_server" "main" {
  name                = "psql-${var.name_prefix}-prod"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location

  version    = var.pg_version
  sku_name   = var.pg_sku_name
  storage_mb = var.pg_storage_mb

  administrator_login    = var.pg_admin_login
  administrator_password = local.pg_admin_password

  # Public network access; access controlled via firewall rules below.
  public_network_access_enabled = true

  # Keep backups minimal for the scale-to-zero / sponsorship setup.
  backup_retention_days = 7

  # The chosen zone can shift between plans on flexible server; ignore drift.
  lifecycle {
    ignore_changes = [zone]
  }
}

resource "azurerm_postgresql_flexible_server_database" "kluch" {
  name      = var.db_name
  server_id = azurerm_postgresql_flexible_server.main.id
  collation = "en_US.utf8"
  charset   = "UTF8"
}

# Allow other Azure services (Container App) to reach the server.
# The 0.0.0.0 -> 0.0.0.0 range is the Azure "Allow public access from Azure services" rule.
resource "azurerm_postgresql_flexible_server_firewall_rule" "azure_services" {
  name             = "AllowAzureServices"
  server_id        = azurerm_postgresql_flexible_server.main.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

# Allow access from the public internet so the operator can connect from their
# local machine (run migrations, psql, manage data) without a fixed IP.
# Intentional trade-off for the early/scale-to-zero setup: security relies on
# the strong DB password + sslmode=require. Tighten to a specific IP later by
# setting var.allowed_client_ip and removing this broad rule.
resource "azurerm_postgresql_flexible_server_firewall_rule" "public" {
  name             = "AllowPublicInternet"
  server_id        = azurerm_postgresql_flexible_server.main.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "255.255.255.255"
}
