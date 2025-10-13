import * as vscode from "vscode";

import WebSocket from "ws";

// import { Peer } from "peerjs";


function openConnection() {  
  // const peer = new Peer("devcollab", {
  //   host: "localhost",
  //   port: 9000,
  //   path: "/myapp",
  // });
  // const peer = new Peer();

  // vscode.window.showInformationMessage("Test");
  
  // peer.on("open", id => {
  //   console.log(`Opened connection with peer id: ${id}`);
  //   vscode.window.showInformationMessage(`Peer ID: ${id}`);
  // });

  // peer.on("error", err => {
  //   vscode.window.showErrorMessage(`PeerJS error: ${err.type} - ${err.message}`);
  //   console.error("PeerJS error:", err);
  // });

  // peer.on("disconnected", () => {
  //   console.log("PeerJS disconnected");
  // });

  // peer.on("close", () => {
  //   console.log("PeerJS connection closed");
  // });

  const ws = new WebSocket("ws://localhost:8080");

  ws.on("open", () => {
    vscode.window.showInformationMessage("Connected to server");
    ws.send("Hello from VS Code!");
  });

  ws.on("message", msg => {
    vscode.window.showInformationMessage(`Received: ${msg}`);
  });

  var running = true;
  while (running) {
    vscode.window.showInputBox({ prompt: "Message" }).then((message) => {
      if (message !== undefined && message === "") {
        running = false;
        return;
      }
      
      ws.send(message!);
    });
  }
  
  ws.close();
}

// function connectToPeer() {
//   var peerId: string | null;

//   vscode.window
//     .showInputBox({
//       prompt: "Enter peer ID",
//       title: "Connect to peer",
//     })
//     .then((res) => {
//       vscode.window.showInformationMessage(`${res}`);
//       peerId = res || null;

//       if (peerId !== null) {
//         const peer = new Peer("devcollab", {
//           host: "localhost",
//           port: 9000,
//           path: "/myapp",
//         });
//         const conn = peer.connect(peerId);
//         conn.on("open", () => {
//           conn.send("Test");
//         });
//       }
//     });
// }

function sendMessage() {

}

export function activate(context: vscode.ExtensionContext) {
  const commands = [
    {
      command: "devcollab.openConnection",
      callback: openConnection
    },
    // {
    //   command: "devcollab.connect",
    //   callback: connectToPeer
    // },
  ];

  commands.forEach(c => {
    const disposable = vscode.commands.registerCommand(c.command, c.callback);
  
    context.subscriptions.push(disposable);
  });
}

export function deactivate() {}
