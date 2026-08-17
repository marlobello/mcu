import { app } from '@azure/functions';
import { useAzureMonitor } from '@azure/monitor-opentelemetry';

if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
  useAzureMonitor();
}

app.setup({
  enableHttpStream: true,
});
