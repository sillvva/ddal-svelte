export default {
	meta: {
		type: "problem",
		docs: {
			description: "Enforce that exports in .remote.ts files use guardedQuery(), guardedCommand(), or guardedForm()",
			category: "Best Practices",
			recommended: true
		},
		messages: {
			unguardedExport:
				"Exports in .remote.ts files must use guardedQuery(), guardedCommand(), or guardedForm(). Direct exports of query(), command(), or form() are not allowed.",
			mustBeGuarded: 'Export "{{name}}" must be the return value of guardedQuery(), guardedCommand(), or guardedForm().'
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
			return node.callee.type === "Identifier" && unguardedFunctions.has(node.callee.name);
		}

		function checkExportDeclaration(node) {
			if (node.type === "ExportNamedDeclaration") {
				if (node.declaration && node.declaration.type === "VariableDeclaration") {
					for (const declarator of node.declaration.declarations) {
						if (declarator.init) {
							if (declarator.init.type === "CallExpression" && isUnguardedCall(declarator.init)) {
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
				}
			}
		}

		return {
			ExportNamedDeclaration: checkExportDeclaration
		};
	}
};
