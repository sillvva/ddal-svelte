import { dev } from "$app/environment";
import { getRequestEvent } from "$app/server";
import { privateEnv } from "$lib/env/private";
import type { UserId } from "$lib/schemas";
import chalk from "chalk";
import { Console, Effect, HashMap, Layer, Logger } from "effect";
import { AdminService } from "./services/admin";

export type Annotations = {
	userId?: UserId | undefined;
	username?: string | undefined;
	impersonatedBy?: UserId | null;
	routeId: string | null;
	params: Partial<Record<string, string>>;
	extra: object;
};

const logLevel = Logger.withMinimumLogLevel(privateEnv.LOG_LEVEL);

const dbLogger = Logger.replace(
	Logger.defaultLogger,
	Logger.make(async (log) => {
		const event = getRequestEvent();
		const runtime = event.locals.runtime;

		await runtime.runPromise(
			Effect.gen(function* () {
				const Admin = yield* AdminService;
				return yield* Admin.set
					.saveLog({
						label: (log.message as string[]).join(" | "),
						timestamp: log.date,
						level: log.logLevel.label,
						annotations: Object.fromEntries(HashMap.toEntries(log.annotations)) as Annotations
					})
					.pipe(
						Effect.tap(
							(log) =>
								dev &&
								(["ERROR", "DEBUG"].includes(log.level)
									? Console.dir(log, { depth: null })
									: Console.log(
											chalk.underline(log.timestamp.toISOString()),
											chalk.bold[
												log.level === "ERROR" ? "red" : log.level === "DEBUG" ? "yellow" : log.level === "INFO" ? "cyan" : "reset"
											](`[${log.level}]`),
											log.label,
											"\n" + chalk.dim(JSON.stringify(log.annotations.extra))
										))
						)
					);
			})
		);
	})
);

function annotate(extra: Record<PropertyKey, unknown> = {}) {
	const event = getRequestEvent();
	return Effect.annotateLogs({
		userId: event.locals.user?.id,
		username: event.locals.user?.name,
		impersonatedBy: event.locals.session?.impersonatedBy,
		routeId: event.route.id,
		params: event.params,
		extra
	} satisfies Annotations);
}

export const AppLog = {
	info: (message: string, extra?: Record<string, unknown>, logger: Layer.Layer<never> = dbLogger) =>
		Effect.logInfo(message).pipe(logLevel, annotate(extra), Effect.provide(logger)),
	error: (message: string, extra?: Record<string, unknown>, logger: Layer.Layer<never> = dbLogger) =>
		Effect.logError(message).pipe(logLevel, annotate(extra), Effect.provide(logger)),
	debug: (message: string, extra?: Record<string, unknown>, logger: Layer.Layer<never> = dbLogger) =>
		Effect.logDebug(message).pipe(logLevel, annotate(extra), Effect.provide(logger))
};
