variable "subscription_id" {
  description = "Azure subscription ID. Defaults to the Kluch Azure Sponsorship subscription; override via TF_VAR_subscription_id."
  type        = string
  default     = "cc97dbf2-f732-4fd1-b853-faa7d795df9e"
}

variable "name_prefix" {
  description = "Prefix used to derive resource names. Storage/ACR names append a random suffix (they must be globally unique)."
  type        = string
  default     = "kluch"
}

variable "location" {
  description = "Primary Azure region for the stack."
  type        = string
  default     = "italynorth"
}

variable "swa_location" {
  description = "Region for the Static Web App. SWA metadata regions do not include italynorth; it is a global resource."
  type        = string
  default     = "westeurope"
}

variable "resource_group_name" {
  description = "Resource group name."
  type        = string
  default     = "rg-kluch-prod"
}

# PostgreSQL Flexible Server -------------------------------------------------

variable "pg_admin_login" {
  description = "PostgreSQL administrator login."
  type        = string
  default     = "kluchadmin"
}

variable "pg_admin_password" {
  description = "PostgreSQL administrator password. Pass via -var or TF_VAR_pg_admin_password; if empty a random one is generated."
  type        = string
  default     = ""
  sensitive   = true
}

variable "pg_version" {
  description = "PostgreSQL major version."
  type        = string
  default     = "16"
}

variable "pg_sku_name" {
  description = "PostgreSQL Flexible Server SKU."
  type        = string
  default     = "B_Standard_B1ms"
}

variable "pg_storage_mb" {
  description = "PostgreSQL storage in MB."
  type        = number
  default     = 32768
}

variable "db_name" {
  description = "Application database name."
  type        = string
  default     = "kluch"
}

# Container App --------------------------------------------------------------

variable "backend_image" {
  description = "Container image for the kluch-backend app. Defaults to a public placeholder so the first apply succeeds before the real image is pushed to ACR."
  type        = string
  default     = "mcr.microsoft.com/azuredocs/containerapps-helloworld:latest"
}

variable "base_domain" {
  description = "Public base domain for tenant sites (BASE_DOMAIN env var)."
  type        = string
  default     = "kluche.me"
}
