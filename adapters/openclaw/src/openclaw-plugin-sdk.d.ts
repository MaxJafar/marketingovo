declare module "openclaw/plugin-sdk/tool-plugin" {
  import type { Static, TSchema } from "typebox";

  interface ToolExecutionContext {
    signal?: AbortSignal;
  }

  interface ToolDefinition<Parameters extends TSchema, Config extends TSchema> {
    name: string;
    label?: string;
    description: string;
    optional?: boolean;
    parameters: Parameters;
    execute(
      params: Static<Parameters>,
      config: Static<Config>,
      context: ToolExecutionContext,
    ): unknown | Promise<unknown>;
  }

  interface ToolBuilder<Config extends TSchema> {
    <Parameters extends TSchema>(
      definition: ToolDefinition<Parameters, Config>,
    ): unknown;
  }

  interface ToolPluginDefinition<Config extends TSchema> {
    id: string;
    name: string;
    description: string;
    configSchema: Config;
    tools(tool: ToolBuilder<Config>): unknown[];
  }

  export function defineToolPlugin<Config extends TSchema>(
    definition: ToolPluginDefinition<Config>,
  ): unknown;
}
