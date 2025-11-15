export default {
	meta: {
		type: "problem",
		docs: {
			description:
				"Enforce that exports in .remote.ts files use guardedQuery(), guardedCommand(), or guardedForm(), and only allow type exports",
			category: "Best Practices",
			recommended: true
		},
		messages: {
			unguardedExport:
				"Exports in .remote.ts files must use guardedQuery(), guardedCommand(), or guardedForm(). Direct exports of query(), command(), or form() are not allowed.",
			mustBeGuarded: 'Export "{{name}}" must be the return value of guardedQuery(), guardedCommand(), or guardedForm().',
			onlyTypesAllowed:
				'Only guarded remote functions and type exports are allowed in .remote.ts files. Export "{{name}}" is not allowed.'
		},
		schema: []
	},

	create(context) {
		const filename = context.getFilename();

		// Only apply this rule to files ending in .remote.ts
		if (!filename.endsWith(".remote.ts")) {
			return {};
		}

		const guardedFunctions = new Set(["guardedQuery", "guardedCommand", "guardedForm"]);
		const unguardedFunctions = new Set(["query", "command", "form"]);

		function isGuardedCall(node) {
			return node.type === "CallExpression" && node.callee.type === "Identifier" && guardedFunctions.has(node.callee.name);
		}

		function isUnguardedCall(node) {
			return node.type === "CallExpression" && node.callee.type === "Identifier" && unguardedFunctions.has(node.callee.name);
		}

		function checkExportDeclaration(node) {
			// Allow type-only exports
			if (node.exportKind === "type") {
				return;
			}

			if (node.type === "ExportNamedDeclaration") {
				// Handle type-only named exports: export type { Foo }
				if (node.exportKind === "type") {
					return;
				}

				// Handle re-exports without declaration
				if (!node.declaration && node.specifiers) {
					for (const specifier of node.specifiers) {
						// Allow individual type specifiers: export { type Foo }
						if (specifier.exportKind === "type") {
							continue;
						}

						context.report({
							node: specifier,
							messageId: "onlyTypesAllowed",
							data: {
								name: specifier.exported.name
							}
						});
					}
					return;
				}

				if (node.declaration && node.declaration.type === "VariableDeclaration") {
					for (const declarator of node.declaration.declarations) {
						if (declarator.init) {
							if (isUnguardedCall(declarator.init)) {
								context.report({
									node: declarator.init,
									messageId: "unguardedExport"
								});
							} else if (!isGuardedCall(declarator.init)) {
								context.report({
									node: declarator,
									messageId: "mustBeGuarded",
									data: {
										name: declarator.id.name
									}
								});
							}
						}
					}
				} else if (node.declaration) {
					// Block any other declaration types (functions, classes, etc.) unless they're type declarations
					const name = node.declaration.id?.name || "unknown";
					context.report({
						node: node.declaration,
						messageId: "onlyTypesAllowed",
						data: { name }
					});
				}
			}
		}

		return {
			ExportNamedDeclaration: checkExportDeclaration,
			// Block default exports entirely (they can't be types in the same way)
			ExportDefaultDeclaration(node) {
				context.report({
					node: node.declaration || node,
					loc: node.loc,
					messageId: "onlyTypesAllowed",
					data: { name: "default" }
				});
			},
			// Block export * statements
			ExportAllDeclaration(node) {
				context.report({
					node,
					loc: node.loc,
					messageId: "onlyTypesAllowed",
					data: { name: "*" }
				});
			}
		};
	}
};
