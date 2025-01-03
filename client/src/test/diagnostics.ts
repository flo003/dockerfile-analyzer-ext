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

    assert.equal(actualDiagnostics.length, expectedDiagnostics.length);

    expectedDiagnostics.forEach((expectedDiagnostic, i) => {
      const actualDiagnostic = actualDiagnostics[i];
      assert.equal(actualDiagnostic.message, expectedDiagnostic.message);
      assert.deepEqual(actualDiagnostic.range, expectedDiagnostic.range);
      assert.equal(actualDiagnostic.severity, expectedDiagnostic.severity);
    });
  }
}
