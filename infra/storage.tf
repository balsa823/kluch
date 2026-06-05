resource "azurerm_storage_account" "main" {
  name                     = "${local.compact_name}stor${random_string.suffix.result}"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "LRS"

  # Container-level public read requires account-level public access to be allowed.
  allow_nested_items_to_be_public = true
}

resource "azurerm_storage_container" "photos" {
  name                  = "photos"
  storage_account_id    = azurerm_storage_account.main.id
  container_access_type = "blob" # public read of blobs, no container listing
}
