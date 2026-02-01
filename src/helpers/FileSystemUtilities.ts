import * as vscode from "vscode";

export class FileSystemUtilities {
    static async saveFile(uri: vscode.Uri) {
        const openDoc = vscode.workspace.textDocuments.find(
            (doc) => doc.uri.fsPath === uri.fsPath
        );

        if (openDoc && openDoc.isDirty) {
            await openDoc.save();
        }
    }

    static async closeFileInEditor(uri: vscode.Uri) {
        const tabsToClose: vscode.Tab[] = [];
        for (const tabGroup of vscode.window.tabGroups.all) {
            const fileTabs = tabGroup.tabs.filter(
                (t) =>
                    t.input instanceof vscode.TabInputText &&
                    t.input.uri.fsPath === uri.fsPath
            );
            tabsToClose.push(...fileTabs);
        }

        if (tabsToClose.length > 0) {
            await vscode.window.tabGroups.close(tabsToClose);
        }
    }
}
