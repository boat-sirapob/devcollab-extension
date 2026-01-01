import * as path from "path";
import * as vscode from "vscode";

import { Uri, Webview } from "vscode";

import { WorkspaceType } from "../enums/WorkspaceType.js";

/**
 * A helper function that returns a unique alphanumeric identifier called a nonce.
 *
 * @remarks This function is primarily used to help enforce content security
 * policies for resources/scripts being executed in a webview context.
 *
 * @returns A nonce
 */
export function getNonce() {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

/**
 * A helper function which will get the webview URI of a given file or resource.
 *
 * @remarks This URI can be used within a webview's HTML as a link to the
 * given file/resource.
 *
 * @param webview A reference to the extension webview
 * @param extensionUri The URI of the directory containing the extension
 * @param pathList An array of strings representing the path to a file/resource
 * @returns A URI pointing to the file/resource
 */
export function getUri(webview: Webview, extensionUri: Uri, pathList: string[]) {
  return webview.asWebviewUri(Uri.joinPath(extensionUri, ...pathList));
}

export function absoluteToRelative(absPath: string, rootPath: string) {
  return path
    .relative(rootPath, absPath)
    .split(path.sep)
    .join("/");
}

export function relativeToAbsolute(relPath: string, rootPath: string) {
  return path.join(
    rootPath,
    ...relPath.split("/")
  );
}

export async function isDirectoryEmpty(dirUri: vscode.Uri): Promise<boolean> {
  const entries = await vscode.workspace.fs.readDirectory(dirUri);
  return entries.length === 0;
}

export function getWorkspaceType(): WorkspaceType {
  let folders = vscode.workspace.workspaceFolders;
  let editor = vscode.window.activeTextEditor;

  if (folders && folders.length > 0) {
    if (folders.length == 1) {
      return WorkspaceType.SingleRootFolder;
    } else {
      return WorkspaceType.MultiRootFolder;
    }
  } else if (!folders && editor) {
    return WorkspaceType.SingleFile;
  } else {
    return WorkspaceType.Empty;
  }
}