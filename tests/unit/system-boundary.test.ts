import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";
import ts from "typescript";
import { expect, it } from "vitest";

const root = process.cwd();
const systemModule = resolve(root, "src/lib/db/system");

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.[cm]?[jt]sx?$/.test(entry.name) ? [path] : [];
  }));
  return nested.flat();
}

function moduleReferences(source: ts.SourceFile): string[] {
  const references: string[] = [];
  const visit = (node: ts.Node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      references.push(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node) && node.arguments.length === 1 &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) && node.expression.text === "require"))) {
      const argument = node.arguments[0];
      if (ts.isStringLiteral(argument)) references.push(argument.text);
    } else if (ts.isImportEqualsDeclaration(node) &&
        ts.isExternalModuleReference(node.moduleReference) &&
        node.moduleReference.expression && ts.isStringLiteral(node.moduleReference.expression)) {
      references.push(node.moduleReference.expression.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return references;
}

function isAllowed(path: string): boolean {
  return /^(?:src\/lib\/auth\/|src\/lib\/services\/(?:demo|public)[^/]*\.ts$|scripts\/|db\/|tests\/)/.test(path);
}

it("restricts the RLS-bypassing system module to the architecture allowlist", async () => {
  const files = (await Promise.all(["src", "scripts", "db", "tests"].map(
    (directory) => sourceFiles(join(root, directory)),
  ))).flat();
  const violations: string[] = [];
  for (const file of files) {
    const path = relative(root, file).replaceAll("\\", "/");
    if (isAllowed(path)) continue;
    const source = ts.createSourceFile(file, await readFile(file, "utf8"), ts.ScriptTarget.Latest, true);
    for (const specifier of moduleReferences(source)) {
      const absolute = specifier.startsWith("@/")
        ? resolve(root, "src", specifier.slice(2))
        : resolve(file, "..", specifier);
      const extension = extname(absolute);
      const withoutExtension = /\.[cm]?[jt]sx?$/.test(extension)
        ? absolute.slice(0, -extension.length)
        : absolute;
      if (withoutExtension === systemModule) violations.push(`${path}: ${specifier}`);
    }
  }
  expect(violations, "ARCHITECTURE §14.2 permits system imports only in auth, demo/public services, scripts, db, and tests").toEqual([]);
});
