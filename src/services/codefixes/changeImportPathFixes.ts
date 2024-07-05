import {
    createCodeFixActionWithoutFixAll,
    registerCodeFix,
} from "../_namespaces/ts.codefix.js";
import {
    createModuleSpecifierResolutionHost,
    Diagnostics,
    factory,
    getTokenAtPosition,
    isStringLiteral,
    mapDefined,
    moduleSpecifiers,
    textChanges,
} from "../_namespaces/ts.js";

const fixId = "changeImportPath";
const errorCodes = [Diagnostics.Import_path_can_be_changed.code];

registerCodeFix({
    errorCodes,
    getCodeActions: function getCodeActionsToConvertConstToLet(context) {
        const { sourceFile, span, program, preferences,host } = context;
        const checker = program.getTypeChecker();
        const token = getTokenAtPosition(sourceFile, span.start);
        if (!isStringLiteral(token)) {
            return;
        }
        const importedSourceFile = program.getSourceFileFromReference(sourceFile, {
            fileName: token.text, //moduleSpecifier.text,
            end: token.end,
            pos: token.pos,
        });
        if (!importedSourceFile) return;

        const result = moduleSpecifiers.getModuleSpecifiersForFileWithCacheInfo(importedSourceFile, checker, program.getCompilerOptions(), sourceFile, createModuleSpecifierResolutionHost(program, host), preferences, {}, true)
        return mapDefined(result.moduleSpecifiers, (moduleSpecifier) => {
            if (token.text === moduleSpecifier) {
                return;
            }
            const changes = textChanges.ChangeTracker.with(context, change => {
                const newToken = factory.createStringLiteral(moduleSpecifier);
                change.replaceNode(sourceFile, token, newToken);
            });
            return createCodeFixActionWithoutFixAll(fixId, changes, [Diagnostics.Change_import_path_to_0, moduleSpecifier]);
        });
        
    },
    fixIds: [fixId],
});
