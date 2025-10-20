import * as vscode from "vscode";
import * as assert from "assert";
import { activate } from "./helper";

export class DiagnosticsTestHelper {
  toRange(sLine: number, sChar: number, eLine: number, eChar: number) {
    const start = new vscode.Position(sLine, sChar);
    const end = new vscode.Position(eLine, eChar);
    return new vscode.Range(start, end);
  }

  async testDiagnostics(
    docUri: vscode.Uri,
    expectedDiagnostics: vscode.Diagnostic[]
  ) {
    await activate(docUri);

    const actualDiagnostics = vscode.languages.getDiagnostics(docUri);

    assert.strictEqual(
      actualDiagnostics.length,
      expectedDiagnostics.length,
      "Actual and exptected Diagnostics are not the same amount"
    );

    expectedDiagnostics.forEach((expectedDiagnostic, i) => {
      const actualDiagnostic = actualDiagnostics[i];
      assert.strictEqual(actualDiagnostic.message, expectedDiagnostic.message);
      assert.deepStrictEqual(actualDiagnostic.range, expectedDiagnostic.range);
      assert.strictEqual(
        actualDiagnostic.severity,
        expectedDiagnostic.severity
      );
    });
  }

  async testDiagnosticsAtLeastExpected(
    docUri: vscode.Uri,
    expectedDiagnostics: vscode.Diagnostic[]
  ) {
    await activate(docUri);

    const actualDiagnostics = vscode.languages.getDiagnostics(docUri);

    assert.strictEqual(
      actualDiagnostics.length >= expectedDiagnostics.length,
      true,
      `amount of diagnostics found  ${actualDiagnostics.length} >= amount of expected diagnostics ${expectedDiagnostics.length}`
    );

    expectedDiagnostics.forEach((expectedDiagnostic) => {
      const actualDiagnostic = actualDiagnostics.find(
        (actualDiagnostic) =>
          actualDiagnostic.message === expectedDiagnostic.message
      );
      assert.ok(
        actualDiagnostic,
        `Diagnostic '${expectedDiagnostic.message}' has not be found`
      );
      assert.strictEqual(actualDiagnostic.message, expectedDiagnostic.message);
      assert.deepStrictEqual(actualDiagnostic.range, expectedDiagnostic.range);
      assert.strictEqual(
        actualDiagnostic.severity,
        expectedDiagnostic.severity
      );
    });
  }
}

export const DiagnosticSource = 'dockerfiles-analyzer';