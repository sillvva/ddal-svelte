/// <reference types="node" />
import { defineConfig, devices } from "@playwright/test";
import { assertLocalE2E, loadLocalEnv, localBaseURL } from "./e2e/env.ts";

loadLocalEnv();
assertLocalE2E(process.env);

const baseURL = localBaseURL();
const base = new URL(baseURL);
const port = base.port || (base.protocol === "https:" ? "443" : "80");

export default defineConfig({
	testDir: "e2e",
	testMatch: "*.spec.ts",
	// Local runs use the list reporter. printSteps keeps each test.step() on its own line
	// while the test is still running. CI stays on the default dot reporter.
	reporter: process.env.CI ? "list" : [["list", { printSteps: true }]],
	fullyParallel: false,
	workers: 1,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	timeout: 240_000,
	expect: { timeout: 15_000 },
	globalSetup: "./e2e/global-setup.ts",
	globalTeardown: "./e2e/global-teardown.ts",
	outputDir: "e2e/.state/test-results",
	use: {
		baseURL,
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
		video: "retain-on-failure",
		...devices["Desktop Chrome"]
	},
	webServer: process.env.E2E_SKIP_WEBSERVER
		? undefined
		: {
				command: `pnpm exec vite dev --host ${base.hostname} --port ${port} --strictPort`,
				url: baseURL,
				reuseExistingServer: !process.env.CI,
				timeout: 120_000,
				// `op run` injects DATABASE_URL, PUBLIC_URL, and the R2 variables into this process.
				// The dev server must receive that same environment. CI exports the variables before `pnpm test:e2e`.
				env: inheritedEnv()
			}
});

function inheritedEnv() {
	const env: Record<string, string> = {};
	for (const [key, value] of Object.entries(process.env)) {
		if (typeof value === "string") env[key] = value;
	}
	return env;
}
