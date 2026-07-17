#!/usr/bin/env node
import { warnLegacyMcpInvocation } from "./compatibility.js";

warnLegacyMcpInvocation();
await import("./stdio.js");
