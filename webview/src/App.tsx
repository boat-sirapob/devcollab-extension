import "./App.css";

import ChatView from "./components/views/ChatView/ChatView";
import SessionInfoView from "./components/views/SessionInfoView/SessionInfoView";

if (import.meta.env.DEV) {
    // @ts-ignore
    await import("@vscode-elements/webview-playground");
}

function App() {
    const params = new URLSearchParams(window.location.search);

    const rootElement = document.getElementById("root");
    const viewType =
        rootElement?.getAttribute("data-view") ||
        params.get("view") ||
        "unknown";

    const renderView = () => {
        switch (viewType) {
            case "session-info":
                return <SessionInfoView />;
            case "chat":
                return <ChatView />;
            default:
                return <></>;
        }
    };

    return (
        <>
            {import.meta.env.DEV ? (
                // @ts-ignore
                <vscode-dev-toolbar></vscode-dev-toolbar>
            ) : null}
            {renderView()}
        </>
    );
}

export default App;
