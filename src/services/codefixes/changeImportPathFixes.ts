import {
    createCodeFixAction,
    createCombinedCodeActions,
    eachDiagnostic,
    registerCodeFix,
} from "../_namespaces/ts.codefix.js";
import {
    addToSeen,
    createModuleSpecifierResolutionHost,
    Diagnostics,
    factory,
    getSymbolId,
    getTokenAtPosition,
    isStringLiteral,
    mapDefined,
    moduleSpecifiers,
    Program,
    Symbol,
    SourceFile,
    StringLiteral,
    textChanges,
    UserPreferences,
    LanguageServiceHost,
} from "../_namespaces/ts.js";

const fixId = "changeImportPath";
const errorCodes = [Diagnostics.Import_path_can_be_changed.code];

registerCodeFix({
    errorCodes,
    getCodeActions: function getCodeActionsToChangeImportPath(context) {
        const { sourceFile, span, program, preferences,host } = context;


        const info = getInfo(sourceFile, span.start, program, host, preferences);
        if (!info) {
            return;
        }
        return mapDefined(info.result.moduleSpecifiers, (moduleSpecifier) => {
            if (!canChange(info.token, moduleSpecifier)) return;
            const changes = textChanges.ChangeTracker.with(context, t => doChange(t, sourceFile, info.token, moduleSpecifier));
            return createCodeFixAction(fixId, changes, [Diagnostics.Change_import_path_to_0, moduleSpecifier], fixId, [Diagnostics.Change_all_import_paths]);
        });
        
    },
    getAllCodeActions: function getAllCodeActionsToChangeImportPath(context) {
        const { program } = context;
        const seen = new Map<number, true>();

        return createCombinedCodeActions(textChanges.ChangeTracker.with(context, changes => {
            eachDiagnostic(context, errorCodes, diag => {
                
                const info = getInfo(diag.file, diag.start, program, context.host, context.preferences);
                if (info) {
                    if (addToSeen(seen, getSymbolId(info.symbol))) {
                        return doChange(changes, diag.file, info.token, info.result.moduleSpecifiers[0]);
                    }
                }
                return undefined;
            });
        }));
    },
    fixIds: [fixId],
});
interface Info {
    symbol: Symbol;
    token: StringLiteral;
    result: moduleSpecifiers.ModuleSpecifierResult;
}

function getInfo(sourceFile: SourceFile, pos: number, program: Program, host: LanguageServiceHost, preferences: UserPreferences): Info | undefined {
    const checker = program.getTypeChecker();
    const symbol = checker.getSymbolAtLocation(getTokenAtPosition(sourceFile, pos));
    if (symbol === undefined) return;

    const token = getTokenAtPosition(sourceFile, pos);
    if (!isStringLiteral(token)) {
        return;
    }
    const importedSourceFile = program.getSourceFileFromReference(sourceFile, {
        fileName: token.text,
        end: token.end,
        pos: token.pos,
    });
    if (!importedSourceFile) return;
    const result = moduleSpecifiers.getModuleSpecifiersForFileWithCacheInfo(
        importedSourceFile,
        checker,
        program.getCompilerOptions(),
        sourceFile,
        createModuleSpecifierResolutionHost(program, host),
        preferences,
        {}, 
        /*forAutoImport*/ true
    );

    return { symbol, token, result };
}

function canChange(token: StringLiteral, moduleSpecifier: string) {
    return token.text !== moduleSpecifier;
}

function doChange(changes: textChanges.ChangeTracker, sourceFile: SourceFile, token: StringLiteral, moduleSpecifier: string) {
    changes.replaceNode(sourceFile, token, factory.createStringLiteral(moduleSpecifier));
}

