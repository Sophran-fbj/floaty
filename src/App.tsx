import { NoteWindow } from "@/pages/NoteWindow";
import { ManagerWindow } from "@/pages/ManagerWindow";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import "./index.css";

function App() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get("view");
  const id = params.get("id");

  // Manager window route
  if (view === "manager") {
    return (
      <ErrorBoundary>
        <ManagerWindow />
      </ErrorBoundary>
    );
  }

  // Note window route
  if (!id) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          fontSize: 14,
          color: "#999",
        }}
      >
        无效的便签窗口
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <NoteWindow noteId={id} />
    </ErrorBoundary>
  );
}

export default App;
