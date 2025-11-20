
(function () {
    const vscode = acquireVsCodeApi();

    let isJoined = false;
    let isHost = false;

    let hostSessionButton = document.querySelector(".host-session-button")
    let joinSessionButton = document.querySelector(".join-session-button")
    let endSessionButton = document.querySelector(".end-session-button")
    let disconectSessionButton = document.querySelector(".disconnect-session-button")
    
    hostSessionButton.addEventListener("click", hostSession);
    joinSessionButton.addEventListener("click", joinSession);
    endSessionButton.addEventListener("click", endSession);
    disconectSessionButton.addEventListener("click", disconnectSession);
    
    update();

    function update() {
        if (isJoined) {
            if (isHost) {
                hostSessionButton.style.display = "none";
                joinSessionButton.style.display = "none";
                endSessionButton.style.display = "block";
                disconectSessionButton.style.display = "none";
            } else {
                hostSessionButton.style.display = "none";
                joinSessionButton.style.display = "none";
                endSessionButton.style.display = "none";
                disconectSessionButton.style.display = "block";
            }
        } else {
            hostSessionButton.style.display = "block";
            joinSessionButton.style.display = "block";
            endSessionButton.style.display = "none";
            disconectSessionButton.style.display = "none";
        }
    }

    function hostSession() {
        vscode.postMessage({ type: "hostSession" });
        isJoined = true;
        isHost = true;
        update();
    }
    
    function joinSession() {
        vscode.postMessage({ type: "joinSession" });
        isJoined = true;
        isHost = false;
        update();
    }
    
    function endSession() {
        vscode.postMessage({ type: "endSession" });
        isJoined = false;
        isHost = false;
        update();
    }
    
    function disconnectSession() {
        vscode.postMessage({ type: "disconnectSession" });
        isJoined = false;
        isHost = false;
        update();
    }
}());
