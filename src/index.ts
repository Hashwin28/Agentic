import 'reflect-metadata';
import { McpApplicationFactory } from '@nitrostack/core';
import { AegisApplication } from './app.module.js';

async function bootstrap() {
  // Initialize the MCP server with the NitroStack factory
  const app = await McpApplicationFactory.create(AegisApplication);
  
  // Start the server (defaults to stdio in development)
  await app.start();
  
  console.error('Project Aegis MAS MCP Server running on stdio');
}

bootstrap().catch((err) => {
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});
