#!/usr/bin/env node
import { warnLegacyCliInvocation } from "./compatibility.js";

warnLegacyCliInvocation();
await import("./cli.js");
