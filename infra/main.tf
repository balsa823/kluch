resource "azurerm_resource_group" "main" {
  name     = var.resource_group_name
  location = var.location
}

# Random suffix to make globally-unique names (storage account, ACR) collision-free.
resource "random_string" "suffix" {
  length  = 6
  upper   = false
  special = false
  numeric = true
}

# Generated secrets ----------------------------------------------------------

resource "random_password" "pg_admin" {
  length           = 24
  special          = true
  override_special = "_-!"
}

resource "random_password" "session_secret" {
  length  = 48
  special = false
}

locals {
  # Use the provided admin password if set, otherwise the generated one.
  pg_admin_password = var.pg_admin_password != "" ? var.pg_admin_password : random_password.pg_admin.result

  # Compact name used for resources that disallow hyphens (storage, ACR).
  compact_name = replace(var.name_prefix, "-", "")
}

# Log Analytics workspace (required by the Container App Environment).
resource "azurerm_log_analytics_workspace" "main" {
  name                = "log-${var.name_prefix}-prod"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
}

# Container Registry (Basic, admin enabled for Container App pull creds).
resource "azurerm_container_registry" "main" {
  name                = "${local.compact_name}acr${random_string.suffix.result}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "Basic"
  admin_enabled       = true
}
