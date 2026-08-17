param name string
param location string
param tags object = {}
param customDomain string = ''
param configureCustomDomain bool = false

resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' = {
  name: name
  location: location
  tags: union(tags, { 'azd-service-name': 'web' })
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    allowConfigFileUpdates: true
    stagingEnvironmentPolicy: 'Enabled'
  }
}

resource domain 'Microsoft.Web/staticSites/customDomains@2023-12-01' = if (configureCustomDomain && !empty(customDomain)) {
  parent: staticWebApp
  name: customDomain
  properties: {
    validationMethod: 'cname-delegation'
  }
}

output hostname string = staticWebApp.properties.defaultHostname
output url string = 'https://${staticWebApp.properties.defaultHostname}'
