import * as vscode from "vscode";
import { getDocUri } from "./helper";
import { DiagnosticSource, DiagnosticsTestHelper } from "./diagnostics";

suite("Should get diagnostics", () => {
  const diagnosticHelper = new DiagnosticsTestHelper();

  const docUriFromVersionMissing = getDocUri(
    "image-version-missing.containerfile"
  );

  test("Diagnoses FROM version missing", async () => {
    await diagnosticHelper.testDiagnostics(docUriFromVersionMissing, [
      {
        message: "ubuntu has no exact version declared",
        range: diagnosticHelper.toRange(0, 5, 0, 11),
        severity: vscode.DiagnosticSeverity.Warning,
        source: DiagnosticSource,
      },
    ]);
  });

  const docUriFromVersionLatest = getDocUri(
    "image-version-latest.containerfile"
  );
  test("Diagnoses FROM version latest", async () => {
    await diagnosticHelper.testDiagnostics(docUriFromVersionLatest, [
      {
        message: `ubuntu should use an exact version rather than 'latest'`,
        range: diagnosticHelper.toRange(0, 5, 0, 11),
        severity: vscode.DiagnosticSeverity.Warning,
        source: DiagnosticSource,
      },
    ]);
  });

  const docUriFromVersionOlder = getDocUri("image-version-older.containerfile");
  test("Diagnoses FROM version older", async () => {
    const dateTagLastPushed = new Date("2020-03-18T17:15:17.265345Z");
    const dateNow = new Date();
    const diffMs = dateNow.getTime() - dateTagLastPushed.getTime(); // milliseconds
    const diffDays = Math.floor(diffMs / 86400000); // days

    await diagnosticHelper.testDiagnostics(docUriFromVersionOlder, [
      {
        message: `lncm/berkeleydb:v4.8.30.NC was updated about ${diffDays} days ago`,
        range: diagnosticHelper.toRange(0, 21, 0, 31),
        severity: vscode.DiagnosticSeverity.Warning,
        source: DiagnosticSource,
      },
    ]);
  });

  const docUriMaintainerMissing = getDocUri(
    "maintainer-info-missing.containerfile"
  );

  test("Diagnoses MAINTAINER information missing", async () => {
    await diagnosticHelper.testDiagnosticsAtLeastExpected(
      docUriMaintainerMissing,
      [
        {
          message:
            "To support maintanence of the image add the maintainer information as a label",
          range: diagnosticHelper.toRange(0, 0, 0, 0),
          severity: vscode.DiagnosticSeverity.Warning,
          source: DiagnosticSource,
        },
      ]
    );
  });

  const docUriLabelInsteadOfMaintainer = getDocUri(
    "label-instead-of-maintainer.containerfile"
  );
  test("Diagnoses LABEL instead of MAINTAINER Keyword", async () => {
    await diagnosticHelper.testDiagnosticsAtLeastExpected(
      docUriLabelInsteadOfMaintainer,
      [
        {
          message: `MAINTAINER is deprecated use - LABEL maintainer="NAME <E-MAIL>" - instead`,
          range: diagnosticHelper.toRange(1, 0, 1, 33),
          severity: vscode.DiagnosticSeverity.Warning,
          source: DiagnosticSource,
        },
      ]
    );
  });

  const docUriRunNoCleanup = getDocUri(
    "run-package-install-no-cleanup.containerfile"
  );
  test("Diagnoses RUN package install no cleanup", async () => {
    await diagnosticHelper.testDiagnosticsAtLeastExpected(docUriRunNoCleanup, [
      {
        message: `Remove the temporary files of the PACKAGE LIST update to reduce image size`,
        range: diagnosticHelper.toRange(2, 0, 2, 41),
        severity: vscode.DiagnosticSeverity.Warning,
        source: DiagnosticSource,
      },
    ]);
  });
});
