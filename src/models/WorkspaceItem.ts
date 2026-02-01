// export type WorkspaceFile = {
//   type: "file",
//   name: string,
//   path: string,
// }

// export type WorkspaceFolder = {
//   type: "folder",
//   name: string,
//   path: string,
//   children: WorkspaceItem[]
// }

// export type WorkspaceItem = WorkspaceFile | WorkspaceFolder;

export type WorkspaceItem = {
    name: string;
    path: string;
};
