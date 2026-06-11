resource "azurerm_container_app_environment" "main" {
  name                       = "cae-${var.name_prefix}-prod"
  resource_group_name        = azurerm_resource_group.main.name
  location                   = azurerm_resource_group.main.location
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id
}

locals {
  postgres_fqdn = azurerm_postgresql_flexible_server.main.fqdn

  database_url = "postgres://${var.pg_admin_login}:${local.pg_admin_password}@${local.postgres_fqdn}:5432/${var.db_name}?sslmode=require"
}

resource "azurerm_container_app" "backend" {
  name                         = "kluch-backend"
  resource_group_name          = azurerm_resource_group.main.name
  container_app_environment_id = azurerm_container_app_environment.main.id
  revision_mode                = "Single"

  registry {
    server               = azurerm_container_registry.main.login_server
    username             = azurerm_container_registry.main.admin_username
    password_secret_name = "acr-password"
  }

  secret {
    name  = "acr-password"
    value = azurerm_container_registry.main.admin_password
  }

  secret {
    name  = "database-url"
    value = local.database_url
  }

  secret {
    name  = "session-secret"
    value = random_password.session_secret.result
  }

  secret {
    name  = "storage-key"
    value = azurerm_storage_account.main.primary_access_key
  }

  ingress {
    external_enabled = true
    target_port      = 8080
    transport        = "auto"

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  template {
    # Keep one replica warm so visitors never pay a cold start (the white-label
    # sites are latency-sensitive). Scale up to 2 under load.
    min_replicas = 1
    max_replicas = 2

    container {
      name   = "kluch-backend"
      image  = var.backend_image
      cpu    = 0.5
      memory = "1.0Gi"

      env {
        name        = "DATABASE_URL"
        secret_name = "database-url"
      }
      env {
        name        = "DIRECT_DATABASE_URL"
        secret_name = "database-url"
      }
      env {
        name        = "SESSION_SECRET"
        secret_name = "session-secret"
      }
      env {
        name  = "BASE_DOMAIN"
        value = var.base_domain
      }
      env {
        name  = "PORT"
        value = "8080"
      }
      env {
        name  = "AZURE_STORAGE_ACCOUNT"
        value = azurerm_storage_account.main.name
      }
      env {
        name        = "AZURE_STORAGE_KEY"
        secret_name = "storage-key"
      }
      env {
        name  = "AZURE_STORAGE_CONTAINER"
        value = azurerm_storage_container.photos.name
      }
    }
  }
}
