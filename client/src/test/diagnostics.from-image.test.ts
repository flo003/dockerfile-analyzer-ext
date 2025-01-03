import * as vscode from "vscode";
import { getDocUri } from "./helper";
import { DiagnosticsTestHelper } from "./diagnostics";

suite("Should get diagnostics", () => {
  const docUri = getDocUri("image-version-missing.txt");

  const diagnosticHelper = new DiagnosticsTestHelper();

  test("Diagnoses FROM version missing", async () => {
    await diagnosticHelper.testDiagnostics(docUri, [
      {
        message: "ubuntu has no exact version declared",
        range: diagnosticHelper.toRange(0, 6, 0, 12),
        severity: vscode.DiagnosticSeverity.Warning,
        source: "dockerfiles-analyzer",
      },
    ]);
  });
});
