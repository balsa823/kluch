resource "azurerm_static_web_app" "console" {
  name                = "kluch-console"
  resource_group_name = azurerm_resource_group.main.name
  location            = var.swa_location # SWA metadata regions exclude italynorth; resource is global.

  sku_tier = "Free"
  sku_size = "Free"
}
