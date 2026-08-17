# Infrastructure

Infrastructure starts from Microsoft's `functions-quickstart-typescript-azd` Flex Consumption template.

`main.bicep` provisions:

- Resource group
- User-assigned managed identity
- Azure Functions Flex Consumption plan and Function App
- Standard LRS Storage account with blob and table endpoints
- Azure Static Web Apps Free
- Key Vault with RBAC
- Log Analytics and Application Insights

Storage shared-key access is disabled. The Function App receives explicit UAMI endpoint, credential, and client ID settings.

The custom-domain resource remains disabled until its DNS CNAME exists.
