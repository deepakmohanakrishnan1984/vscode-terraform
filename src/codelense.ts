import * as vscode from 'vscode';

import { Section, Reference, Index } from './index/index';

export class SectionReferenceCodeLens extends vscode.CodeLens {
  constructor(
    private index: Index,
    range: vscode.Range,
    readonly section: Section,
    command?: vscode.Command) {
    super(range, command);
  }

  createCommand(): vscode.Command {
    let references = this.index.queryReferences("ALL_FILES", { target: this.section });

    return {
      title: `${references.length} references`,
      command: 'terraform.showReferences',
      tooltip: `Show all references to ${this.section.id}`,
      arguments: [this.section]
    } as vscode.Command;
  }
}

export class CodeLensProvider implements vscode.CodeLensProvider {
  private eventEmitter = new vscode.EventEmitter<void>();
  onDidChangeCodeLenses = this.eventEmitter.event;

  constructor(private index: Index) {
    this.index.onDidChange(() => {
      this.eventEmitter.fire();
    });
  }

  provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens[]> {
    return this.index.getOrIndexDocument(document).sections.map((s) => {
      let firstLineOfSection = new vscode.Range(s.location.range.start, new vscode.Position(s.location.range.start.line, 100000));
      return new SectionReferenceCodeLens(this.index, firstLineOfSection, s);
    });
  }

  resolveCodeLens?(codeLens: vscode.CodeLens, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens> {
    let sectionReferenceCodeLens = codeLens as SectionReferenceCodeLens;
    sectionReferenceCodeLens.command = sectionReferenceCodeLens.createCommand();
    return sectionReferenceCodeLens;
  }
}

export class ReferenceQuickPick implements vscode.QuickPickItem {
  readonly reference: Reference;
  readonly label: string;
  readonly description: string;
  readonly detail?: string;

  constructor(reference: Reference) {
    this.reference = reference;
    this.label = reference.section.id();
    this.description = reference.section.sectionType;
  }

  goto() {
    vscode.window.showTextDocument(this.reference.location.uri, {
      preserveFocus: true,
      preview: true,
      selection: this.reference.location.range
    });
  }
}

export function showReferencesCommand(index: Index, section: Section) {
  let picks = index.queryReferences("ALL_FILES", { target: section }).map((r) => new ReferenceQuickPick(r));

  vscode.window.showQuickPick(picks, {
    onDidSelectItem: (r: ReferenceQuickPick) => r.goto()
  });
}