import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

const prometheusExporter = new PrometheusExporter({ port: 9464 });
const traceExporter = new OTLPTraceExporter({
  url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
});

export const sdk = new NodeSDK({
  traceExporter,
  metricReader: prometheusExporter,
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
console.log('📡 OpenTelemetry 已启动，指标端口 9464');